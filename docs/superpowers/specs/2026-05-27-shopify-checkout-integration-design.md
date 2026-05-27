# Diseño: Integración de Shopify Checkout para activar postales

**Fecha**: 2026-05-27
**Estado**: Aprobado por el usuario, pendiente de plan de implementación
**Autor**: Brainstorming guiado (Claude + alexbrandh@gmail.com)

## Contexto y objetivo

Regaliz permite a usuarios crear postales de realidad aumentada (subir foto + video, generar marcador NFT/MindAR). Hoy todo es gratuito. El objetivo es **monetizar la creación de postales** vendiendo dos productos ya configurados en Shopify:

| Producto Shopify | Precio | Qué incluye |
|---|---|---|
| Experiencia en Realidad aumentada | $15.000 COP | Activa el AR digital. El usuario imprime su propia foto. |
| Postal con realidad aumentada (Beige/Negro) | $30.000 COP | Activa el AR + imprimimos y enviamos la postal física. |

## Decisiones clave del diseño

| Decisión | Elección |
|---|---|
| Cuándo se paga | **Después de crear**: el usuario crea libre, paga para activar |
| Granularidad del pago | **Por postal**: cada postal requiere su propia compra |
| Relación entre productos | **Excluyentes**: digital O físico, no ambos para la misma postal |
| Comportamiento antes de pago | **Bloqueo limpio**: share link + AR público deshabilitados |
| Auth | **Clerk** (sin cambios), Shopify solo para el checkout |
| Tipo de checkout | **Hosted de Shopify** vía cart permalinks |

## Arquitectura

```
┌─ regaliz.com.co (Next.js 16) ────────────────────────────┐
│  1. Usuario crea postal (sin cambios respecto a hoy)  │
│  2. Postal queda con is_activated=false               │
│  3. Bloque "Activa tu postal" en página de detalle    │
│  4. Click → POST /api/checkout/create                 │
│  5. App valida + arma permalink + redirige a Shopify  │
└────────────────────────────┬──────────────────────────┘
                             ▼
              ┌──── Shopify hosted checkout ────┐
              │  • Pago (Wompi/MercadoPago/etc) │
              │  • Dirección (solo si físico)   │
              │  • Impuestos                    │
              │  • Email de confirmación        │
              └────────────────┬────────────────┘
                               ▼
                  ┌─ webhook orders/paid ─┐
                  │  Shopify → tu API     │
                  └──────────┬────────────┘
                             ▼
┌─ /api/webhooks/shopify ────────────────────────────────┐
│  • Valida HMAC                                          │
│  • Lee postcard_id del cart attribute                   │
│  • UPDATE postcards SET is_activated=true, ...          │
│  • (Opcional) Email al creador                          │
└─────────────────────────────────────────────────────────┘
```

## Modelo de datos

### Migración: tabla `postcards`

```sql
ALTER TABLE postcards
  ADD COLUMN is_activated         boolean      NOT NULL DEFAULT false,
  ADD COLUMN activated_at         timestamptz,
  ADD COLUMN fulfillment_type     text         CHECK (fulfillment_type IN ('digital','physical')),
  ADD COLUMN shopify_order_id     text         UNIQUE,
  ADD COLUMN shopify_order_number text,
  ADD COLUMN shipping_address     jsonb;

CREATE INDEX idx_postcards_shopify_order_id ON postcards(shopify_order_id);
```

Razones:
- `is_activated`: gate único que toda la app consulta para mostrar/ocultar el AR
- `shopify_order_id` UNIQUE: idempotencia (un webhook duplicado no procesa dos veces)
- `shipping_address` jsonb: solo se llena cuando `fulfillment_type='physical'`

### Migración: tabla `shopify_webhook_events`

```sql
CREATE TABLE shopify_webhook_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_event_id text UNIQUE NOT NULL,
  topic            text NOT NULL,
  payload          jsonb NOT NULL,
  processed_at     timestamptz,
  error            text,
  received_at      timestamptz NOT NULL DEFAULT now()
);
```

