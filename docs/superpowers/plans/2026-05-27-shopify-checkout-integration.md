# Shopify Checkout Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que los usuarios activen sus postales pagando en Shopify (digital $15k COP o postal física $30k COP), con bloqueo total del AR público hasta el pago y desbloqueo automático vía webhook.

**Architecture:** Crear postal queda gratis. Activación = pago en Shopify hosted checkout (vía cart permalink) con `postcard_id` como cart attribute. Webhook `orders/paid` valida HMAC + dedup, marca `is_activated=true` en Supabase. Clerk sigue siendo el sistema de auth de la app.

**Tech Stack:** Next.js 16 (App Router), React 19, Clerk auth, Supabase (Postgres + service role), TypeScript, Tailwind, Shopify Admin API (configuración manual + webhooks).

**Spec de referencia:** [docs/superpowers/specs/2026-05-27-shopify-checkout-integration-design.md](../specs/2026-05-27-shopify-checkout-integration-design.md)

---

## Variables de entorno requeridas

Antes de cualquier tarea, agrega estas variables al `.env.local` (y al deploy de producción):

```
SHOPIFY_STORE_DOMAIN=2qvrgn-5u.myshopify.com
SHOPIFY_VARIANT_AR_DIGITAL=51344446095638
SHOPIFY_VARIANT_POSTAL_BEIGE=51344445505814
SHOPIFY_VARIANT_POSTAL_NEGRO=51344445538582
SHOPIFY_WEBHOOK_SECRET=<obtener al crear webhook en Shopify Admin, ver Task 19>
NEXT_PUBLIC_APP_URL=https://regaliz.com.co
```

Para desarrollo local, `NEXT_PUBLIC_APP_URL` puede ser `http://localhost:3000`. Pero el webhook de Shopify requiere URL pública — usar `ngrok` o un deploy preview de Vercel para pruebas en local.

---

## File Structure

**Crear (nuevos):**
- `src/lib/shopify/permalink.ts` — builder puro de URL del checkout
- `src/lib/shopify/verify-webhook.ts` — validación HMAC + dedup
- `src/lib/shopify/constants.ts` — mapeo de productType → variant ID
- `src/app/api/checkout/create/route.ts` — endpoint para iniciar compra
- `src/app/api/webhooks/shopify/route.ts` — receptor de webhooks
- `src/components/activation/ActivationCTA.tsx` — bloque grande con 2 opciones de compra
- `src/components/activation/ColorSelector.tsx` — selector Beige/Negro para físico
- `src/components/activation/ActivationBadge.tsx` — badge de estado en card
- `src/components/activation/PostPurchaseSuccess.tsx` — overlay post-pago con polling
- `docs/shopify/order-status-script.html` — snippet para Order Status Page
- `docs/shopify/setup.md` — instrucciones de configuración manual

**Modificar (existentes):**
- `src/types/database.ts` — agregar columnas nuevas a tipos Postcard
- `src/app/api/postcards/[id]/route.ts` — exponer flags de activación + filtrar contenido sensible
- `src/components/PostcardCard.tsx` — agregar badge + deshabilitar Compartir si no activada
- `src/app/dashboard/postcard/[id]/page.tsx` — mostrar ActivationCTA cuando no activada + PostPurchaseSuccess cuando `just_paid=true`
- `src/app/ar/[postcardId]/page.tsx` — pantalla de bloqueo cuando no activada
- `src/app/share/[postcardId]/page.tsx` — pantalla de bloqueo cuando no activada

**Migración DB (Supabase):**
- Aplicada vía Supabase MCP `apply_migration`

---

## Phase 1: Foundation (DB + types)

### Task 1: Migración de Supabase

**Files:**
- DB: tabla `postcards` (ALTER), nueva tabla `shopify_webhook_events`

- [ ] **Step 1: Aplicar la migración vía Supabase MCP**

Llama al tool `mcp__claude_ai_Supabase__apply_migration` con:

```
name: shopify_activation_columns
query: |
  ALTER TABLE postcards
    ADD COLUMN is_activated         boolean      NOT NULL DEFAULT false,
    ADD COLUMN activated_at         timestamptz,
    ADD COLUMN fulfillment_type     text         CHECK (fulfillment_type IN ('digital','physical')),
    ADD COLUMN shopify_order_id     text         UNIQUE,
    ADD COLUMN shopify_order_number text,
    ADD COLUMN shipping_address     jsonb;

  CREATE INDEX idx_postcards_shopify_order_id ON postcards(shopify_order_id);

  CREATE TABLE shopify_webhook_events (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    shopify_event_id text UNIQUE NOT NULL,
    topic            text NOT NULL,
    payload          jsonb NOT NULL,
    processed_at     timestamptz,
    error            text,
    received_at      timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX idx_webhook_events_received_at ON shopify_webhook_events(received_at DESC);
```

- [ ] **Step 2: Verificar las columnas con `list_tables`**

Llama `mcp__claude_ai_Supabase__list_tables` con `schemas: ["public"]` y confirma que `postcards` tiene las 6 columnas nuevas y `shopify_webhook_events` existe con todas sus columnas.

- [ ] **Step 3: Commit**

No hay archivos que commitear en esta tarea (la migración se persiste en Supabase).

---

### Task 2: Actualizar tipos de TypeScript

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Editar `src/types/database.ts`**

En `Tables.postcards.Row`, `Insert`, y `Update`, agregar:

```ts
// Row
is_activated: boolean
activated_at: string | null
fulfillment_type: 'digital' | 'physical' | null
shopify_order_id: string | null
shopify_order_number: string | null
shipping_address: Json | null

// Insert (todos opcionales con default razonable)
is_activated?: boolean
activated_at?: string | null
fulfillment_type?: 'digital' | 'physical' | null
shopify_order_id?: string | null
shopify_order_number?: string | null
shipping_address?: Json | null

// Update (todos opcionales)
is_activated?: boolean
activated_at?: string | null
fulfillment_type?: 'digital' | 'physical' | null
shopify_order_id?: string | null
shopify_order_number?: string | null
shipping_address?: Json | null
```

Al final del archivo, después de los exports existentes, agregar:

```ts
export interface ShippingAddress {
  first_name: string
  last_name: string
  address1: string
  address2?: string | null
  city: string
  province?: string | null
  country: string
  zip: string
  phone?: string | null
}
```

Y agregar la tabla `shopify_webhook_events` al `Database['public']['Tables']`:

```ts
shopify_webhook_events: {
  Row: {
    id: string
    shopify_event_id: string
    topic: string
    payload: Json
    processed_at: string | null
    error: string | null
    received_at: string
  }
  Insert: {
    id?: string
    shopify_event_id: string
    topic: string
    payload: Json
    processed_at?: string | null
    error?: string | null
    received_at?: string
  }
  Update: {
    id?: string
    shopify_event_id?: string
    topic?: string
    payload?: Json
    processed_at?: string | null
    error?: string | null
    received_at?: string
  }
  Relationships: []
}
```

- [ ] **Step 2: Verificar TypeScript no tiene errores**

Run: `npx tsc --noEmit`
Expected: 0 errors (los nuevos campos se infieren correctamente en el resto del codebase porque tienen defaults o son nullable).

- [ ] **Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "feat(types): add shopify activation columns to postcards + webhook events table"
```

---

## Phase 2: Backend utilities

### Task 3: Constantes de Shopify

**Files:**
- Create: `src/lib/shopify/constants.ts`

- [ ] **Step 1: Crear archivo**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shopify/constants.ts
git commit -m "feat(shopify): add product/variant constants and env helpers"
```

