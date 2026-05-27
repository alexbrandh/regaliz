# Plan de pruebas E2E — Shopify checkout integration

Ejecutar en producción (o staging con Shopify real) DESPUÉS de:
- Aplicar el deploy con los cambios
- Configurar el webhook en Shopify Admin (Settings → Notifications)
- Configurar el Order Status Page script (Settings → Checkout → Order processing)
- Asegurar que `SHOPIFY_WEBHOOK_SECRET` está como variable de entorno en producción

## Setup previo (una sola vez)

- [ ] `SHOPIFY_WEBHOOK_SECRET` en variables de producción
- [ ] Webhooks creados en Shopify apuntando a `https://regaliz.com.co/api/webhooks/shopify`
- [ ] Order Status Page script pegado en Shopify (Settings → Checkout)
- [ ] Productos verificados con `requiresShipping` correcto (digital=false, físico=true)

## 1. Flujo digital ($15.000 COP)

- [ ] Como usuario logueado, crear una postal (subir foto + video)
- [ ] Esperar a que `processing_status === 'ready'`
- [ ] Abrir el detalle de la postal — ver el `ActivationCTA` con dos opciones
- [ ] Click en "Activar" del plan digital
- [ ] Confirmar redirección a Shopify checkout con "Experiencia en Realidad aumentada" $15.000 en el carrito
- [ ] Confirmar que el checkout NO pide dirección de envío
- [ ] Completar el pago (Bogus Gateway en modo test, o tarjeta real)
- [ ] En el Thank You page aparece el banner "Vuelve a Regaliz" con countdown de 8 segundos
- [ ] El countdown redirige a `/dashboard/postcard/<id>?just_paid=true`
- [ ] Ver el overlay "Procesando tu pago..." → en menos de 30s aparece "¡Postal activada!"
- [ ] Click en Continuar → overlay desaparece, query param `?just_paid=true` se limpia
- [ ] Ahora se ve el bloque "Compartir" en lugar del CTA
- [ ] Abrir `/ar/<id>` en otra pestaña → la AR funciona correctamente

## 2. Flujo físico ($30.000 COP) con color Negro

- [ ] Crear otra postal, esperar `ready`
- [ ] Seleccionar color Negro en el CTA
- [ ] Click en "Comprar postal"
- [ ] Redirige a Shopify con variante Negro
- [ ] Checkout pide dirección de envío — completar
- [ ] Pagar
- [ ] Volver a Regaliz vía Order Status Page
- [ ] Activación confirmada
- [ ] El badge en el card del dashboard dice "Activa · Envío en camino"
- [ ] En Supabase, la fila de `postcards` tiene `shipping_address` con los campos completos

## 3. Bloqueo de visitante

- [ ] Como dueño, copiar el `/share/<id>` de una postal NO activada
- [ ] Abrir en navegación privada (sin login)
- [ ] Ver pantalla "Tu regalo está siendo preparado"
- [ ] Inspector de red: confirmar que `GET /api/postcards/<id>` NO retorna `image_url`, `video_url`, ni `nft_descriptors`

## 4. Refund

- [ ] Desde Shopify Admin, hacer refund total de la orden digital
- [ ] Verificar en logs de producción que el webhook llegó
- [ ] En Supabase, la postal correspondiente queda `is_activated=false`
- [ ] `/ar/<id>` ahora muestra el bloqueo de nuevo

## 5. Idempotencia

- [ ] En Shopify Admin → Settings → Notifications → Webhooks, click "Send test notification" para `orders/paid`
- [ ] Verificar que llega y no rompe nada (el test probablemente no tiene note_attributes, debería loguear warning y retornar 200)
- [ ] Reenviar el mismo evento — confirmar que la idempotencia evita re-procesar (200 OK duplicate)