Sirve como log auditable de webhooks y como mecanismo de deduplicación por `shopify_event_id` (header `X-Shopify-Webhook-Id`).

## Flujo de checkout

### Endpoint: `POST /api/checkout/create`

**Request body**:
```ts
{
  postcardId: string;
  productType: 'digital' | 'physical';
  variantColor?: 'beige' | 'negro';  // requerido si productType='physical'
}
```

**Response**:
```ts
{ checkoutUrl: string }
```

**Lógica**:
1. Autentica con Clerk (`auth()`)
2. Busca la postal en Supabase
3. Valida:
   - Postal pertenece al usuario autenticado
   - `processing_status === 'ready'`
   - `is_activated === false`
4. Mapea `productType` + `variantColor` → `variantId`
5. Construye permalink:
   ```
   https://{SHOPIFY_STORE_DOMAIN}/cart/{variantNumericId}:1
     ?attributes[postcard_id]={postcardId}
     &attributes[user_id]={clerkUserId}
     &attributes[fulfillment_type]={productType}
     &return_to=/checkout
   ```
   Nota: el formato `/cart/{id}:1` usa el ID numérico del variante, no el GID completo.
6. Retorna la URL al frontend, que ejecuta `window.location.assign(checkoutUrl)`

### Variables de entorno necesarias

```
SHOPIFY_STORE_DOMAIN=2qvrgn-5u.myshopify.com
SHOPIFY_VARIANT_AR_DIGITAL=51344446095638
SHOPIFY_VARIANT_POSTAL_BEIGE=51344445505814
SHOPIFY_VARIANT_POSTAL_NEGRO=51344445538582
SHOPIFY_WEBHOOK_SECRET=<generado al registrar el webhook>
```

### Selección de color

Para el postal físico, el color se elige en Regaliz (no en Shopify) — el frontend envía `variantColor` al endpoint. Razones:
- Menos decisiones dentro del checkout = menos abandono
- Permite previsualizar el color sobre la imagen de la postal antes de pagar
- Más simple técnicamente

### Return URL / Regreso a Regaliz tras pagar

Shopify **no** redirige automáticamente fuera del Order Status Page después del pago — el cliente queda en `https://2qvrgn-5u.myshopify.com/.../thank_you`. Para llevarlo de vuelta a Regaliz tenemos dos mecanismos complementarios:

1. **Botón "Volver a Regaliz"** en el Order Status Page (Settings → Checkout → Order processing → Additional scripts). Insertamos un snippet HTML+JS que:
   - Lee `Shopify.checkout.note_attributes` para extraer `postcard_id`
   - Renderiza un botón grande "Ver tu postal activa →" que apunta a `https://regaliz.com.co/dashboard/postcard/{postcard_id}?just_paid=true`
2. **Auto-redirect opcional** después de 8 segundos en la misma página, vía JS, para evitar que el usuario se quede confundido en Shopify si no nota el botón.

El frontend de Regaliz detecta `just_paid=true` y hace polling al `GET /api/postcards/{id}` cada 2s hasta 30s esperando `is_activated=true`. Si después de 30s sigue inactiva, muestra "El pago se está procesando, refresca en un minuto" (caso raro de webhook lento).

**Nota importante para la implementación**: el snippet del Order Status Page se configura una sola vez en Shopify Admin y se guarda como parte del setup inicial. El código JS exacto debe quedar documentado en el repo (`docs/shopify/order-status-script.html`) para que sea reproducible si hay que reconfigurar la tienda.

## Webhook + seguridad

### Endpoint: `POST /api/webhooks/shopify`

Tópicos a registrar en Shopify:
- `orders/paid`
- `refunds/create`
- `orders/cancelled`

### Headers que se procesan

| Header | Uso |
|---|---|
| `X-Shopify-Hmac-Sha256` | Firma para validar autenticidad |
| `X-Shopify-Topic` | Identifica el evento |
| `X-Shopify-Webhook-Id` | Deduplicación |
| `X-Shopify-Shop-Domain` | Validación del dominio |