---

### Task 4: Builder de permalink de checkout

**Files:**
- Create: `src/lib/shopify/permalink.ts`

- [ ] **Step 1: Crear archivo**

```ts
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
```

- [ ] **Step 2: Verificación manual**

Crear un archivo temporal `scripts/verify-permalink.ts`:

```ts
import { buildCheckoutPermalink } from '../src/lib/shopify/permalink';

process.env.SHOPIFY_STORE_DOMAIN = '2qvrgn-5u.myshopify.com';

const url = buildCheckoutPermalink({
  variantId: '51344446095638',
  postcardId: 'abc-123',
  userId: 'user_xyz',
  fulfillmentType: 'digital',
});

console.log(url);
// Esperado (orden de query params puede variar):
// https://2qvrgn-5u.myshopify.com/cart/51344446095638:1?attributes%5Bpostcard_id%5D=abc-123&attributes%5Buser_id%5D=user_xyz&attributes%5Bfulfillment_type%5D=digital&return_to=%2Fcheckout
```

Run: `npx tsx scripts/verify-permalink.ts`
Expected: imprime la URL con los 3 atributos correctamente URL-encoded.
Luego borra el archivo: `rm scripts/verify-permalink.ts` (no debe llegar al repo).

- [ ] **Step 3: Commit**

```bash
git add src/lib/shopify/permalink.ts
git commit -m "feat(shopify): permalink builder for hosted checkout"
```

---

### Task 5: Verificación de webhook (HMAC + dedup)

**Files:**
- Create: `src/lib/shopify/verify-webhook.ts`

- [ ] **Step 1: Crear archivo**

```ts
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
```

- [ ] **Step 2: Verificación manual**

Crear `scripts/verify-hmac.ts`:

```ts
import { verifyShopifyWebhook } from '../src/lib/shopify/verify-webhook';
import crypto from 'crypto';

process.env.SHOPIFY_STORE_DOMAIN = '2qvrgn-5u.myshopify.com';
process.env.SHOPIFY_WEBHOOK_SECRET = 'test-secret-123';

const body = JSON.stringify({ id: 'test-order' });
const validHmac = crypto.createHmac('sha256', 'test-secret-123').update(body, 'utf8').digest('base64');

// Caso 1: HMAC válido
const ok = verifyShopifyWebhook(body, new Headers({
  'x-shopify-hmac-sha256': validHmac,
  'x-shopify-topic': 'orders/paid',
  'x-shopify-shop-domain': '2qvrgn-5u.myshopify.com',
  'x-shopify-webhook-id': 'event-1',
}));
console.log('Valid case:', ok); // Esperado: { valid: true, eventId: 'event-1', topic: 'orders/paid' }

// Caso 2: HMAC mal
const bad = verifyShopifyWebhook(body, new Headers({
  'x-shopify-hmac-sha256': 'YmFkLWhtYWM=',
  'x-shopify-topic': 'orders/paid',
  'x-shopify-shop-domain': '2qvrgn-5u.myshopify.com',
  'x-shopify-webhook-id': 'event-1',
}));
console.log('Bad HMAC:', bad); // Esperado: { valid: false, reason: 'HMAC length mismatch' o 'HMAC mismatch' }

// Caso 3: Dominio mal
const wrongDomain = verifyShopifyWebhook(body, new Headers({
  'x-shopify-hmac-sha256': validHmac,
  'x-shopify-topic': 'orders/paid',
  'x-shopify-shop-domain': 'evil-store.myshopify.com',
  'x-shopify-webhook-id': 'event-1',
}));
console.log('Wrong domain:', wrongDomain); // Esperado: { valid: false, reason: '... mismatch ...' }
```

