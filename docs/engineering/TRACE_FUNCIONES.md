# Trace de funciones (anti-reescritura)

Antes de crear una funcion, buscarla aqui. Si existe y resuelve el 80% del caso,
se reutiliza o se extiende. No se duplica.

## src/lib/constants.ts

| Funcion | Firma | Que resuelve |
| --- | --- | --- |
| `formatCOP` | `(cents: number) => string` | Centimos a pesos colombianos con Intl es-CO. Unico formateador de dinero. |
| `FREE_SHIPPING_CENTS` | `const` | Umbral unico de envio gratis (25_000_000 = $250.000). |
| `defaultWidgets` | `(mode) => WidgetInstance[]` | Widgets por defecto del home. |
| `defaultSections` | `() => SectionDef[]` | Secciones por defecto del home. |
| `OPERATIONAL_TAGS`, `TAG_FLOW`, `SHIPMENT_COLUMNS` | `const` | Catalogo de estados de pedido y envio. |

## src/lib/utils.ts

| Funcion | Firma | Que resuelve |
| --- | --- | --- |
| `resolveHref` | `(link: string) => string` | Traductor unico de destinos (`collection`, `category:x`, `product:x`, `url:X`). |
| `KNOWN_ROUTES` | `const` | Rutas internas que existen. |
| `isKnown` | `(href: string) => boolean` | Valida destino con limite de ruta; admite externos https. |
| `fmtDate`, `fmtDateTime` | `(input) => string` | Fechas en es-CO y hora de Bogota. |
| `cn` | `(...args) => string` | Clases condicionales. |
| `timeAgo`, `daysAgoISO` | varios | Relatividad temporal. |
| `slugify` | `(s: string) => string` | Slug de nombre. |
| `downloadCSV` | `(rows, filename) => void` | Descarga CSV en cliente (escapa formulas). |
| `contrastOk`, `contrastRatio` | WCAG | Contraste de color. |

## src/lib/design.ts

| Funcion | Firma | Que resuelve |
| --- | --- | --- |
| `publishChecklist` | `(layout) => ChecklistItem[]` | Bloquea publicar un home con destinos o banner invalidos revives. |
| `normalizeLayout`, `normalizeWidgets`, `normalizeBanner`, `normalizeSections` | normalizadores | Compatibilidad con layouts viejos (v4 y v5). |
| `denormalizeWidgets`, `denormalizeSections` | inverse | Persistir. |
| `applyWidgetsToSlide`, `readBanner` | helpers | Editor de diseno. |

## src/lib/orders.ts

| Funcion | Que resuelve |
| --- | --- |
| `createOrder` | Alta de pedido en transaccion, genera variantes, SKU, inventario, aplica promos y `usageCount++`. |
| `changeOperationalTag` | Transicion de tag con `SELECT FOR UPDATE`. |
| `archiveOldOrders` | Archiva pedidos de mas de 24 h (se evalua on-request). |
| `cancelOrder`, `reactivateOrder` | Cancelar y reactivar con reingreso de stock. |

## src/lib/metrics.ts

| Funcion | Que resuelve |
| --- | --- |
| `bogotaDayStart`, `bogotaMonthStart`, `bogotaDayKey` | Cortes de dia y mes en hora de Bogota (UTC-5, sin DST). |
| `buildByDay14` | Serie de 14 dias consistente con Bogota. |
| `buildOrderMetrics` | Agregados de pedidos: hoy, ayer, semana, mes, ticket, por tag. |

## src/lib/session-role.ts

| Funcion | Que resuelve |
| --- | --- |
| `encodeRole`, `decodeRole`, `getSessionRole` | Cookie de rol firmada (HMAC). |
| `encodeSessionIdentity`, `getSessionEmail` | Identidad de sesion firmada para self-guards. |

## src/lib/admin-auth.ts, login-throttle.ts, rate-limit.ts

| Funcion | Que resuelve |
| --- | --- |
| `assertAdminPassword` | Reautenticacion con `timingSafeEqual`. |
| `registerLoginFailure`, `isLoginBlocked` | Throttle de login (5 fallos / 15 min). |
| `rateLimit` | Limite global por IP (Map en memoria, TRUST_PROXY). |

## src/lib/users.ts, customers.ts, mi-cuenta.ts, validate-*.ts

| Funcion | Que resuelve |
| --- | --- |
| `hashPassword`, `verifyPassword` | scrypt con formato `<salt>:<key>`. |
| `findUserByEmail`, `touchLastLogin` | Cuenta y ultimo ingreso. |
| `upsertCustomerProfile` | Perfil de cliente por email (compartido con createOrder). |
| `listCustomerOrders`, `getCustomerOrder` | Pedidos del cliente por email de sesion (anti-IDOR). |
| `validateRegisterInput`, `validateProfileInput`, `validateUserAdminInput`, `generateTemporaryPassword` | Validacion pura de entradas. |

## Regla

Funcion nueva: se agrega aqui en el mismo commit. Sin entrada, no existe.
