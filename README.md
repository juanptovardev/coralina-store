# Coralina Store

Tienda e-commerce (Next.js 16 · App Router) con **storefront** y **panel de administración** (pedidos, envíos, catálogo, inventario, clientes, promociones, auditoría).

- **Stack:** Next 16.2.6 · React 19 · TypeScript · Tailwind 4 · Drizzle ORM + `pg` (PostgreSQL).
- **Storefront:** `/`, `/coleccion`, `/producto/[slug]`, `/checkout`.
- **Admin:** `/admin` (protegido). Login selector de rol + clave de admin.

---

## Requisitos

- Node.js 20+ y npm.
- [Bun](https://bun.sh) 1+ — **solo para los tests** (`npm test` ejecuta `bun qa/*.test.ts`).
- Un PostgreSQL (local o gestionado: Vercel Postgres/Neon, Supabase, etc.).

## Variables de entorno

Crea un `.env` (local) o configúralas en el host. Ver `.env.example`.

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Cadena de conexión PostgreSQL (`postgresql://user:pass@host:5432/db`). |
| `NEXT_PUBLIC_SITE_URL` | – | URL pública del sitio. |
| `CORALINA_ADMIN_PASSWORD` | ✅ en producción | Clave para acciones destructivas y login admin. **Sin default seguro en prod.** |
| `CORALINA_SESSION_SECRET` | ✅ en producción | Secreto HMAC que firma la cookie de sesión del admin. |
| `TRUST_PROXY` | ✅ en producción | `1` para confiar en `x-real-ip`/`x-forwarded-for` detrás de Vercel (rate-limit por IP). |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | – | Límite de peticiones por IP (default 30 / 60000 ms). |
| `RATE_LIMIT_ALLOW_LOCAL` | – | `1` exime loopback del rate-limit (solo QA local). |
| `SESSION_UNSIGNED` | – | `1` usa cookies sin firmar (solo QA local; avisa en prod). |

> El esquema (15 tablas) se aplica con Drizzle; los datos semilla se crean solos (`ensureSeeded`) en el primer request.

## Desarrollo local

```bash
npm install
npx drizzle-kit push        # crea/actualiza el esquema en DATABASE_URL
npm run dev                 # http://localhost:3000
```

Scripts: `npm run build` · `npm run start` · `npm run typecheck` · `npm run lint` · `npm test` (requiere Bun).

## Deploy en Vercel

1. **Sube este repo a GitHub** (o conecta el repo existente).
2. En Vercel: **Add New → Project → Import** el repo. Framework se detecta como **Next.js** automáticamente.
3. **Crea la base de datos**: Vercel → *Storage → Create Database → Postgres* (o un proyecto Neon/Supabase). Copia su `DATABASE_URL`.
4. **Environment Variables** (Production + Preview):
   - `DATABASE_URL` = la cadena de tu Postgres.
   - `TRUST_PROXY` = `1`
   - `CORALINA_ADMIN_PASSWORD` = tu clave
   - `CORALINA_SESSION_SECRET` = un string aleatorio largo
5. **Deploy**.
6. Aplica el esquema a la DB de producción: en local, con `DATABASE_URL` apuntando a la DB de Vercel, corre `npx drizzle-kit push`.

### ⚠️ Nota sobre Next 16

Algunos builders de Vercel han fallado con Next **16.2.6** al generar el segmento RSC de la página global-error (`ENOENT … _global-error.segments/__PAGE__.segment.rsc.func`). Si el build remoto falla por esto, la vía más segura es fijar una versión de Next ya soportada por Vercel (p. ej. `next@15.5.x`) — lo que además requiere volver de `src/proxy.ts` a `src/middleware.ts`.

## Seguridad

- Panel `/admin` protegido por cookie de sesión **firmada (HMAC)**; `/api/admin/*` es deny-by-default.
- Rate-limit en las fronteras públicas (`/api/store`, `/api/cart/evaluate`) y en el login admin.
- Cabeceras: CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.
- Nunca subas `.env` (está en `.gitignore`).