Run: `npx tsx scripts/verify-hmac.ts`
Expected: caso 1 válido, casos 2 y 3 inválidos con razón clara. Borrar el archivo después.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shopify/verify-webhook.ts
git commit -m "feat(shopify): webhook HMAC verification with timing-safe compare"
```

---

## Phase 3: Backend endpoints

### Task 6: Endpoint POST /api/checkout/create

**Files:**
- Create: `src/app/api/checkout/create/route.ts`

- [ ] **Step 1: Crear archivo**

```ts
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

    logger.info('Checkout URL generated', { postcardId, productType, variantColor, userId });

    return NextResponse.json({ checkoutUrl });
  } catch (err) {
    logger.error('Checkout creation failed', {}, err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verificación manual**

Inicia el dev server: `npm run dev`

En otra terminal, prueba el endpoint (necesitas estar logueado en el browser y copiar la cookie de sesión de Clerk, o usar un postcardId real):

```bash
curl -X POST http://localhost:3000/api/checkout/create \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=<tu-clerk-session>" \
  -d '{"postcardId":"<uuid-real>","productType":"digital"}'
```

Expected:
- Si logueado y postal válida: `{"checkoutUrl":"https://2qvrgn-5u.myshopify.com/cart/..."}`
- Sin login: `{"error":"Unauthorized"}` con status 401
- Postal de otro usuario: `{"error":"Forbidden"}` status 403
- Postal en `processing`: `{"error":"Postcard not ready yet"}` status 409

Abre el `checkoutUrl` en el browser y confirma que carga el carrito de Shopify con el producto correcto.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/checkout/create/route.ts
git commit -m "feat(api): POST /api/checkout/create generates shopify cart permalink"
```

---

### Task 7: Endpoint POST /api/webhooks/shopify — esqueleto + HMAC + dedup

**Files:**
- Create: `src/app/api/webhooks/shopify/route.ts`

- [ ] **Step 1: Crear archivo con manejo de HMAC, dedup y dispatch por topic (handlers vacíos por ahora)**

```ts
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

  // 5. Dispatch por topic (handlers se implementan en tasks siguientes)
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

  // 6. Marcar como procesado (incluso si falló, queda registro del error)
  await supabase
    .from('shopify_webhook_events')
    .update({ processed_at: new Date().toISOString(), error: handlerError ?? null })
    .eq('shopify_event_id', eventId!);

  // Siempre 200 a Shopify a menos que sea auth fail. Si retornamos error, Shopify reintenta y dupica trabajo.
  return new NextResponse('OK', { status: 200 });
}

// Stubs — se implementan en Task 8, 9, 10
async function handleOrderPaid(payload: Record<string, unknown>, supabase: ReturnType<typeof createServerClient>) {
  logger.info('handleOrderPaid stub', { metadata: { orderId: payload.id } });
}
async function handleRefundCreated(payload: Record<string, unknown>, supabase: ReturnType<typeof createServerClient>) {
  logger.info('handleRefundCreated stub', { metadata: { orderId: payload.order_id } });
}
async function handleOrderCancelled(payload: Record<string, unknown>, supabase: ReturnType<typeof createServerClient>) {
  logger.info('handleOrderCancelled stub', { metadata: { orderId: payload.id } });
}
```

- [ ] **Step 2: Verificación manual**

Inicia dev server. Prueba con un POST falso para verificar que la firma HMAC bloquea bien:

```bash
curl -X POST http://localhost:3000/api/webhooks/shopify \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Hmac-Sha256: ZmFrZS1obWFj" \
  -H "X-Shopify-Topic: orders/paid" \
  -H "X-Shopify-Shop-Domain: 2qvrgn-5u.myshopify.com" \
  -H "X-Shopify-Webhook-Id: test-1" \
  -d '{"id":"123"}'
```

Expected: `401 Unauthorized` (HMAC inválido).

Para probar el path feliz, generar HMAC válido localmente:

```bash
BODY='{"id":"test-order-123"}'
HMAC=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SHOPIFY_WEBHOOK_SECRET" -binary | base64)
curl -X POST http://localhost:3000/api/webhooks/shopify \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Hmac-Sha256: $HMAC" \
  -H "X-Shopify-Topic: orders/paid" \
  -H "X-Shopify-Shop-Domain: 2qvrgn-5u.myshopify.com" \
  -H "X-Shopify-Webhook-Id: test-event-1" \
  -d "$BODY"
```

Expected: `200 OK`. Verificar en Supabase que la fila `shopify_webhook_events` se creó con `processed_at` poblado.

Repetir el mismo curl: la segunda vez retorna `200 OK (duplicate)` y no crea nueva fila (dedup funciona).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/webhooks/shopify/route.ts
git commit -m "feat(api): shopify webhook endpoint with HMAC verification and dedup"
```

---

### Task 8: Handler de orders/paid

**Files:**
- Modify: `src/app/api/webhooks/shopify/route.ts`

- [ ] **Step 1: Reemplazar el stub `handleOrderPaid` con la implementación real**

Localizar la función `handleOrderPaid` (stub) y reemplazarla por:

```ts
async function handleOrderPaid(
  payload: Record<string, unknown>,
  supabase: ReturnType<typeof createServerClient>
) {
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

  // UPDATE postcard con shopify_order_id como clave de idempotencia (UNIQUE constraint)
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
    .is('shopify_order_id', null) // solo si no se ha activado antes
    .select('id, user_id')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows updated — postal ya tenía orden previa, o no existe
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
```

- [ ] **Step 2: Verificación manual**

1. Crear una postal de prueba en el dashboard, esperar a que esté `ready`.
2. Anotar el `postcardId` (UUID de la URL).
3. Construir un payload falso de `orders/paid` con ese `postcardId` como note_attribute:

```bash
POSTCARD_ID="<tu-uuid-de-postal>"
BODY=$(cat <<EOF
{
  "id": 9999999001,
  "name": "#TEST-001",
  "note_attributes": [
    {"name": "postcard_id", "value": "$POSTCARD_ID"},
    {"name": "fulfillment_type", "value": "digital"},
    {"name": "user_id", "value": "user_test"}
  ],
  "shipping_address": null
}
EOF
)
HMAC=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SHOPIFY_WEBHOOK_SECRET" -binary | base64)
curl -X POST http://localhost:3000/api/webhooks/shopify \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Hmac-Sha256: $HMAC" \
  -H "X-Shopify-Topic: orders/paid" \
  -H "X-Shopify-Shop-Domain: 2qvrgn-5u.myshopify.com" \
  -H "X-Shopify-Webhook-Id: test-paid-1" \
  -d "$BODY"
```

Expected:
- 200 OK
- En Supabase, la postal tiene `is_activated=true`, `fulfillment_type='digital'`, `shopify_order_id='9999999001'`, `activated_at` poblado.
- Repetir el curl con OTRO `X-Shopify-Webhook-Id` (para evitar dedup en webhook_events) y mismo orderId: la actualización NO se aplica de nuevo (porque `is('shopify_order_id', null)` ya no matchea). Idempotencia OK.

4. Probar con `fulfillment_type: "physical"` y un `shipping_address` JSON: el campo se guarda.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/webhooks/shopify/route.ts
git commit -m "feat(webhook): orders/paid activates postcard with idempotency guard"
```

---

### Task 9: Handler de refunds/create y orders/cancelled

**Files:**
- Modify: `src/app/api/webhooks/shopify/route.ts`

- [ ] **Step 1: Reemplazar los stubs `handleRefundCreated` y `handleOrderCancelled`**

```ts
async function handleRefundCreated(
  payload: Record<string, unknown>,
  supabase: ReturnType<typeof createServerClient>
) {
  // En refunds/create el orden lo identifica order_id (no id)
  const orderId = String(payload.order_id ?? '');
  if (!orderId) {
    logger.warn('refunds/create without order_id — ignoring');
    return;
  }

  // Determinar si es reembolso total: comparar suma de refund_line_items + transactions
  // contra el total original. Para simplificar: si hay transactions con kind='refund'
  // y el order tiene financial_status='refunded', es total.
  // Atajo confiable: chequear `payload.transactions` con kind=refund y status=success.
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

  // Verificar si es total: traer la orden completa requeriría Admin API; en su lugar,
  // confiamos en que Shopify sólo manda refunds/create con transactions exitosas cuando
  // efectivamente hubo movimiento. Para distinguir parcial vs total, usamos un campo
  // del payload: si refund_line_items cubre todas las líneas, es total.
  const refundLineItems = (payload.refund_line_items as Array<{ quantity: number }> | undefined) ?? [];
  const totalRefundedQty = refundLineItems.reduce((sum, item) => sum + (item.quantity ?? 0), 0);

  // Nuestras órdenes siempre tienen 1 item (un postcard). Si refund cubre >= 1 unidad, es total.
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

async function handleOrderCancelled(
  payload: Record<string, unknown>,
  supabase: ReturnType<typeof createServerClient>
) {
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
```

- [ ] **Step 2: Verificación manual**

Reutilizar la postal activada en Task 8 (con `shopify_order_id = '9999999001'`).

Refund total:
```bash
BODY=$(cat <<'EOF'
{
  "id": 5555,
  "order_id": 9999999001,
  "transactions": [{"kind": "refund", "status": "success"}],
  "refund_line_items": [{"quantity": 1}]
}
EOF
)
HMAC=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SHOPIFY_WEBHOOK_SECRET" -binary | base64)
curl -X POST http://localhost:3000/api/webhooks/shopify \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Hmac-Sha256: $HMAC" \
  -H "X-Shopify-Topic: refunds/create" \
  -H "X-Shopify-Shop-Domain: 2qvrgn-5u.myshopify.com" \
  -H "X-Shopify-Webhook-Id: test-refund-1" \
  -d "$BODY"
```

Expected: postal `is_activated=false` en Supabase.

Cancelación: activar otra postal (Task 8 con un orderId distinto) y luego:
```bash
BODY='{"id": 9999999002}'
HMAC=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SHOPIFY_WEBHOOK_SECRET" -binary | base64)
curl -X POST http://localhost:3000/api/webhooks/shopify \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Hmac-Sha256: $HMAC" \
  -H "X-Shopify-Topic: orders/cancelled" \
  -H "X-Shopify-Shop-Domain: 2qvrgn-5u.myshopify.com" \
  -H "X-Shopify-Webhook-Id: test-cancel-1" \
  -d "$BODY"
```

Expected: la otra postal queda `is_activated=false`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/webhooks/shopify/route.ts
git commit -m "feat(webhook): handle refunds/create and orders/cancelled to deactivate"
```

---

### Task 10: Exponer flags de activación + filtrar contenido sensible en GET /api/postcards/[id]

**Files:**
- Modify: `src/app/api/postcards/[id]/route.ts`

- [ ] **Step 1: Importar `auth` de Clerk al top del archivo si no está**

Verificar al tope de `src/app/api/postcards/[id]/route.ts`. El import de `auth` ya existe (línea 2). OK.

- [ ] **Step 2: Modificar `PostcardResponse` interface y `handleGetPostcard`**

En `PostcardResponse` (alrededor de la línea 16), agregar:

```ts
interface PostcardResponse {
  id: string;
  status: string;
  image_url?: string;
  video_url?: string;
  title?: string;
  description?: string;
  nft_descriptors?: { /* ... existente ... */ };
  created_at: string;
  message?: string;
  user_id?: string;
  // NUEVOS:
  is_activated?: boolean;
  fulfillment_type?: 'digital' | 'physical' | null;
  activated_at?: string | null;
}
```

En `handleGetPostcard`, modificar la firma para recibir el userId del caller, y ajustar el response:

Encontrar el bloque final que retorna el postcard listo (alrededor de las líneas 180-193) y modificarlo para que:

1. Lea el `userId` del caller (puede ser `null` si no logueado)
2. Determine si el caller es el creador: `const isOwner = callerUserId === postcard.user_id`
3. Si `is_activated === false && !isOwner` → omitir `image_url`, `video_url`, `nft_descriptors`

Reemplazar el `return createApiResponse(...)` final por:

```ts
const { userId: callerUserId } = await auth();
const isOwner = callerUserId === postcard.user_id;
const visibleToPublic = postcard.is_activated || isOwner;

return createApiResponse(
  true,
  {
    id: postcard.id,
    user_id: postcard.user_id,
    status: postcard.processing_status,
    title: postcard.title,
    description: postcard.description || undefined,
    created_at: postcard.created_at,
    is_activated: postcard.is_activated,
    fulfillment_type: postcard.fulfillment_type,
    activated_at: postcard.activated_at,
    // Sólo exponer assets si está activada O el caller es el dueño
    image_url: visibleToPublic ? imageUrl : undefined,
    video_url: visibleToPublic ? videoUrl : undefined,
    nft_descriptors: visibleToPublic ? (nftDescriptors as PostcardResponse['nft_descriptors']) : undefined,
  }
);
```

- [ ] **Step 3: Verificación manual**

Con dev server arriba:

1. Como usuario A (dueño), crear postal, dejarla inactivada. Ver detalle vía API:
   ```bash
   curl -H "Cookie: __session=<A>" http://localhost:3000/api/postcards/<id>
   ```
   Expected: incluye `image_url`, `video_url`, `is_activated:false`, `nft_descriptors`.

2. Como usuario B (no dueño) o sin login, misma URL:
   Expected: NO incluye `image_url`/`video_url`/`nft_descriptors`. Sí incluye `is_activated:false`, `title`.

3. Activar la postal (vía webhook curl de Task 8) y repetir 1 y 2: ahora ambos ven todo.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/postcards/\[id\]/route.ts
git commit -m "feat(api): expose activation flags and filter assets for non-owners on locked postcards"
```

---

## Phase 4: Frontend — bloqueo del AR público

### Task 11: Bloquear /ar/[postcardId] cuando no está activada

**Files:**
- Modify: `src/app/ar/[postcardId]/page.tsx`

- [ ] **Step 1: Reemplazar el contenido del archivo**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';

interface PostcardSummary {
  id: string;
  is_activated: boolean;
  user_id?: string;
  title?: string;
}

export default function ARViewerPage() {
  const params = useParams();
  const postcardId = params.postcardId as string;
  const { user, isLoaded } = useUser();
  const [data, setData] = useState<PostcardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!postcardId) return;
    fetch(`/api/postcards/${postcardId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) setData(res.data);
      })
      .finally(() => setLoading(false));
  }, [postcardId]);

  useEffect(() => {
    if (data?.is_activated) {
      window.location.href = `/ar-viewer.html?id=${postcardId}`;
    }
  }, [data, postcardId]);

  if (loading || !isLoaded) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a', color: '#FAF8F5' }}>
        <p>Cargando...</p>
      </div>
    );
  }

  // Postal no activada
  if (data && !data.is_activated) {
    const isOwner = !!user && user.id === data.user_id;
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2d1f1f 50%, #1a1a1a 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: '#FAF8F5', padding: '24px', textAlign: 'center'
      }}>
        <img src="/regaliz-isotipo.svg" alt="Regaliz" style={{ width: '80px', height: '80px', marginBottom: '24px' }} />
        {isOwner ? (
          <>
            <h1 style={{ fontSize: '24px', marginBottom: '12px' }}>Activa tu postal</h1>
            <p style={{ color: '#bbb', marginBottom: '24px', maxWidth: '420px' }}>
              Tu postal está lista pero aún no está activada. Actívala para que tú y otros puedan vivir la experiencia AR.
            </p>
            <Link href={`/dashboard/postcard/${postcardId}`} style={{
              background: '#F47B6B', color: '#fff', padding: '12px 24px', borderRadius: '8px', fontWeight: 600, textDecoration: 'none'
            }}>
              Ir a activar
            </Link>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: '24px', marginBottom: '12px' }}>Tu regalo está siendo preparado ✨</h1>
            <p style={{ color: '#bbb', maxWidth: '420px' }}>
              Esta postal aún no está disponible. Inténtalo de nuevo más tarde.
            </p>
          </>
        )}
      </div>
    );
  }

  // Mientras redirige a /ar-viewer.html (data.is_activated === true)
  return (
    <div style={{ minHeight: '100vh', background: '#1a1a1a', color: '#F47B6B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p>Iniciando experiencia AR...</p>
    </div>
  );
}
```

- [ ] **Step 2: Verificación manual**

1. Crear postal nueva, no activarla.
2. Como usuario dueño, abrir `/ar/<id>`: ver pantalla "Activa tu postal" con botón "Ir a activar".
3. Cerrar sesión (o usar incógnito), abrir misma URL: ver "Tu regalo está siendo preparado".
4. Activar postal vía curl (Task 8): refrescar `/ar/<id>`: redirige a `/ar-viewer.html?id=<id>`.

- [ ] **Step 3: Commit**

```bash
git add src/app/ar/\[postcardId\]/page.tsx
git commit -m "feat(ar): gate public AR experience behind is_activated flag"
```

---

### Task 12: Bloquear /share/[postcardId] cuando no está activada

**Files:**
- Modify: `src/app/share/[postcardId]/page.tsx`

- [ ] **Step 1: Leer el archivo actual y entender su estructura**

Run: leer `src/app/share/[postcardId]/page.tsx` completo. Es un Server Component que llama a `createClient` (server) y renderiza `<SharePostcardView>`.

- [ ] **Step 2: Modificar `SharePage` para chequear `is_activated`**

En el SELECT actual del postcard (alrededor de la línea 60-80, dentro de `export default async function SharePage`), agregar `is_activated, user_id` a los campos seleccionados.

Después de obtener la postal, antes de renderizar `SharePostcardView`:

```tsx
if (!postcard.is_activated) {
  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a1a 0%, #2d1f1f 50%, #1a1a1a 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      color: '#FAF8F5', padding: '24px', textAlign: 'center'
    }}>
      <h1 style={{ fontSize: '28px', marginBottom: '12px' }}>Tu regalo está siendo preparado ✨</h1>
      <p style={{ color: '#bbb', maxWidth: '460px' }}>
        Esta postal aún no está disponible para compartir. Vuelve pronto.
      </p>
    </main>
  );
}
```

(Mantén el resto del archivo igual: si está activada, renderiza `SharePostcardView` como antes.)

También actualizar `generateMetadata` para que si `is_activated=false`, devuelva metadata genérica sin filtrar imagen/título a redes sociales:

```ts
if (!postcard.is_activated) {
  return {
    title: 'Regaliz — Tu regalo te espera',
    description: 'Tu postal personalizada está siendo preparada.',
  };
}
```

- [ ] **Step 3: Verificación manual**

1. Con postal NO activada, abrir `https://localhost:3000/share/<id>` en incógnito.
2. Ver pantalla "Tu regalo está siendo preparado".
3. Verificar metadata: ver `<head>` del HTML — `<title>` y `<meta og:image>` no exponen contenido.
4. Activar postal y refrescar: render normal del `SharePostcardView`.

