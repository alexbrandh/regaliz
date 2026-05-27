// src/lib/shopify/verify-webhook.ts

import crypto from 'crypto';
import { getStoreDomain, getWebhookSecret } from './constants';

export interface WebhookValidation {
  valid: boolean;
  reason?: string;
  eventId?: string;
  topic?: string;
}

/**
 * Valida un webhook de Shopify:
 *  - HMAC SHA256 del body raw contra el secret
 *  - Dominio de la tienda coincide
 *  - Headers requeridos presentes
 *
 * Devuelve `valid: true` solo si todo pasa. Usa timing-safe comparison.
 */
export function verifyShopifyWebhook(
  rawBody: string,
  headers: Headers
): WebhookValidation {
  const hmacHeader = headers.get('x-shopify-hmac-sha256');
  const topic = headers.get('x-shopify-topic');
  const shopDomain = headers.get('x-shopify-shop-domain');
  const eventId = headers.get('x-shopify-webhook-id');

  if (!hmacHeader) return { valid: false, reason: 'Missing X-Shopify-Hmac-Sha256 header' };
  if (!topic) return { valid: false, reason: 'Missing X-Shopify-Topic header' };
  if (!shopDomain) return { valid: false, reason: 'Missing X-Shopify-Shop-Domain header' };
  if (!eventId) return { valid: false, reason: 'Missing X-Shopify-Webhook-Id header' };

  // Validar dominio
  const expectedDomain = getStoreDomain();
  if (shopDomain !== expectedDomain) {
    return { valid: false, reason: `Shop domain mismatch: got ${shopDomain}, expected ${expectedDomain}` };
  }

  // Validar HMAC con timing-safe compare
  const secret = getWebhookSecret();
  const computed = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64');

  const a = Buffer.from(computed, 'utf8');
  const b = Buffer.from(hmacHeader, 'utf8');

  if (a.length !== b.length) {
    return { valid: false, reason: 'HMAC length mismatch' };
  }
  if (!crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: 'HMAC mismatch' };
  }

  return { valid: true, eventId, topic };
}

/**
 * Helper para extraer el `postcard_id` (u otro attribute) del body parseado de Shopify.
 * En `orders/paid` el campo se llama `note_attributes` y es un array de `{name, value}`.
 * En `refunds/create` los atributos viven dentro de `order.note_attributes`.
 */
export function getNoteAttribute(
  noteAttributes: Array<{ name: string; value: string }> | undefined,
  key: string
): string | undefined {
  if (!Array.isArray(noteAttributes)) return undefined;
  return noteAttributes.find((a) => a.name === key)?.value;
}
