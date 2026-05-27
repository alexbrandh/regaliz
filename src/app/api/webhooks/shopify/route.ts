// src/app/api/webhooks/shopify/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyShopifyWebhook, getNoteAttribute } from '@/lib/shopify/verify-webhook';
import { logger } from '@/lib/logger';

// Disable Next.js body parsing — necesitamos el raw body para validar HMAC
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // 1. Leer body RAW (no parseado)
  const rawBody = await req.text();

  // 2. Validar HMAC + headers
  const validation = verifyShopifyWebhook(rawBody, req.headers);
  if (!validation.valid) {
    logger.warn('Shopify webhook rejected', { metadata: { reason: validation.reason } });
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { eventId, topic } = validation;
  const supabase = createServerClient();

  // 3. Parsear el body (ya validado como auténtico)
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse('Invalid JSON', { status: 400 });
  }

  // 4. Dedup: INSERT en shopify_webhook_events. Si duplicado, retorna 200 sin reprocesar.
  const { error: insertError } = await supabase
    .from('shopify_webhook_events')
    .insert({
      shopify_event_id: eventId!,
      topic: topic!,
      payload: payload as never,
    });

  if (insertError) {
    if (insertError.code === '23505') {
      // unique_violation — ya procesamos este evento
      logger.info('Duplicate webhook ignored', { metadata: { eventId, topic } });
      return new NextResponse('OK (duplicate)', { status: 200 });
    }
    logger.error('Failed to log webhook event', { metadata: { eventId, topic } }, new Error(insertError.message));
    return new NextResponse('Internal error', { status: 500 });
  }

  // 5. Dispatch por topic
  let handlerError: string | undefined;
  try {
    switch (topic) {
      case 'orders/paid':
        await handleOrderPaid(payload, supabase);
        break;
      case 'refunds/create':
        await handleRefundCreated(payload, supabase);
        break;
      case 'orders/cancelled':
        await handleOrderCancelled(payload, supabase);
        break;
      default:
        logger.info('Unhandled webhook topic', { metadata: { topic } });
    }
  } catch (err) {
    handlerError = err instanceof Error ? err.message : String(err);
    logger.error('Webhook handler failed', { metadata: { eventId, topic } }, err instanceof Error ? err : undefined);
  }

  // 6. Marcar como procesado
  await supabase
    .from('shopify_webhook_events')
    .update({ processed_at: new Date().toISOString(), error: handlerError ?? null })
    .eq('shopify_event_id', eventId!);

  // Siempre 200 a Shopify a menos que sea auth fail
  return new NextResponse('OK', { status: 200 });
}

// Task 8 will replace this stub
async function handleOrderPaid(payload: Record<string, unknown>, supabase: ReturnType<typeof createServerClient>) {
  const orderId = String(payload.id ?? '');
  const orderName = (payload.name as string | undefined) ?? null;
  const noteAttributes = payload.note_attributes as
    | Array<{ name: string; value: string }>
    | undefined;
  const shippingAddress = payload.shipping_address as Record<string, unknown> | null;

  const postcardId = getNoteAttribute(noteAttributes, 'postcard_id');
  const fulfillmentType = getNoteAttribute(noteAttributes, 'fulfillment_type') as
    | 'digital'
    | 'physical'
    | undefined;

  if (!postcardId) {
    logger.warn('orders/paid without postcard_id attribute — ignoring', {
      metadata: { orderId, orderName },
    });
    return;
  }
  if (fulfillmentType !== 'digital' && fulfillmentType !== 'physical') {
    logger.warn('orders/paid with invalid fulfillment_type', {
      metadata: { orderId, postcardId, fulfillmentType },
    });
    return;
  }

  const { error, data } = await supabase
    .from('postcards')
    .update({
      is_activated: true,
      activated_at: new Date().toISOString(),
      fulfillment_type: fulfillmentType,
      shopify_order_id: orderId,
      shopify_order_number: orderName,
      shipping_address: fulfillmentType === 'physical' ? (shippingAddress as never) : null,
    })
    .eq('id', postcardId)
    .is('shopify_order_id', null)
    .select('id, user_id')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      logger.warn('Postcard not updated (already activated or not found)', {
        metadata: { orderId, postcardId },
      });
      return;
    }
    throw new Error(`Failed to activate postcard: ${error.message}`);
  }

  logger.info('Postcard activated via webhook', {
    metadata: { postcardId, orderId, fulfillmentType, userId: data?.user_id },
  });
}

// Task 9 will replace these stubs
async function handleRefundCreated(payload: Record<string, unknown>, supabase: ReturnType<typeof createServerClient>) {
  const orderId = String(payload.order_id ?? '');
  if (!orderId) {
    logger.warn('refunds/create without order_id — ignoring');
    return;
  }

  const transactions = (payload.transactions as Array<{ kind: string; status: string }> | undefined) ?? [];
  const hasSuccessfulRefund = transactions.some(
    (t) => t.kind === 'refund' && t.status === 'success'
  );

  if (!hasSuccessfulRefund) {
    logger.info('Refund created but no successful refund transaction — ignoring', {
      metadata: { orderId },
    });
    return;
  }

  const refundLineItems = (payload.refund_line_items as Array<{ quantity: number }> | undefined) ?? [];
  const totalRefundedQty = refundLineItems.reduce((sum, item) => sum + (item.quantity ?? 0), 0);

  if (totalRefundedQty < 1) {
    logger.info('Partial refund — ignoring (postcard stays activated)', {
      metadata: { orderId, totalRefundedQty },
    });
    return;
  }

  const { data, error } = await supabase
    .from('postcards')
    .update({
      is_activated: false,
      activated_at: null,
    })
    .eq('shopify_order_id', orderId)
    .select('id')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      logger.warn('Refund for order not linked to any postcard', { metadata: { orderId } });
      return;
    }
    throw new Error(`Failed to deactivate postcard on refund: ${error.message}`);
  }

  logger.info('Postcard deactivated via refund', { metadata: { orderId, postcardId: data?.id } });
}

async function handleOrderCancelled(payload: Record<string, unknown>, supabase: ReturnType<typeof createServerClient>) {
  const orderId = String(payload.id ?? '');
  if (!orderId) {
    logger.warn('orders/cancelled without id — ignoring');
    return;
  }

  const { data, error } = await supabase
    .from('postcards')
    .update({
      is_activated: false,
      activated_at: null,
    })
    .eq('shopify_order_id', orderId)
    .select('id')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      logger.warn('Cancellation for order not linked to any postcard', { metadata: { orderId } });
      return;
    }
    throw new Error(`Failed to deactivate postcard on cancel: ${error.message}`);
  }

  logger.info('Postcard deactivated via cancellation', { metadata: { orderId, postcardId: data?.id } });
}