- [ ] **Step 4: Commit**

```bash
git add src/app/share/\[postcardId\]/page.tsx
git commit -m "feat(share): block share page and metadata when postcard is not activated"
```

---

### Task 13: Deshabilitar botón "Compartir" en PostcardCard si no activada

**Files:**
- Modify: `src/components/PostcardCard.tsx`

- [ ] **Step 1: Modificar el bloque de Action Buttons (línea ~157-176)**

Reemplazar el JSX dentro del bloque `{postcard.processing_status === 'ready' && ...}` por:

```tsx
{postcard.processing_status === 'ready' && (
  <>
    <Button
      variant="outline"
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        window.open(`/ar/${postcard.id}`, '_blank');
      }}
      className="flex items-center gap-1"
    >
      <ExternalLink className="h-3 w-3" />
      Ver realidad aumentada
    </Button>
    {postcard.is_activated ? (
      <SharePostcard postcardId={postcard.id} title={postcard.title} />
    ) : (
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button variant="outline" size="sm" disabled className="flex items-center gap-1 opacity-60">
              <Share2 className="h-3 w-3" />
              Compartir
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Activa tu postal para poder compartirla</p>
        </TooltipContent>
      </Tooltip>
    )}
  </>
)}
```

Agregar el import de `Share2` arriba (línea 9) si no está:

