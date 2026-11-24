# Estado de orquestacion (append-only)

## 2026-11-23 - Balance general

**Codigo: listo. Negocio: vacio.**

Lo desplegado funciona y esta verificado en produccion: autenticacion por cuenta,
registro de clientes, panel de cliente, gestion de cuentas, dashboard con metricas
en hora de Bogota, tienda publica con precios correctos y el anti-slop aplicado.

Lo que falta no es codigo de producto: es carga de catalogo y las decisiones de
negocio que dependen de la duena (pago con tarjeta, devoluciones, avisos, respaldos).

### Verificado al 2026-11-23

- HEAD `671741d`, `main` sincronizado con origin, arbol limpio salvo `docs/design-system/`.
- Deploys recientes: READY (`671741d`, `0c002cf`, `506edd7`). Sin fallos recientes.
- Produccion: `/` 200, `/coleccion` 200, `/login` 200, login admin 200,
  `/admin/diseno` 200 (0 apariciones de `/catalogo`), `/catalogo` 404.
- `npx tsc --noEmit` 0; `bun qa/design-links.test.ts` 35 pass / 0 fail; `npm run build` 0.
- Base en produccion: catalogo y layouts vacios. `users` = 2. `customers` = 1 (huerfano).
  `audit_log` = 32 (ruido de pruebas).

### Deuda abierta (ordenada por impacto de negocio)

| Area | Deuda | Bloquea vender |
| --- | --- | --- |
| Catalogo | 0 productos, 0 categorias, 0 layout | Si |
| Pagos | Referencia manual, Bold pendiente | Si |
| Devoluciones | No existe flujo (Ley 1480 Colombia) | Si |
| Avisos | Sin correo ni WhatsApp al cliente | No, pero duele |
| Datos | Sin migraciones versionadas en `drizzle/` | No |
| Datos | Archivo a 24 h on-request, sin cron | No |
| Datos | Export de auditoria corta en 400 filas | No |
| Ops | Uploads en filesystem efimero | Si hay fotos subidas |
| Seguridad | Rate limit y throttle en memoria | No |
| Seguridad | Sin CSP con nonce | No |
| Seguridad | Sin 2FA | No |

## 2026-11-23 - Limpieza del workspace

Hecho:

- Archivado `_archive/2026-11-23/coralina-v1-a-v5-src-2026-11-23.zip`
  (450 archivos, 20,36 MB, verificado re-extrayendo): fuente de v1 a v5,
  dumps `app_db.sql`, `coralina_v4.sql`, `coralina_v5.sql`, el zip
  `coralina-store-development-plan.zip`, capturas de `_verify`,
  y `axe-tmp.png` huerfano de uploads.
- Borradas `v1`, `v2`, `v3`, `v4`, `v5` (incluye `node_modules` duplicados), `_verify`,
  `_backups`, y el residuo del template `nextjs-postgresql-template` en la raiz
  (`src`, `node_modules`, `.next`, `package.json`, `package-lock.json`, `tsconfig.json`,
  `next.config.ts`, `next-env.d.ts`, `postcss.config.mjs`, `eslint.config.mjs`,
  `drizzle.config.json`, `.env` vacio).
- Borrados 42 PNGs de capturas viejas en la raiz, logs (`build-r32.log`, `suite-run2.log`,
  `v6-server.log`, `vd.err`, `vd.out`) y `tsconfig.tsbuildinfo`.
- Espacio liberado: ~2.330 MB.

Queda en la raiz: `v6` (unico proyecto), `_archive`, `scripts`, `.opencode`,
`.playwright-mcp`, `AGENTS.md`, `README.md`.

Restaurar cualquier version borrada:

```powershell
Expand-Archive "_archive\2026-11-23\coralina-v1-a-v5-src-2026-11-23.zip" -DestinationPath "<carpeta>"
```

## 2026-11-23 - v6 a enterprise

- Raiz de `scripts/` ordenada: one-off movidos a `scripts/oneoff/`
  (`_f4-create-user.mjs`, `_t4-migrate.mjs`).
- `npm test` descubre `qa/*.test.ts` con `scripts/test-all.mjs` (17 archivos, antes 10).
- `npm run verify` = typecheck + test + build.
- `.env.example` completo con las 11 variables que el codigo lee.
- `README.md` reescrito, `SECURITY.md`, `CHANGELOG.md`, `.editorconfig`, `.nvmrc`.
- `docs/engineering/`, `docs/adr/`, `tools/verifications/` creados.
- Logs y `tsconfig.tsbuildinfo` sueltos dentro de `v6` borrados.
