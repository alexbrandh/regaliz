---
name: Admin redesign
description: Rediseño completo del panel de admin de Regaliz con nuevas secciones (Dashboard, Postales, Usuarios, Ajustes), gráficas, búsqueda con command palette y dark mode.
type: spec
---

# Rediseño del Admin — Regaliz

## Objetivo

Pasar de un único archivo de 1100 líneas (tabla densa + 7 stats cards + 8 botones por fila) a un panel de admin moderno con:

- **Navegación por secciones** (sidebar persistente)
- **Dashboard** con KPIs, gráfica temporal, top postales y actividad reciente
- **Postales** con tabs por estado, búsqueda/filtros, ordenamiento, paginación, vista tabla/grid, acciones consolidadas
- **Detalle de postal** con QR, timeline y acciones agrupadas
- **Usuarios** listado con métricas agregadas
- **Ajustes** con dark mode y logout
- **Command palette** (⌘K)
- **Toasts** en lugar de mensajes inline

## Decisiones

- **Stack**: reusar shadcn/ui (button, card, dialog, dropdown, badge, etc.), `next-themes`, `useToast` existente, `qrcode`. Sin nuevas dependencias.
- **Gráficas**: SVG inline (sparklines + line chart simple). Evita ~50KB de recharts.
- **Auth**: mantener password vía `checkAdminPassword` y sessionStorage. Centralizar en `AdminAuthProvider`.
- **API**: extender `/api/admin/postcards` con `page/limit/status/search/sortBy/sortDir` opcionales (backwards-compat); añadir `[id]` (GET+DELETE), `analytics`, `users`.
- **Tema**: light por defecto con paleta Regaliz ya definida en `theme.css`. Dark mode disponible.
- **Idioma**: todo en español neutro.

## Estructura de archivos

```
src/app/admin/
  layout.tsx          ← provider + shell + auth gate
  page.tsx            ← Dashboard
  postales/page.tsx   ← lista
  postales/[id]/page.tsx
  usuarios/page.tsx
  ajustes/page.tsx

src/app/api/admin/
  postcards/route.ts            ← extendido
  postcards/[id]/route.ts       ← NUEVO (GET+DELETE)
  postcards/[id]/media/route.ts ← existente
  postcards/[id]/mind-target/route.ts ← existente
  analytics/route.ts            ← NUEVO
  users/route.ts                ← NUEVO

src/components/admin/
  AdminShell.tsx, AdminSidebar.tsx, AdminTopbar.tsx, AdminLogin.tsx
  CommandPalette.tsx
  dashboard/KpiCard.tsx, TrendChart.tsx, TopPostcards.tsx, ActivityFeed.tsx
  postcards/StatusTabs.tsx, PostcardsFilters.tsx, PostcardsTable.tsx,
            PostcardsGrid.tsx, PostcardActions.tsx, StatusBadge.tsx,
            PreviewModal.tsx, EditMediaModal.tsx, ConfirmDialog.tsx
  users/UsersTable.tsx
  common/EmptyState.tsx, Skeleton.tsx

src/lib/admin/
  context.tsx  ← AdminAuthProvider + useAdminAuth
  api.ts       ← fetch helpers con inyección de password
  format.ts    ← formatDate, relativeTime, formatNumber
  status.ts    ← label/color/icon por estado
```

## Fases

1. **Cimientos** — context, shell, sidebar, topbar, login, theme toggle, layout
2. **Postales** — lista con tabs/filtros/sort/paginación/grid, acciones dropdown, modales reusados
3. **Dashboard + analytics API** — KPIs, charts, top, activity feed
4. **Detalle + Usuarios + APIs** — vista detalle, sección usuarios, DELETE endpoint
5. **Pulido** — command palette, skeleton loaders, empty states, ajustes
6. **Build + commit**

## Cambios de API (resumen)

**`POST /api/admin/postcards`** — extender request:
```ts
{ password, page?, limit?, status?, search?, sortBy?, sortDir?, userId? }
```
Response añade `meta: { total, page, limit, totalPages }`.

**`GET /api/admin/postcards/[id]?password=...`** — devuelve postal + user + view_count + ar_views recientes (timeline).

**`DELETE /api/admin/postcards/[id]`** body `{ password }` — borra postal + storage.

**`POST /api/admin/analytics`** body `{ password, days? }` — devuelve `{ daily: [{ date, created, views }] }` últimos N días (default 30).

**`POST /api/admin/users`** body `{ password }` — devuelve `[{ id, email, firstName, lastName, postcardCount, totalViews, lastActivity }]`.

## Riesgos

- Tabla `ar_views` puede no tener `viewed_at` indexada → query de analytics podría ser lenta. Mitigación: limitar a últimos 30 días y paginar postales.
- `clerkClient.users.getUser` en loop (N requests) → ya existe en código actual; usaremos `getUserList({ userId: [...] })` para batch en endpoints nuevos.