```tsx
import { Clock, CheckCircle, AlertCircle, Trash2, XCircle, ImageIcon, ExternalLink, Share2 } from 'lucide-react';
```

- [ ] **Step 2: Verificación manual**

1. Dashboard con postales en mix de estados:
   - Postal activada: botón "Compartir" funciona (abre dialog).
   - Postal sin activar: botón "Compartir" gris/disabled, hover muestra tooltip "Activa tu postal...".

- [ ] **Step 3: Commit**

```bash
git add src/components/PostcardCard.tsx
git commit -m "feat(dashboard): disable share button on unactivated postcards with tooltip"
```

---

## Phase 5: Frontend — UI de activación

### Task 14: Componente ColorSelector

**Files:**
- Create: `src/components/activation/ColorSelector.tsx`

- [ ] **Step 1: Crear archivo**

```tsx
'use client';

import { cn } from '@/lib/utils';
import type { VariantColor } from '@/lib/shopify/constants';

interface ColorSelectorProps {
  value: VariantColor;
  onChange: (color: VariantColor) => void;
}

export function ColorSelector({ value, onChange }: ColorSelectorProps) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange('beige')}
        className={cn(
          'flex-1 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all',
          value === 'beige'
            ? 'border-primary bg-primary/10 text-foreground'
            : 'border-border bg-card text-muted-foreground hover:border-primary/50'
        )}
        aria-pressed={value === 'beige'}
      >
        <span className="inline-block w-3 h-3 rounded-full bg-[#E8D5B7] mr-2 align-middle ring-1 ring-border" />
        Beige
      </button>
      <button
        type="button"
        onClick={() => onChange('negro')}
        className={cn(
          'flex-1 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all',
          value === 'negro'
            ? 'border-primary bg-primary/10 text-foreground'
            : 'border-border bg-card text-muted-foreground hover:border-primary/50'
        )}
        aria-pressed={value === 'negro'}
      >
        <span className="inline-block w-3 h-3 rounded-full bg-[#1a1a1a] mr-2 align-middle ring-1 ring-border" />
        Negro
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/activation/ColorSelector.tsx
git commit -m "feat(activation): color selector for physical postcard variant"
```

---

### Task 15: Componente ActivationCTA

**Files:**
- Create: `src/components/activation/ActivationCTA.tsx`

- [ ] **Step 1: Crear archivo**

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sparkles, Truck, Loader2 } from 'lucide-react';
import { ColorSelector, type VariantColor } from './ColorSelector';
import { toast } from 'sonner';

interface ActivationCTAProps {
  postcardId: string;
}

const DIGITAL_PRICE = '$15.000 COP';
const PHYSICAL_PRICE = '$30.000 COP';

