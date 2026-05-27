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
