# Plan de mejoras — Dashboard Coralina Store v6

**Fecha:** 2026-10-10
**Alcance:** dashboard/admin (`/admin/*`), tienda (checkout), lógica de backend, datos/analítica, seguridad/ops y funcionalidades nuevas.
**Método:** 4 auditorías en paralelo con subagentes, cada una con una lente distinta:
1. **UI/UX admin** — inventario de páginas, botones, estados y a11y.
2. **Lógica backend** — reglas de negocio, transacciones, integridad.
3. **Seguridad/Auth/Ops** — auth, superficie de ataque, operación.
4. **Data model/Analytics** — esquema, índices, métricas, integridad de reporting.

> Todo el trabajo se hace **in-place en v6**. No se toca v4/v5. La app ya está en producción (Vercel + Neon) y el deploy es por `git push` (integración Git de Vercel).

---

## 0. Resumen ejecutivo

El dashboard **funciona**, pero tiene tres familias de problemas:

- **Integridad de datos** (críticos): stock que se pierde al borrar un pedido, cupones que se auto-aplican, checkout sin idempotencia (doble submit = doble pedido), y **cero claves foráneas / cero índices** en la base.
- **Robustez de acciones** (altos): muchas **mutaciones no tienen estado de "guardando"** → doble submit; hay **guardados que muestran "ok" aunque fallen** (notas de pedido, job de envíos, crear promo); algunas confirmaciones destructivas son inconsistentes (`window.prompt`/`confirm()`).
- **Seguridad/ops** (críticos antes de clientes reales): el secreto de sesión cae a un default y `SESSION_UNSIGNED=1` en prod = cookie falsificable; sin logout ni sesiones revocables; sin migraciones versionadas; sin índices → consultas O(tabla completa).

**Recomendación:** ejecutar por fases. La **Fase 0 (bloqueantes)** es obligatoria antes de exponer la tienda a clientes reales.

---

## 1. Hallazgos consolidados por severidad

### 🔴 BLOCKER
| # | Hallazgo | Dónde | Fix |
|---|---|---|---|
| B1 | Cupones (`code`) se **auto-aplican** sin escribir el código | `lib/promo.ts:58-64` | Auto-aplicar solo promos **sin** `code`; si trae `code`, exigir match |
| B2 | `hard_delete` de un pedido **no cancelado** no repone stock | `api/admin/orders/route.ts:219-221` | `restoreStock` antes de borrar si `status !== 'canceled'` |
| B3 | **Cero claves foráneas** → huérfanos; `innerJoin` deja productos "invisibles" | `db/schema.ts:50,64,73,106,124,137` | Añadir FKs (`ON DELETE RESTRICT`) + índices |
| B4 | Checkout **sin idempotencia** → doble submit duplica pedido + stock | `lib/orders.ts:90`, `api/store/route.ts:70` | Idempotency-Key por checkout |
| B5 | Secreto de sesión cae a `CORALINA_ADMIN_PASSWORD`/default; `SESSION_UNSIGNED=1` en prod = **cookie sin firmar** (bypass total) | `lib/session-sign.ts:14` | Exigir `CORALINA_SESSION_SECRET` (≥32B) + hard-fail si `SESSION_UNSIGNED=1` en prod |
| B6 | `getActor()` **fail-open**: rol inválido → `'asesor'` | `lib/session.ts:23` | Devolver `null` y 401 |
| B7 | Sin **logout** ni sesiones revocables; una sola clave compartida, cookie 30d | `api/admin/session/route.ts` | Endpoint `DELETE` + tabla de sesiones (o al menos logout) |
| B8 | Sin **migraciones versionadas** (solo `drizzle-kit push`, destructivo) | `drizzle.config.ts` | `drizzle generate/migrate` + aplicar en deploy |