export function ActivationCTA({ postcardId }: ActivationCTAProps) {
  const [color, setColor] = useState<VariantColor>('beige');
  const [loadingType, setLoadingType] = useState<'digital' | 'physical' | null>(null);

  const startCheckout = async (productType: 'digital' | 'physical') => {
    setLoadingType(productType);
    try {
      const res = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postcardId,
          productType,
          ...(productType === 'physical' ? { variantColor: color } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'No pudimos iniciar el pago');
        return;
      }

      window.location.assign(data.checkoutUrl);
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error('Error de red. Inténtalo de nuevo.');
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <Card className="p-6 bg-linear-to-br from-primary/5 via-card to-ring/5 border-primary/20">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">Activa tu postal</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Elige cómo quieres recibir tu experiencia de realidad aumentada.
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        {/* DIGITAL */}
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col">
          <h3 className="font-semibold text-base mb-1">Solo digital</h3>
          <p className="text-2xl font-bold text-foreground mb-2">{DIGITAL_PRICE}</p>
          <p className="text-sm text-muted-foreground mb-4 flex-1">
            Activa el AR y tú imprimes la foto donde quieras. Compártela inmediatamente.
          </p>
          <Button
            onClick={() => startCheckout('digital')}
            disabled={loadingType !== null}
            className="w-full"
          >
            {loadingType === 'digital' ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Redirigiendo...</>
            ) : (
              'Activar'
            )}
          </Button>
        </div>

        {/* PHYSICAL */}
        <div className="rounded-xl border-2 border-primary/40 bg-card p-5 flex flex-col relative">
          <div className="absolute -top-2 right-3 bg-primary text-primary-foreground text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Truck className="h-3 w-3" /> Recomendado
          </div>
          <h3 className="font-semibold text-base mb-1">Postal física + AR</h3>
          <p className="text-2xl font-bold text-foreground mb-2">{PHYSICAL_PRICE}</p>
          <p className="text-sm text-muted-foreground mb-4">
            Imprimimos y enviamos tu postal a la dirección que indiques. Activamos el AR automáticamente.
          </p>
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-2">Color de la postal:</p>
            <ColorSelector value={color} onChange={setColor} />
          </div>
          <Button
            onClick={() => startCheckout('physical')}
            disabled={loadingType !== null}
            className="w-full"
            variant="default"
          >
            {loadingType === 'physical' ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Redirigiendo...</>
            ) : (
              'Comprar postal'
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/activation/ActivationCTA.tsx
git commit -m "feat(activation): ActivationCTA component with digital/physical options"
```

---

### Task 16: Wire ActivationCTA en dashboard/postcard/[id]

**Files:**
- Modify: `src/app/dashboard/postcard/[id]/page.tsx`

- [ ] **Step 1: Importar y renderizar ActivationCTA**

En `src/app/dashboard/postcard/[id]/page.tsx`:

1. Agregar el import al top:
```tsx
import { ActivationCTA } from '@/components/activation/ActivationCTA';
```

2. Actualizar la interface `Postcard` para incluir los campos de activación:
```tsx
interface Postcard {
  id: string;
  title: string;
  description: string;
  image_url: string;
  video_url: string;
  video_path?: string;
  user_id?: string;
  status: PostcardStatus;
  created_at: string;
  is_activated?: boolean;
  fulfillment_type?: 'digital' | 'physical' | null;
}
```

3. Localizar la sección donde se muestra el bloque "Compartir" (buscar `SharePostcard` o `Share2` en el JSX) y envolverlo en un condicional. Si la postal es del usuario, está `ready`, pero NO está activada → mostrar `<ActivationCTA>`. Si está activada → mostrar el bloque compartir existente.

Patrón:
```tsx
{postcard.status === 'ready' && (
  postcard.is_activated ? (
    /* bloque "Compartir" existente */
  ) : (
    <ActivationCTA postcardId={postcard.id} />
  )
)}
```

(Adapta la condición al patrón exacto del archivo — puede que tengas que envolver el JSX existente.)

- [ ] **Step 2: Verificación manual**

1. Abrir `/dashboard/postcard/<id>` de una postal `ready` no activada: ver `ActivationCTA` con las 2 opciones.
2. Click en "Activar" (digital): redirige a checkout de Shopify.
3. Cancelar y volver: la postal sigue inactiva, el CTA sigue ahí.
4. Activar manualmente vía curl (Task 8) y refrescar la página: ahora ves el bloque "Compartir" normal.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/postcard/\[id\]/page.tsx
git commit -m "feat(dashboard): show ActivationCTA on unactivated ready postcards"
```

---

### Task 17: Componente ActivationBadge + integración

**Files:**
- Create: `src/components/activation/ActivationBadge.tsx`
- Modify: `src/components/PostcardCard.tsx`

- [ ] **Step 1: Crear ActivationBadge**

```tsx
// src/components/activation/ActivationBadge.tsx
import { Badge } from '@/components/ui/badge';
import { Truck, CheckCircle2, Clock } from 'lucide-react';

interface ActivationBadgeProps {
  isActivated: boolean;
  fulfillmentType?: 'digital' | 'physical' | null;
}

export function ActivationBadge({ isActivated, fulfillmentType }: ActivationBadgeProps) {
  if (!isActivated) {
    return (
      <Badge className="bg-amber-500 text-white text-xs font-medium px-2.5 py-1 rounded-full">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Sin activar
        </span>
      </Badge>
    );
  }

  if (fulfillmentType === 'physical') {
    return (
      <Badge className="bg-emerald-500 text-white text-xs font-medium px-2.5 py-1 rounded-full">
        <span className="flex items-center gap-1">
          <Truck className="h-3 w-3" />
          Activa · Envío en camino
        </span>
      </Badge>
    );
  }

  return (
    <Badge className="bg-emerald-500 text-white text-xs font-medium px-2.5 py-1 rounded-full">
      <span className="flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Activa
      </span>
    </Badge>
  );
}
```

- [ ] **Step 2: Integrar en PostcardCard**

En `src/components/PostcardCard.tsx`:

1. Agregar import:
```tsx
import { ActivationBadge } from '@/components/activation/ActivationBadge';
```

2. Localizar el `<Badge>` actual (que muestra `processing_status`) en el header (líneas ~91-107). Justo después de ese badge, agregar:

```tsx
{postcard.processing_status === 'ready' && (
  <ActivationBadge
    isActivated={!!postcard.is_activated}
    fulfillmentType={postcard.fulfillment_type}
  />
)}
```

Si quieres reemplazar el badge actual por el de activación cuando processing está ready, esa también es opción válida. Pero recomendamos mostrar ambos: el de estado de proceso y el de activación, lado a lado.

- [ ] **Step 3: Verificación manual**

Dashboard con mix de postales: las `ready` y no activadas tienen badge ámbar "Sin activar". Las activadas digital → verde "Activa". Las activadas física → verde "Activa · Envío en camino".

- [ ] **Step 4: Commit**

```bash
git add src/components/activation/ActivationBadge.tsx src/components/PostcardCard.tsx
git commit -m "feat(dashboard): activation badge on postcard cards"
```

---

## Phase 6: Frontend — flujo post-pago

### Task 18: Componente PostPurchaseSuccess (overlay + polling)

**Files:**
- Create: `src/components/activation/PostPurchaseSuccess.tsx`

- [ ] **Step 1: Crear archivo**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PostPurchaseSuccessProps {
  postcardId: string;
  onDismiss: () => void;
}

interface PostcardStatus {
  is_activated?: boolean;
  fulfillment_type?: 'digital' | 'physical' | null;
  shipping_address?: { city?: string; address1?: string } | null;
}

export function PostPurchaseSuccess({ postcardId, onDismiss }: PostPurchaseSuccessProps) {
  const [status, setStatus] = useState<'polling' | 'activated' | 'timeout'>('polling');
  const [data, setData] = useState<PostcardStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 15; // 15 * 2s = 30s

    const poll = async () => {
      if (cancelled) return;
      attempts += 1;

      try {
        const res = await fetch(`/api/postcards/${postcardId}`, { cache: 'no-store' });
        const json = await res.json();
        const payload = (json?.data ?? json) as PostcardStatus;

        if (payload?.is_activated) {
          if (!cancelled) {
            setData(payload);
            setStatus('activated');
          }
          return;
        }
      } catch (err) {
        console.error('Polling error:', err);
      }

      if (attempts >= MAX_ATTEMPTS) {
        if (!cancelled) setStatus('timeout');
        return;
      }

      setTimeout(poll, 2000);
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [postcardId]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
        {status === 'polling' && (
          <>
            <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
            <h2 className="text-xl font-semibold mb-2">Procesando tu pago…</h2>
            <p className="text-sm text-muted-foreground">
              Estamos confirmando con Shopify. Esto toma unos segundos.
            </p>
          </>
        )}

        {status === 'activated' && data && (
          <>
            <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">¡Postal activada! 🎉</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Tu experiencia de realidad aumentada ya está disponible.
            </p>
            {data.fulfillment_type === 'physical' && data.shipping_address && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 mb-4">
                📦 Tu postal física llegará en 3-5 días hábiles
                {data.shipping_address.city ? ` a ${data.shipping_address.city}` : ''}.
              </p>
            )}
            <Button onClick={onDismiss} className="w-full">
              Continuar
            </Button>
          </>
        )}

        {status === 'timeout' && (
          <>
            <Loader2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">El pago se está procesando</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Está tardando un poco. Refresca esta página en un minuto.
            </p>
            <Button onClick={onDismiss} variant="outline" className="w-full">
              Cerrar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/activation/PostPurchaseSuccess.tsx
git commit -m "feat(activation): PostPurchaseSuccess overlay with polling and timeout"
```

---

### Task 19: Wire PostPurchaseSuccess al detectar `?just_paid=true`

**Files:**
- Modify: `src/app/dashboard/postcard/[id]/page.tsx`

- [ ] **Step 1: Detectar el query param y montar el componente**

En el top del archivo, agregar imports:
```tsx
import { useSearchParams, useRouter } from 'next/navigation';
import { PostPurchaseSuccess } from '@/components/activation/PostPurchaseSuccess';
```

Dentro del componente `PostcardDetailPage`, después de los hooks existentes:
```tsx
const searchParams = useSearchParams();
const router = useRouter();
const justPaid = searchParams?.get('just_paid') === 'true';
const [showSuccess, setShowSuccess] = useState(justPaid);

const dismissSuccess = () => {
  setShowSuccess(false);
  // Limpiar el query param sin recargar
  router.replace(`/dashboard/postcard/${postcardId}`);
  // Refetch para tomar el is_activated actualizado
  if (postcardId) {
    fetch(`/api/postcards/${postcardId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) setPostcard(res.data);
      });
  }
};
```

Y al final del JSX, justo antes del cierre del componente:
```tsx
{showSuccess && (
  <PostPurchaseSuccess postcardId={postcardId} onDismiss={dismissSuccess} />
)}
```

- [ ] **Step 2: Verificación manual**

1. Abrir `/dashboard/postcard/<id>?just_paid=true` manualmente.
2. Ver overlay "Procesando tu pago...".
3. Activar la postal vía curl (Task 8) mientras está el overlay.
4. Confirmar que el polling detecta el cambio y muestra "¡Postal activada! 🎉".
5. Click en "Continuar": overlay se cierra, el query param desaparece de la URL, la página muestra el bloque "Compartir" (porque ahora is_activated=true).

Edge case: visitar `?just_paid=true` sin que se procese el webhook en 30s. Esperar y verificar que sale el mensaje de timeout.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/postcard/\[id\]/page.tsx
git commit -m "feat(dashboard): show post-purchase success overlay when just_paid=true"
```

---

## Phase 7: Configuración de Shopify

### Task 20: Snippet del Order Status Page

**Files:**
- Create: `docs/shopify/order-status-script.html`

- [ ] **Step 1: Crear archivo**

```html
<!--
  Pegar este snippet en Shopify Admin → Settings → Checkout → Order processing → Additional scripts.
  Lee postcard_id de los note_attributes de la orden y construye un botón + auto-redirect a Regaliz.

  Variables Liquid disponibles en Order Status Page:
    - {{ checkout.note_attributes }} en la Liquid del email/order
    - JS: Shopify.checkout.note_attributes
-->
<style>
  .regaliz-return-card {
    margin: 24px 0;
    padding: 24px;
    background: linear-gradient(135deg, #FFF5F2 0%, #FFEDE5 100%);
    border: 2px solid #F47B6B;
    border-radius: 12px;
    text-align: center;
  }
  .regaliz-return-card h2 {
    font-size: 20px;
    margin: 0 0 8px;
    color: #1a1a1a;
  }
  .regaliz-return-card p {
    color: #555;
    margin: 0 0 16px;
    font-size: 14px;
  }
  .regaliz-return-btn {
    display: inline-block;
    background: #F47B6B;
    color: #fff;
    text-decoration: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 15px;
  }
  .regaliz-return-btn:hover { background: #e36854; }
  .regaliz-countdown { font-size: 12px; color: #888; margin-top: 12px; }
</style>

<div id="regaliz-return-block"></div>

<script>
(function () {
  if (typeof Shopify === 'undefined' || !Shopify.checkout) return;

  var attrs = Shopify.checkout.note_attributes || [];
  var postcardAttr = attrs.find(function (a) { return a.name === 'postcard_id'; });
  if (!postcardAttr) return;

  var postcardId = postcardAttr.value;
  var returnUrl = 'https://regaliz.com.co/dashboard/postcard/' + encodeURIComponent(postcardId) + '?just_paid=true';

  var block = document.getElementById('regaliz-return-block');
  if (!block) return;

  block.innerHTML = ''
    + '<div class="regaliz-return-card">'
    +   '<h2>🎉 ¡Tu postal está activa!</h2>'
    +   '<p>Vuelve a Regaliz para ver tu experiencia AR y compartirla.</p>'
    +   '<a class="regaliz-return-btn" href="' + returnUrl + '">Ver tu postal activa →</a>'
    +   '<div class="regaliz-countdown" id="regaliz-countdown">Te llevaremos automáticamente en 8 segundos…</div>'
    + '</div>';

  var seconds = 8;
  var countdown = document.getElementById('regaliz-countdown');
  var timer = setInterval(function () {
    seconds -= 1;
    if (countdown) countdown.textContent = 'Te llevaremos automáticamente en ' + seconds + ' segundos…';
    if (seconds <= 0) {
      clearInterval(timer);
      window.location.href = returnUrl;
    }
  }, 1000);
})();
</script>
```

- [ ] **Step 2: Commit**

```bash
git add docs/shopify/order-status-script.html
git commit -m "docs(shopify): order status page snippet for return to regaliz"
```

---

### Task 21: Documentación de setup de Shopify Admin

**Files:**
- Create: `docs/shopify/setup.md`

- [ ] **Step 1: Crear archivo**

```markdown
# Configuración manual de Shopify para Regaliz

Estas tareas se hacen UNA SOLA VEZ en Shopify Admin. Si la tienda cambia o se reconfigura, repetir.

## 1. Webhooks de orden

1. Shopify Admin → **Settings** → **Notifications** → scroll a **Webhooks**
2. Crear 3 webhooks, todos con:
   - URL: `https://regaliz.com.co/api/webhooks/shopify`
   - Format: **JSON**
   - API version: `2025-01` (o la más reciente estable)
3. Topics a crear:
   - `Order paid` → `orders/paid`
   - `Order cancelled` → `orders/cancelled`
   - `Refund created` → `refunds/create`
4. **Importante**: al guardar el primer webhook, Shopify muestra una vez el **"webhook signing secret"** en una caja amarilla. Cópialo y guárdalo como variable de entorno:
   ```
   SHOPIFY_WEBHOOK_SECRET=<el-secret-mostrado>
   ```
   Si no lo copiaste a tiempo, hay que recrear los webhooks.

## 2. Order Status Page script

1. Shopify Admin → **Settings** → **Checkout** → scroll a **Order processing** → **Additional scripts**.
2. Copiar el contenido de `docs/shopify/order-status-script.html` y pegarlo en el textarea.
3. **Save**.
4. Para probar: completar una compra real (o de test), confirmar que en el Thank You page aparece el banner "🎉 ¡Tu postal está activa!" con botón y countdown.

## 3. Idioma y moneda

- **Settings** → **Store details** → confirmar moneda: `COP`.
- **Settings** → **Languages** → asegurar `Español` como idioma del checkout.

## 4. Verificación rápida de los productos

Los IDs de variante en el `.env.local` deben coincidir con la tienda:

```
SHOPIFY_VARIANT_AR_DIGITAL=51344446095638        # "Experiencia en Realidad aumentada"
SHOPIFY_VARIANT_POSTAL_BEIGE=51344445505814      # "Postal con realidad aumentada — Beige"
SHOPIFY_VARIANT_POSTAL_NEGRO=51344445538582      # "Postal con realidad aumentada — Negro"
```

Si los recreas, sus IDs cambian → actualizar el `.env.local` y redeploy.

## 5. requiresShipping

Verificado el 2026-05-27:
- `Experiencia en Realidad aumentada` → `requiresShipping=false` (no pide envío)
- `Postal con realidad aumentada` (Beige y Negro) → `requiresShipping=true` (pide envío)

Si modifican el producto, mantener esta configuración.
```

- [ ] **Step 2: Commit**

```bash
git add docs/shopify/setup.md
git commit -m "docs(shopify): manual setup guide for webhooks and order status script"
```

---

### Task 22: Prevenir borrado de postales activadas físicas

**Files:**
- Modify: `src/app/api/postcards/[id]/route.ts` (función `handleDeletePostcard`)
- Modify: `src/components/PostcardCard.tsx` (warning en el dialog de delete)

**Razón:** Una postal `fulfillment_type='physical'` ya pagada puede estar en proceso de impresión / envío. Borrarla rompe el rastro. Para digital, el borrado es ok (no hay logística atada).

- [ ] **Step 1: Bloquear el DELETE en la API para postales físicas activadas**

En `src/app/api/postcards/[id]/route.ts`, dentro de `handleDeletePostcard`, después del bloque que valida acceso y obtiene `postcard` (alrededor de las líneas 306-324), agregar antes del bloque de "Storage cleanup":

```ts
// Bloquear borrado si la postal está activada con fulfillment físico
if (postcard.is_activated && postcard.fulfillment_type === 'physical') {
  const detailedError = createDetailedError(
    'VALIDATION_ERROR',
    context,
    new Error('Cannot delete a postcard with an active physical order — contact support if you need to cancel.')
  );
  logError(detailedError);
  throw detailedError;
}
```

- [ ] **Step 2: Mostrar warning en el dashboard al intentar borrar**

En `src/app/dashboard/page.tsx`, en el componente `Dialog` de confirmación de delete (alrededor de las líneas 283-312), modificar el `DialogDescription` para incluir un warning condicional:

```tsx
<DialogDescription>
  {selectedPostcard ? (
    selectedPostcard.is_activated && selectedPostcard.fulfillment_type === 'physical' ? (
      <span className="text-red-600 font-medium">
        ⚠️ Esta postal tiene una orden física activa. No se puede eliminar mientras esté en proceso de envío. Si necesitas cancelarla, contáctanos.
      </span>
    ) : (
      <>¿Seguro que deseas eliminar &quot;{selectedPostcard.title}&quot;? Esta acción no se puede deshacer.</>
    )
  ) : (
    <>¿Seguro que deseas eliminar esta postal? Esta acción no se puede deshacer.</>
  )}
</DialogDescription>
```

Y deshabilitar el botón "Eliminar" cuando aplique:

```tsx
<Button
  variant="destructive"
  onClick={() => { if (pendingDeleteId) { handleDelete(pendingDeleteId); } }}
  disabled={
    !pendingDeleteId ||
    isDeleting ||
    (selectedPostcard?.is_activated === true && selectedPostcard?.fulfillment_type === 'physical')
  }
>
  {isDeleting ? 'Eliminando...' : 'Eliminar'}
</Button>
```

- [ ] **Step 3: Verificación manual**

1. Crear postal, activarla como `physical` (vía curl de Task 8 con `fulfillment_type: physical`).
2. En dashboard, click papelera: el dialog muestra el warning rojo y "Eliminar" está disabled.
3. Probar API directo: `curl -X DELETE -H "Cookie: ..." http://localhost:3000/api/postcards/<id>`. Expected: 400/422 con mensaje del bloqueo.
4. Para postal digital activada o no activada: borrado funciona normalmente.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/postcards/\[id\]/route.ts src/app/dashboard/page.tsx
git commit -m "feat(safety): prevent deletion of postcards with active physical orders"
```

---

## Phase 8: Verificación end-to-end

### Task 23: Plan de pruebas manuales end-to-end

**Files:**
- Create: `docs/shopify/e2e-test-plan.md` (opcional, solo para referencia del equipo)

- [ ] **Step 1: Ejecutar las pruebas siguientes en producción (o staging con Shopify real)**

1. **Setup previo**:
   - Asegúrate que `SHOPIFY_WEBHOOK_SECRET` está en producción.
   - Webhooks creados en Shopify Admin apuntando a producción.
   - Order Status Page script pegado en Shopify.

2. **Flujo digital ($15k)**:
   - [ ] Como usuario logueado, crea una postal (foto + video).
   - [ ] Espera a que `processing_status === 'ready'`.
   - [ ] En el detalle de la postal, ve el `ActivationCTA`.
   - [ ] Click en "Activar" del plan digital.
   - [ ] Eres redirigido a Shopify checkout: el carrito tiene "Experiencia en Realidad aumentada" $15k.
   - [ ] **Importante**: confirma que el checkout NO pide dirección de envío.
   - [ ] Completa el pago (Bogus Gateway o real).
   - [ ] En el Thank You page aparece el banner "Vuelve a Regaliz" + countdown.
   - [ ] El countdown te redirige a `/dashboard/postcard/<id>?just_paid=true`.
   - [ ] Ves el overlay "Procesando tu pago...". En menos de 30s pasa a "¡Postal activada!".
   - [ ] Click en Continuar. Ahora ves el bloque "Compartir" en lugar del CTA.
   - [ ] Abre `/ar/<id>` en otra pestaña: la AR funciona correctamente.

3. **Flujo físico ($30k) con color Negro**:
   - [ ] Crear otra postal. Esperar `ready`.
   - [ ] Click en "Comprar postal" con color Negro seleccionado.
   - [ ] Redirige a Shopify con variante Negro.
   - [ ] Checkout pide dirección de envío. Completar.
   - [ ] Pagar.
   - [ ] Volver a Regaliz. Activación confirmada.
   - [ ] En el detalle de postal, badge dice "Activa · Envío en camino".
   - [ ] En Supabase, `shipping_address` tiene los campos completos.

4. **Bloqueo de visitante**:
   - [ ] Como dueño, copiar el `/share/<id>` de una postal NO activada.
   - [ ] Abrir en navegación privada (sin login).
   - [ ] Ver pantalla "Tu regalo está siendo preparado".
   - [ ] Inspector de red: GET `/api/postcards/<id>` no retorna `image_url`, `video_url`, ni `nft_descriptors`.

5. **Refund**:
   - [ ] Desde Shopify Admin, hacer refund total de la orden digital.
   - [ ] Verificar en logs que el webhook llegó y procesó.
   - [ ] En Supabase, postal correspondiente queda `is_activated=false`.
   - [ ] `/ar/<id>` ahora muestra bloqueo de nuevo.

6. **Idempotencia**:
   - [ ] En Shopify Admin → Settings → Notifications → Webhooks → click en el botón "Send test notification" para `orders/paid`.
   - [ ] Verificar que llega y no rompe nada (probablemente la orden de test no tendrá note_attributes, debería loguear warning y retornar 200).
   - [ ] Reenviar el mismo evento: idempotencia evita re-procesar.

- [ ] **Step 2: Commit (sin archivos si no creas el doc)**

Si creaste el doc:
```bash
git add docs/shopify/e2e-test-plan.md
git commit -m "docs(shopify): end-to-end manual test plan"
```

---

## Resumen

Al completar todas las tareas tendrás:
- DB migrada con campos de activación + tabla de auditoría de webhooks
- 2 endpoints nuevos (`/api/checkout/create`, `/api/webhooks/shopify`)
- Endpoint existente `/api/postcards/[id]` ampliado con filtrado para no-dueños
- 4 componentes nuevos de activación (`ActivationCTA`, `ColorSelector`, `ActivationBadge`, `PostPurchaseSuccess`)
- 3 páginas modificadas (`/ar`, `/share`, `dashboard/postcard/[id]`)
- 2 docs de configuración manual de Shopify
- Flujo end-to-end verificado en pruebas reales

**Variables de entorno necesarias en producción**:
- `SHOPIFY_STORE_DOMAIN`
- `SHOPIFY_VARIANT_AR_DIGITAL`
- `SHOPIFY_VARIANT_POSTAL_BEIGE`
- `SHOPIFY_VARIANT_POSTAL_NEGRO`
- `SHOPIFY_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL`

**Configuración manual en Shopify Admin**:
- 3 webhooks (`orders/paid`, `refunds/create`, `orders/cancelled`)
- Order Status Page script
- Verificación de monedas / idioma
