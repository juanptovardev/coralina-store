# Changelog

Formato basado en Keep a Changelog. Versionado semantico una vez exista release publico.

## 0.6.0 - 2026-11-23 (sin release publico)

### Added

- Registro publico de clientes (`/register`, `POST /api/register`) con rol `cliente`.
- Panel de cliente `/mi-cuenta`: perfil, mis pedidos con detalle, cambiar clave,
  repetir pedido al carrito.
- Gestion de cuentas en admin (`/admin/usuarios` = "Cuentas"): listar, crear, editar,
  resetear clave, activar/desactivar, eliminar, con guards (no auto-borrado, ultimo admin,
  cuentas con pedidos).
- Identidad de sesion firmada para los self-guards del panel de cuentas.
- Cortes de dia y de mes en hora de Bogota en las metricas del dashboard.
- `docs/design-system/` (direccion, memoria del agente, guia de contenido visual,
  `tokens.css`, ejemplo de home).
- `docs/plantilla-carga-catalogo.md` en lenguaje llano y plantillas CSV en `docs/hoja-carga/`.
- `docs/engineering/`, `docs/adr/`, `tools/verifications/`, `SECURITY.md`, `CHANGELOG.md`.
- `scripts/test-all.mjs`: descubre y corre todos los `qa/*.test.ts`.
- `scripts/oneoff/`: scripts one-off fuera de la raiz del proyecto.

### Changed

- Login solo con correo y clave. El rol se toma de la cuenta. Se elimino el selector de rol (T1).
- Precios en COP correctos (antes se mostraban 100x por formatear centimos como CLP).
- Umbral de envio gratis unico: `FREE_SHIPPING_CENTS` ($250.000 COP).
- `resolveHref` es el unico traductor de destinos (tienda y preview del editor).
- Checklist de publicacion valida destinos reales con limite de ruta (no acepta `/coleccion-mal`).
- Footer de la tienda en Colombia, sin enlaces sociales muertos.
- Pase anti-slop de dashboard y tienda: sin datos inventados, sin ratings falsos,
  sin em dash en el copy visible, CTAs especificos.
- `npm test` ahora corre los 17 archivos `qa/*.test.ts`, no 10.
- `npm run verify`: typecheck + test + build en un comando.

### Removed

- Selector de rol y clave de admin compartida en el login.
- Ratings y testimonios fabricados en la home y el banner.
- Promo "Combo Marea" en los anuncios (no existia en la base).
- Newsletter que prometia 10% OFF sin backend.
- Rutas de `/catalogo` en el codigo: la ruta real es `/coleccion`.
- Versiones v1 a v5 del proyecto y material residual del workspace.

### Fixed

- Error boundary de `/admin` con base vacia (`getActiveLayout()` sobre 0 filas).
- Mojibake en textos del admin.
- Login bloquea usuarios desactivados.
- Botones por defecto del home apuntaban a `/catalogo` (404).