### 🟠 MAJOR — Lógica de negocio
- `createOrder` / `changeOperationalTag` **sin transacción** (`lib/orders.ts:148-221,226-287`).
- **TOCTOU** en `checkTagTransition` + `changeOperationalTag` (`orders/route.ts:26-34` + `orders.ts:231`).
- `update_product` **sin validación** (permite publicar precio 0/NaN) (`catalog/route.ts:237-257`); `create_product` no valida `categoryId` (`:176-197`).
- `buildCartLines` **no filtra `status='published'`** → borradores comprables por API (`lib/orders.ts:31-62`).
- Mover envío a **completado** no sincroniza el tag del pedido (`shipments/route.ts:70-92`).
- `canMoveShipment` permite **saltos no adyacentes** (`lib/domain.ts:64-78`).
- **Cancelar/reactivar sin transacción**; pedidos del seed nunca descontaron stock → cancelar infla inventario (`orders.ts:263-287`).
- **GET orders/shipments sin paginación** → payloads sin límite (`orders/route.ts:36-42`, `shipments/route.ts:13-22`).
- **Export CSV de auditoría** truncado en silencio a 400 filas (`audit/route.ts:51,53`).
- **Login/logout sin auditoría** (`session/route.ts:15`).
- **Promos**: sin acción *update*; sin `startsAt` (estado "programada" inalcanzable); `usageCount` nunca se incrementa (`promos/route.ts:57-171`).

### 🟠 MAJOR — UI/UX del dashboard
- **Sin estado "guardando"** (doble submit) en: pedidos (`L386/L292`), productos (`L146-175`), categorías (`L246/L302`), promos (`L144/L321`), diseño (`L408/L434/L448`), envíos job (`L177`).
- **Guardados silenciosos** que toastean "ok" aunque fallen: notas de pedido (`pedidos/L538`), job 24h (`envios/L149`), crear promo (`promos/L334`).
- **Eliminar promo** usa `confirm()` + `window.prompt` (`promos/L153-154`) en vez del `HardDeleteDialog` del resto.
- **Switch de rol** usa `window.prompt` nativo e ignora errores (`AdminShell/L39`).
- **Sin acción Editar** en productos.
- **Sin paginación/búsqueda debounced** en pedidos (tope 300), productos, inventario, auditoría.
- **CSV de inventario** sin entrecomillado → rompe con comas + **CSV-injection** (`inventario/L62`).
- `Skeleton`, `EmptyState`, `TableWrap` definidos pero **infrautilizados**.
- **a11y**: `Drawer`/`Modal` sin focus-trap/`role=dialog`/scroll-lock; filas no navegables por teclado; sin DnD por teclado.
- **Toast de un solo slot** (sin cola).

### 🟠 MAJOR — Seguridad/Ops
- CSP con `'unsafe-inline'` sin nonce (`next.config.ts:6`).
- Uploads confían en `file.type` (MIME del cliente), sin magic-bytes ni cuota (`uploads/route.ts:47`).
- Comparación de password **no constant-time** (`admin-auth.ts:20`).
- **Auditoría fuera de la transacción** y solo `console.error` (`audit.ts:24`).
- Rate-limit: sin `TRUST_PROXY` todos comparten bucket `'unknown'` (30/min global); con proxy, IP rotable (`rate-limit.ts:45`).
- **Reauth destructiva sin rate-limit propio** (brute-force con cookie válida).
- `health` sin detalle/liveness/uptime.

### 🟠 MAJOR — Data model/Analytics
- **Índices ausentes**: `orders(created_at)`, `orders(customer_id,status)`, `order_items(order_id)`, `shipments(order_id)`, `audit_log(created_at)`.
- **Bucketing de fechas** en hora local del server vs SQL (DST) y **dos implementaciones divergentes** (KPIs SQL vs métricas JS).
- **`seed` no descuenta stock** → KPIs inflados.
- **Sin timestamps de ciclo de vida** (`paid_at/canceled_at/completed_at`, `products.updated_at`, `promotions.updated_at`).
- **`order_items` sin `productId/categoryId`** → top productos requiere join en runtime.
- **Sin atribución de promo** (`orders.promo_id`) → ROI imposible.
- `orderCount` de clientes **incluye cancelados** mientras `ltv` no → KPIs inconsistentes (`customers/route.ts:89,77`).
- **Re-escaneo completo por request** (API carga todos los pedidos/clientes/envíos y agrega en JS).
- **`metrics.ts`**: KPI "Pedidos hoy" = rolling 24h vs barras = días naturales (no miden lo mismo).

