// src/lib/shopify/constants.ts

export type ProductType = 'digital' | 'physical';
export type VariantColor = 'beige' | 'negro';

export interface CheckoutRequest {
  postcardId: string;
  productType: ProductType;
  variantColor?: VariantColor;  // requerido si productType === 'physical'
}

export function getVariantId(
  productType: ProductType,
  variantColor?: VariantColor
): string {
  if (productType === 'digital') {
    const id = process.env.SHOPIFY_VARIANT_AR_DIGITAL;
    if (!id) throw new Error('SHOPIFY_VARIANT_AR_DIGITAL not configured');
    return id;
  }

  if (productType === 'physical') {
    if (variantColor === 'beige') {
      const id = process.env.SHOPIFY_VARIANT_POSTAL_BEIGE;
      if (!id) throw new Error('SHOPIFY_VARIANT_POSTAL_BEIGE not configured');
      return id;
    }
    if (variantColor === 'negro') {
      const id = process.env.SHOPIFY_VARIANT_POSTAL_NEGRO;
      if (!id) throw new Error('SHOPIFY_VARIANT_POSTAL_NEGRO not configured');
      return id;
    }
    throw new Error(`Invalid variantColor "${variantColor}" for physical product`);
  }

  throw new Error(`Invalid productType: ${productType}`);
}

export function getStoreDomain(): string {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  if (!domain) throw new Error('SHOPIFY_STORE_DOMAIN not configured');
  return domain;
}

export function getWebhookSecret(): string {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) throw new Error('SHOPIFY_WEBHOOK_SECRET not configured');
  return secret;
}