### Flujo

1. Leer body **raw** (no parseado): `const rawBody = await request.text();`
2. Validar HMAC con `crypto.timingSafeEqual`:
   ```ts
   const computed = crypto
     .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET!)
     .update(rawBody, 'utf8')
     .digest('base64');
   ```
   Si no coincide → `401 Unauthorized`
3. Validar `X-Shopify-Shop-Domain === SHOPIFY_STORE_DOMAIN`
4. INSERT en `shopify_webhook_events` (UNIQUE en `shopify_event_id`).
   Si falla por duplicado → `200 OK` (ya procesado, no reprocesar)
5. Parsear body, extraer `note_attributes` (donde Shopify guarda los cart attributes):
   ```ts
   const postcardId = body.note_attributes
     ?.find(a => a.name === 'postcard_id')?.value;
   ```
   Si no existe → log warning + `200 OK`
6. Despachar por topic:
   - `orders/paid` → activar postal
   - `refunds/create` → si reembolso total, desactivar; si parcial, ignorar
   - `orders/cancelled` → desactivar postal
7. UPDATE `shopify_webhook_events.processed_at`
8. Retornar `200 OK` en menos de 5s (Shopify reintenta hasta 19 veces durante 48h si falla)

### Reglas de seguridad

1. **HMAC obligatorio** con `timingSafeEqual` (anti timing attacks)
2. **Body raw** para verificar la firma (no JSON parseado por Next.js)
3. **Validar shop domain**
4. **Idempotencia doble**: `shopify_event_id` (eventos) + `shopify_order_id` UNIQUE (postales)
5. **No confiar en `user_id` del cart attribute** para autorización. La verdad vive en `postcards.user_id`. El `postcard_id` es la clave; el `user_id` es solo para logs.
6. **Secret en `.env`**, nunca en código

### Registro inicial del webhook

Manual una sola vez vía Shopify Admin → Settings → Notifications → Webhooks, o vía Admin API durante deploy. URL: `https://regaliz.com.co/api/webhooks/shopify`. Formato: JSON.

## Cambios en la UI

### `PostcardCard.tsx` (dashboard grid)

- Badge de estado nuevo:
  - `is_activated=false` → ámbar "Sin activar" + CTA "Activar"
  - `is_activated=true, fulfillment_type='digital'` → verde "Activa"
  - `is_activated=true, fulfillment_type='physical'` → verde "Activa · Envío en camino"
- Botón "Compartir" deshabilitado con tooltip mientras esté sin activar

### `dashboard/postcard/[id]/page.tsx`

Nuevo componente `<ActivationCTA />` cuando `is_activated=false`:

```
┌─────────────────────────────────────────────┐
│  ✨ Activa tu postal                         │
│                                              │
│  ┌────────────────┐  ┌─────────────────────┐│
│  │ Solo digital   │  │ Postal física + AR  ││
│  │  $15.000 COP   │  │  $30.000 COP        ││
│  │                │  │                     ││
│  │ Tú imprimes la │  │ La imprimimos y     ││
│  │ foto, el AR    │  │ enviamos a tu casa  ││
│  │ funciona       │  │  ○ Beige ● Negro    ││
│  │                │  │                     ││
│  │ [ Activar ]    │  │ [ Comprar postal ]  ││
│  └────────────────┘  └─────────────────────┘│
└─────────────────────────────────────────────┘
```

Cuando `is_activated=true`, esa sección se reemplaza por el bloque "Compartir" actual.

### Página post-pago: `?just_paid=true`

Nuevo componente `<PostPurchaseSuccess />`:
- Overlay con animación "🎉 ¡Postal activada!"
- Polling silencioso a `/api/postcards/{id}` cada 2s, hasta 30s
- Si `fulfillment_type='physical'`: muestra dirección de envío + "Llegará en 3-5 días hábiles"

### `ar/[postcardId]/page.tsx` y `share/[postcardId]/page.tsx`