### 🟡 MINOR (selección)
`reserved` muerto · tallas duplicadas → 500 · lock optimista compara ms JS · umbrales med/low inconsistentes · bounds de combo/minQty/endsAt sin validar · email sin formato · `bulk_tag` no atómico · N+1 en `orderItems` · `customers` total re-agrega · `metrics` descarta en silencio · inventario GET-only (mutaciones en catalog) · `await req.json()` sin catch → 500 · enum `status` sin validar en `update_product` · falta `upgrade-insecure-requests` · cookie sin `__Host-`/check Origin · `seed` `completedAt` fabricado · manuales/`no_enviar`/`pending` entran a revenue · `hard_delete` deja imágenes y hechos históricos huérfanos · sin CI · sin Sentry/OTel.

---

## 2. Plan por fases

### Fase 0 — Bloqueantes (pre-go-live) · obligatoria
**Objetivo:** que los datos y la seguridad sean confiables antes de clientes reales.
- [ ] B5/B6 — `CORALINA_SESSION_SECRET` obligatorio + hard-fail `SESSION_UNSIGNED` en prod; `getActor` fail-closed. **S**
- [ ] B7 — Logout (`DELETE /api/admin/session`) + invalidación de cookie. **S**
- [ ] B1 — Cupones `code` no se auto-aplican. **S**
- [ ] B2 — `hard_delete` repone stock si el pedido no estaba cancelado. **S**
- [ ] B3 — FKs + índices en `schema.ts` + **migraciones versionadas** (B8). **M**
- [ ] B4 — Idempotency-Key en checkout. **S**

**Done:** tests unit de promo/hard_delete/idempotencia en verde; no se puede emitir cookie sin firma en prod; `drizzle migrate` reproducible.

### Fase 1 — Integridad de lógica
- [ ] Transacciones en `createOrder`/`changeOperationalTag`/cancelar-reactivar. **M**
- [ ] `SELECT ... FOR UPDATE` en transiciones de tag (mata TOCTOU). **M**
- [ ] Validar `update_product`/`create_product` (precio, `categoryId`, enum `status`, tallas dedupe). **M**
- [ ] `buildCartLines` filtra `published` (o flag explícito en manual). **S**
- [ ] Mover a `completado` sincroniza el tag del pedido. **S**
- [ ] `canMoveShipment` solo adyacentes. **S**
- [ ] Paginación en GET `orders`/`shipments`; export CSV auditoría en streaming + no truncar. **M**
- [ ] Auditoría atómica (dentro de la tx) + audit de login/logout. **M**
- [ ] Promos: `update`, `startsAt`, incrementar `usageCount`. **M**

**Done:** suite backend en verde; concurrencia (2 requests) no duplica/restaura stock.

### Fase 2 — Dashboard (UI/UX y botones)
- [ ] **Busy/disabled + guard anti doble-submit en TODA mutación** (8 puntos). **M**
- [ ] Arreglar **guardados silenciosos** (notas pedido, job 24h, crear promo). **S**
- [ ] Unificar **confirmaciones destructivas** (`HardDeleteDialog`): promo, archivar producto, quitar fila/columna de tallas, reset de diseño. **S**
- [ ] Switch de rol con **modal + manejo de error** (no `window.prompt`). **S**
- [ ] **Edit de producto** (falta). **M**
- [ ] Paginación + búsqueda debounced (pedidos, productos, inventario, auditoría). **L**
- [ ] CSV de inventario **escapado** (anti-fórmula). **S**
- [ ] Usar `Skeleton`/`EmptyState`/`TableWrap`; **toast con cola**. **S**
- [ ] **a11y**: focus-trap + `role=dialog`/`aria-modal` + scroll-lock (Drawer/Modal), filas y DnD por teclado, labels. **L**

