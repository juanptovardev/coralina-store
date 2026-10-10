# Coralina Store v6 — Notas de operación (enterprise)

## Stack

- Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 5.9
- Drizzle ORM + `pg` sobre PostgreSQL (Docker: contenedor `coralina-postgres`, DB `coralina_v6`)
- Tailwind CSS 4 · sin CMS externo (promos, catálogo y home en la propia DB)

## Cómo correr

```powershell
# 1) Postgres
docker start coralina-postgres

# 2) Variables: copia .env.example → .env y ajusta valores

# 3) Dev (:3006) — no reiniciar si ya está corriendo
npm run dev

# 4) Checks
npm run typecheck
npm run build        # producción
npm run lint
```

## Variables de entorno

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión Postgres (Drizzle) |
| `NEXT_PUBLIC_SITE_URL` | URL pública del sitio (SEO/canónicas) |
| `CORALINA_ADMIN_PASSWORD` | Contraseña del rol admin (demo; default code: `coralina`) |

Ver `.env.example` (sin secretos reales).

## Modelo de seguridad

- **Cookie de rol demo**: `coralina_role` (`admin` | `asesor`) que emite `/api/admin/session`.
- **Middleware deny-by-default**: `src/middleware.ts` bloquea todo `/api/admin/*` con `401 { error }`
  salvo `/api/admin/session`. Sin cookie válida no hay API admin.
- **`CORALINA_ADMIN_PASSWORD`**: verificación extra en las mutaciones sensibles
  (`api/admin/{catalog,promos,orders,audit}`), con default `coralina` si no hay env.
- **Headers** (`next.config.ts`): CSP, HSTS, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`; `X-Robots-Tag: noindex`
  en `/admin` y `/dashboard`.
- **Rate limit en memoria**: `src/lib/rate-limit.ts` limita los POST públicos
  `/api/store` y `/api/cart/evaluate` a 30 req / 60 s por IP → `429 { error }`.
- **Errores JSON consistentes**: las rutas públicas devuelven siempre `{ error: string }`
  con status apropiado (400 input inválido, 409 conflicto, 429 rate limit, 500 fallo interno)
  y no tiran HTML 5xx por input malformado.

## Suites de QA (`qa/`)

| Suite | Qué valida | Cómo correrla |
|---|---|---|
| `qa/suite-v6.mjs` | Smoke multi-vértice (páginas, APIs, DB) | `node qa/suite-v6.mjs [baseUrl]` |
| `qa/suite-dashboard.mjs` | Endpoints y flujos del dashboard | `node qa/suite-dashboard.mjs [baseUrl]` |
| `qa/parity-engine.mjs` | Paridad motor server (`/api/cart/evaluate`), sin crear pedidos | `node qa/parity-engine.mjs [baseUrl]` |
| `qa/parity-drawer.ts` | Paridad drawer (client `evaluatePromos`) vs server, vía mapper real `getCatalog` | `bun qa/parity-drawer.ts` |
| `qa/ui-audit.mjs` | Auditoría de textos/botones/enlaces (dashboard + web) | `node qa/ui-audit.mjs [baseUrl]` |

- `baseUrl` por defecto `http://localhost:3006`.
- Requieren el dev server arriba y Postgres (`coralina-postgres`) accesible.
- Salida y estado del último run: `qa/last-run.log`, `qa/last-run.err`.
