// src/lib/shopify/permalink.ts

import { getStoreDomain } from './constants';

export interface PermalinkParams {
  variantId: string;            // ID numérico (no GID)
  postcardId: string;
  userId: string;
  fulfillmentType: 'digital' | 'physical';
}

/**
 * Construye un URL de cart permalink de Shopify que pre-carga el carrito
 * con la variante y atributos para luego ir directo al checkout.
 *
 * Formato: https://{domain}/cart/{variantId}:1?attributes[key]=value&return_to=/checkout
 *
 * Los atributos sobreviven al checkout y aparecen como `note_attributes` en la orden.
 */
export function buildCheckoutPermalink(params: PermalinkParams): string {
  const domain = getStoreDomain();
  const url = new URL(`https://${domain}/cart/${params.variantId}:1`);

  url.searchParams.set('attributes[postcard_id]', params.postcardId);
  url.searchParams.set('attributes[user_id]', params.userId);
  url.searchParams.set('attributes[fulfillment_type]', params.fulfillmentType);
  url.searchParams.set('return_to', '/checkout');

  return url.toString();
}
