# Decisiones de arquitectura (ADR)

Registro corto de decisiones ya tomadas y en produccion. Formato: contexto, decision, consecuencia. Si una decision crece y necesita alternativas discutidas, se promueve a su propio archivo.

## ADR-0001: precios en centimos y `formatCOP` como unico formateador

**Contexto:** la base guarda dinero en enteros y no admite decimales flotantes. La tienda mostraba precios 100 veces mayores porque formateaba el entero como pesos.
**Decision:** toda columna monetaria termina en `Cents` y guarda centimos de COP. La unica funcion que convierte a texto es `formatCOP` en `src/lib/constants.ts`, que divide por 100 y usa `Intl.NumberFormat("es-CO")`.
**Consecuencia:** `fmtCLP` se elimino. Ningun componente formatea dinero por su cuenta. Un precio nuevo que no pase por `formatCOP` es un defecto.

## ADR-0002: un solo umbral de envio gratis

**Contexto:** habia tres cifras distintas ($30.000 en el checkout, $250.000 en el home, y un banner heredado).
**Decision:** `FREE_SHIPPING_CENTS = 25_000_000` en `src/lib/constants.ts` es la unica fuente. El carrito, el producto, el footer y la politica de envio leen esa constante.
**Consecuencia:** cambiar el umbral es una linea. Cualquier texto que escriba el monto a mano se rechaza en revision.

## ADR-0003: `resolveHref` como traductor unico, con limite de ruta

**Contexto:** el editor de diseno acepta destinos en texto libre (`url:/algo`, `category:slug`, `product:handle`) y una ruta inexistente producia 404 publicado.
**Decision:** `resolveHref` en `src/lib/utils.ts` traduce todo destino. `KNOWN_ROUTES` e `isKnown` viven en el mismo archivo y comparan por path (sin query ni hash), exigiendo ruta exacta o limite `/`. `publishChecklist` usa `isKnown` sobre todos los links de widgets activos y la API de publicar responde 409 si alguno falla.
**Consecuencia:** el preview de `/admin/diseno` reutiliza `resolveHref`. No hay validadores duplicados en el cliente. `qa/design-links.test.ts` cubre rutas conocidas, lookalikes y el bloqueo.

## ADR-0004: sesion firmada HMAC, fail-closed, rol desde la cuenta

**Contexto:** la version anterior permitia elegir el rol en el login y usaba una clave compartida de admin.
**Decision:** el login recibe solo email y clave. El rol sale de `users.role` en la base. La cookie se firma con HMAC usando `CORALINA_SESSION_SECRET`; si falta el secreto, no se emite sesion y la API responde error en lugar de abrir. `CORALINA_ALLOW_UNSIGNED=1` es una excepcion explicita solo para desarrollo y no esta definida en Vercel.
**Consecuencia:** no hay escalada de rol desde el cliente. El logout borra la cookie y la identidad firmada. Las cuentas inactivas (`active = false`) no pueden iniciar sesion.

## ADR-0005: herramientas del agente ejecutadas sin `npx` en caliente

**Contexto:** el MCP de Playwright tardaba 44,5 s en arranque frio y 22 a 30 s aun caliente porque `npx` resolvia el paquete en cada arranque. El cliente MCP abortaba antes y el sintoma era "Not connected".
**Decision:** instalar `@playwright/mcp` global y lanzarlo como `node C:\Users\juanp_8h8f07l\AppData\Roaming\npm\node_modules\@playwright\mcp\cli.js` con `SystemRoot` y `PROGRAMFILES` en el entorno. `next-devtools-mcp` se deja declarado con `enabled: false` porque sus herramientas de runtime exigen Next 16 y este proyecto usa Next 15.
**Consecuencia:** arranque medido de 1,2 a 1,35 s. Si se actualiza el paquete, actualizar la ruta del `cli.js`. No volver a `npx` en la configuracion del MCP.

## ADR-0006: scripts one-off fuera de la raiz, migraciones sin versionar como deuda aceptada

**Contexto:** la raiz del repo acumulaba `_t4-migrate.mjs`, `_f4-create-user.mjs` y logs que no pertenecen al producto. `drizzle.config.ts` apunta a `out: "./drizzle"` pero esa carpeta no existe: el esquema se aplico con SQL manual contra Docker y Neon.
**Decision:** los scripts de una sola vez viven en `scripts/oneoff/` y no se ejecutan en build ni en CI. Se acepta la deuda de no tener migraciones versionadas, documentada en `docs/engineering/ESTADO_ORQUESTACION.md`.
**Consecuencia:** desplegar a una base nueva exige correr el SQL a mano. Antes de un segundo entorno serio (staging, segundo cliente, otro proveedor de base), generar el historial con `drizzle-kit` es requisito, no opcion.
