// src/app/api/checkout/create/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase';
import { buildCheckoutPermalink } from '@/lib/shopify/permalink';
import { getVariantId, type ProductType, type VariantColor } from '@/lib/shopify/constants';
import { validateUUID } from '@/lib/validation';
import { logger } from '@/lib/logger';

interface CheckoutRequestBody {
  postcardId: string;
  productType: ProductType;
  variantColor?: VariantColor;
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as CheckoutRequestBody;
    const { postcardId, productType, variantColor } = body;

    // Validaciones básicas
    if (!postcardId || !validateUUID(postcardId, 'postcardId').isValid) {
      return NextResponse.json({ error: 'Invalid postcardId' }, { status: 400 });
    }
    if (productType !== 'digital' && productType !== 'physical') {
      return NextResponse.json({ error: 'Invalid productType' }, { status: 400 });
    }
    if (productType === 'physical' && variantColor !== 'beige' && variantColor !== 'negro') {
      return NextResponse.json({ error: 'variantColor required for physical product' }, { status: 400 });
    }

    // Verificar la postal
    const supabase = createServerClient();
    const { data: postcard, error } = await supabase
      .from('postcards')
      .select('id, user_id, processing_status, is_activated')
      .eq('id', postcardId)
      .single();

    if (error || !postcard) {
      return NextResponse.json({ error: 'Postcard not found' }, { status: 404 });
    }
    if (postcard.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (postcard.processing_status !== 'ready') {
      return NextResponse.json({ error: 'Postcard not ready yet' }, { status: 409 });
    }
    if (postcard.is_activated) {
      return NextResponse.json({ error: 'Postcard already activated' }, { status: 409 });
    }

    // Construir checkout URL
    const variantId = getVariantId(productType, variantColor);
    const checkoutUrl = buildCheckoutPermalink({
      variantId,
      postcardId,
      userId,
      fulfillmentType: productType,
    });

    logger.info('Checkout URL generated', { postcardId, metadata: { productType, variantColor }, userId });

    return NextResponse.json({ checkoutUrl });
  } catch (err) {
    logger.error('Checkout creation failed', {}, err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