**Done:** doble-clic en cualquier acción no duplica; todo error se ve en pantalla; navegación por teclado básica.

### Fase 3 — Datos y analítica
- [ ] Índices (Fase 0) + **unificar bucketing en SQL** con TZ explícita; eliminar la doble impl SQL/JS. **M**
- [ ] Timestamps de ciclo de vida (`paid_at/canceled_at/completed_at`, `updated_at`). **M**
- [ ] `order_items.product_id/category_id` (con backfill). **M**
- [ ] `orders.promo_id` + `usageCount`. **S**
- [ ] KPIs **excluyen seed/manual/`no_enviar`/`pending`**; arreglar `orderCount` de clientes. **M**
- [ ] Gráficos: revenue/AOV trend, cancelación, top productos (una query por módulo). **M**
- [ ] Rollup diario por cron para el dashboard. **L**

**Done:** dashboard y API reportan los mismos números; consultas < 50ms con datos de prueba.

### Fase 4 — Enterprise / Ops
- [ ] Tabla `users` + hash (argon2/bcrypt) + sesiones revocables. **L**
- [ ] `timingSafeEqual` + rate-limit por actor en reauth; rate-limit distribuido (Redis/Upstash). **M**
- [ ] Sentry + logs estructurados (pino). **M**
- [ ] CI (typecheck+lint+unit+E2E) + staging; backups/DR Neon PITR + uptime. **L**
- [ ] CSP nonce; magic-bytes + cuota en uploads; health readiness. **M**
- [ ] 2FA TOTP. **M**

### Fase 5 — Funcionalidades nuevas (roadmap de producto)
Priorizadas por ROI/esfuerzo:
- **P0** · Devoluciones/reembolsos con reingreso de stock. **M**
- **P1** · Cron real para archivo 24h; carrier/tracking (campos ya existen); **editar promos + programar**; export CSV/JSON de pedidos y clientes; **alertas de stock bajo**; paginación+export de auditoría. **S/M**
- **P1** · Import CSV de productos/inventario + edición masiva de precios; **notificaciones de pedido** (email/WhatsApp). **M**
- **P2** · Segmentos guardados + etiquetas; **analítica** (cohortes/LTV/margen/ROI); **reservas de stock** (`reserved`); **papelera de pedidos** (soft-delete); GC de imágenes huérfanas; API tokens/webhooks. **M/L**

---

## 3. Criterio "Done" del plan
- Fase 0 y 1 en verde: tests unit + suite backend + concurrencia sin duplicados ni stock negativo.
- `suite-dashboard.mjs` sin FAIL (WARN tolerados) y `npm test` completo en verde.
- Ninguna mutación del dashboard permite doble submit; todo error visible en UI.
- Dashboard y API reportan el mismo revenue/pedidos (una sola fuente de métricas).
- Producción (Vercel) redesplegada y verificada tras cada fase.

## 4. Riesgos y notas
- **FKs sobre DB viva**: aplicar con migración + backfill y `ON DELETE RESTRICT`; validar datos huérfanos antes.
- **Seed infla KPIs**: limpiar/excluir datos demo del reporting (o descontar stock del seed).
- **Neon**: migraciones deben correr contra la DB de producción con cuidado (PITR como red).
- El deploy es por `git push`; cada fase = commits atómicos + verificación en producción.

## 5. Fuera de alcance (hoy)
Conversión (sesiones/carritos), multi-idioma/multi-moneda, marketplace, y cualquier re-arquitectura (DI/repositorios). No corresponde por ahora.