Si `is_activated=false`:
- No cargar video ni iniciar AR
- Mostrar pantalla de bloqueo
  - Si el visitante es el creador (match con Clerk userId) → "Activa tu postal" + CTA
  - Si no → "Tu regalo está siendo preparado"

### `GET /api/postcards/[id]` (modificado)

- Devolver `is_activated`, `fulfillment_type`, `activated_at`
- **Filtrar datos sensibles** si `is_activated=false` y el caller NO es el creador:
  - Omitir `video_url`, `image_url`, `nft_descriptors`
  - Mantener solo `id`, `title`, `is_activated`
- Esto evita que un destinatario curioso descubra el contenido inspeccionando la red

## Componentes nuevos

| Componente | Propósito |
|---|---|
| `ActivationCTA.tsx` | Bloque grande con las dos opciones de compra |
| `ActivationBadge.tsx` | Badge de estado en `PostcardCard` |
| `PostPurchaseSuccess.tsx` | Overlay post-pago con polling |
| `ColorSelector.tsx` | Selector Beige/Negro para postal física |

## Endpoints nuevos

| Endpoint | Método | Propósito |
|---|---|---|
| `/api/checkout/create` | POST | Genera permalink y lo devuelve al frontend |
| `/api/webhooks/shopify` | POST | Recibe eventos de Shopify |

## Casos edge

| Caso | Comportamiento |
|---|---|
| Carrito abandonado | Postal queda inactiva indefinidamente. Usuario puede volver. |
| Pago rechazado | Sin acción — Shopify no envía `orders/paid`. |
| Reembolso total | Webhook `refunds/create` → `is_activated=false`. |
| Reembolso parcial | Ignorado. Postal sigue activa. |
| Orden cancelada | Webhook `orders/cancelled` → `is_activated=false`. |
| Borrado de postal pagada | Prevenir borrado si `is_activated=true` (warning explícito) — puede estar en impresión. |
| Webhook llega antes del regreso del usuario | Polling muestra éxito inmediato. |
| Webhook tarda >30s | Mensaje "el pago se está procesando, refresca en un minuto". |
| Doble click en "Activar" | Endpoint idempotente — si ya activada, retorna error; si en proceso, misma URL. |
| Variante sin stock | Shopify checkout lo rechaza. Mostramos error al regresar. |
| Email Shopify ≠ email Clerk | Irrelevante — `postcard_id` es la fuente de verdad. |

## Configuración previa requerida en Shopify

**Productos** (ya verificado, no requiere acción):
- Variante digital `51344446095638` → `requiresShipping=false` ✓
- Variantes físicas Beige `51344445505814` y Negro `51344445538582` → `requiresShipping=true` ✓

**A configurar al hacer deploy**:
1. **Webhook en Settings → Notifications → Webhooks**, apuntando a `https://regaliz.com.co/api/webhooks/shopify`, formato JSON, eventos:
   - `orders/paid`
   - `refunds/create`
   - `orders/cancelled`
2. **Guardar el `SHOPIFY_WEBHOOK_SECRET`** que Shopify entrega al crear el webhook → variable de entorno en el deploy de producción.
3. **Order Status Page script**: Settings → Checkout → Order processing → Additional scripts. Pegar el contenido de `docs/shopify/order-status-script.html` (botón "Volver a Regaliz" + auto-redirect en 8s usando `postcard_id` de `Shopify.checkout.note_attributes`).
4. Confirmar que el idioma del checkout esté en español y moneda en COP.

## Lo que NO se hace en este alcance

- Notificaciones por email custom (Shopify ya envía confirmación de orden)
- Panel de admin para ver órdenes (vive en Shopify Admin)
- Múltiples postales en una sola orden
- Suscripciones / créditos / planes
- Cupones de descuento (Shopify los soporta nativamente sin cambios en código)
- Upgrade de digital a físico después de pagar
- Tracking de envío dentro de Regaliz (vive en Shopify + email del transportista)
