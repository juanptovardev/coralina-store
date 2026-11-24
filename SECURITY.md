# Seguridad

## Como reportar

Escribe a la persona duena del proyecto con:

- que componente se ve afectado (ruta, API, pantalla),
- que ocurre (pasos para reproducir),
- impacto esperado,
- version o commit si lo conoces.

No abras issues publicos con un detalle explotable.

## Que proteger

- **Secretos**: `CORALINA_SESSION_SECRET`, `CORALINA_ADMIN_PASSWORD`,
  `DATABASE_URL` y las credenciales de Neon. Nunca en git, nunca en el cliente.
- **Cuentas del equipo**: `admin@coralina-store.com` y
  `asesor@coralina-store.com`. Cambiar clave de inmediato si se comparten.
- **Datos de clientes**: correo, telefono, direccion. No se usan para pruebas.

## Modelo de sesion

- Cookie de sesion con rol firmado por HMAC usando `CORALINA_SESSION_SECRET`.
- Sin secreto, produccion no autentica (fail-closed): 401.
- El rol se lee de la cuenta en la base y se refleja en la cookie firmada al login.
- La identidad del cliente en `/mi-cuenta` va en una cookie firmada aparte.
- Logout limpia las cookies.

## Controles que ya existen

- Reautenticacion con clave de admin + `timingSafeEqual` para acciones destructivas.
- Rate limit global por IP (y throttle por email en login).
- Magic bytes en uploads de imagen.
- Guards de admin en las rutas de mutacion de usuarios: no auto-borrado,
  no borrar el ultimo admin, no borrar cuentas con pedidos.
- Idempotencia en el endpoint publico de pedidos.

## Limites conocidos

- Rate limit y login throttle en memoria: por instancia, no distribuidos.
- Sin CSP con nonce.
- Uploads en filesystem efimero.
- Sin 2FA.
- Sin WAF propio (se depende de Vercel).

Estos limites estan anotados en el README y en `docs/engineering/ESTADO_ORQUESTACION.md`.
