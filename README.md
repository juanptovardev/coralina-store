# Coralina Store

Tienda en linea de trajes de bano hechos a mano en Colombia. Incluye tienda publica,
carrito y checkout, cuenta de cliente y un panel de administracion completo
(catalogo, inventario, pedidos, envios, clientes, promociones, diseno del home y equipo).

- Produccion: https://coralina-store.vercel.app
- Repo: privado (GitHub, cuenta juanptovardev)

## Stack

| Pieza | Version |
| --- | --- |
| Next.js (App Router) | 15.5.x |
| React | 19.2.x |
| TypeScript | 5.9.x |
| Drizzle ORM + `pg` | 0.45.x |
| Postgres | Neon (serverless) |
| Estilos | Tailwind CSS 4 |
| Tests | `bun` (runner propio) + CI en GitHub Actions |
| Deploy | Vercel |

## Requisitos

- Node.js 22 (ver `.nvmrc`)
- Bun, solo para correr los tests
- Una base de datos Postgres. Opcional: Docker local (`coralina-postgres`, DB `coralina_v6`)

## Arranque

```powershell
npm install
Copy-Item .env.example .env.local
# completa DATABASE_URL y CORALINA_SESSION_SECRET en .env.local
npm run dev
```

Abre http://localhost:3000

## Variables de entorno

Estan documentadas en `.env.example`. En produccion se configuran en Vercel
(Settings > Environment Variables).

Las dos obligatorias:

- `DATABASE_URL`: cadena de Postgres.
- `CORALINA_SESSION_SECRET`: firma de las cookies de sesion. Sin ella, produccion
  no autentica (fail-closed) y devuelve 401.

`CORALINA_ADMIN_PASSWORD` habilita las acciones destructivas (borrado duro, purga de
la bitacora) y nunca debe existir en el cliente.

## Scripts

| Comando | Que hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de produccion |
| `npm run start` | Sirve el build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Todos los `qa/*.test.ts` (descubre archivos, falla si alguno cae) |
| `npm run verify` | typecheck + test + build (lo que debe pasar antes de un push) |

Los tests corren con `bun`. Si no esta en el PATH, en Windows:
`C:\Users\<usuario>\AppData\Local\Kiro-Cli\bun.exe`

## Rutas

Publicas

- `/` home
- `/coleccion` catalogo (filtro `?cat=<slug>`)
- `/producto/[slug]` detalle
- `/checkout` cierre de compra

Cuenta

- `/login`, `/register`
- `/mi-cuenta` panel del cliente: perfil, mis pedidos, detalle, cambiar clave, repetir pedido

Admin (requiere rol admin o asesor)

- `/admin` resumen
- `/admin/pedidos`, `/admin/envios`
- `/admin/productos`, `/admin/categorias`, `/admin/inventario`
- `/admin/clientes`, `/admin/promos`
- `/admin/diseno` editor del home
- `/admin/usuarios` cuentas del equipo (admin y asesor)
- `/admin/auditoria`

## Roles

| Rol | Puede |
| --- | --- |
| `cliente` | Comprar, ver y editar su cuenta, ver sus pedidos |
| `asesor` | Operar catalogo, pedidos, envios, clientes, promos. No gestiona cuentas ni borra duro |
| `admin` | Todo, incluido cuentas y borrados definitivos |

El login es correo y clave. El rol sale de la cuenta guardada, no del navegador.
El registro publico crea siempre `cliente`.

## Carga de catalogo

1. Lee `docs/plantilla-carga-catalogo.md` (version en lenguaje llano).
2. Usa las plantillas de Excel en `docs/hoja-carga/`.
3. Carga las categorias con su guia de tallas, luego los productos, y al final publica el home.

Reglas de dinero: los precios se guardan en centimos de COP y se formatean con
`formatCOP` (`src/lib/constants.ts`). El umbral de envio gratis es unico:
`FREE_SHIPPING_CENTS` ($250.000 COP).

## Diseno

`docs/design-system/` contiene la direccion (marca, dientes, paleta, tipografia),
la memoria para el agente de diseno, la guia de estructuracion de contenido,
`tokens.css` y un ejemplo de home lleno.

## Verificacion antes de publicar

```powershell
npm run verify
```

Y en produccion:

```powershell
curl.exe -s -o NUL -w "%%{http_code}`n" https://coralina-store.vercel.app/
curl.exe -s -o NUL -w "%%{http_code}`n" https://coralina-store.vercel.app/coleccion
curl.exe -s -o NUL -w "%%{http_code}`n" https://coralina-store.vercel.app/login
```

## Limitaciones conocidas

- Los uploads de imagenes viven en el filesystem de la app. En serverless eso es
  efimero y no sobrevive entre instancias. Falta storage externo (S3, R2, Blob).
- El rate limit y el throttle de login estan en memoria: se reinician por instancia.
  Sin Redis o Upstash no hay conteo compartido ni 429 garantizado.
- Sin CSP con nonce (la app usa `unsafe-inline` para estilos y scripts propios).
- El archivo automatico de pedidos a las 24 h se evalua cuando llega una peticion.
  No hay cron, asi que un pedido puede archivarse con retraso.
- El export de auditoria corta en 400 filas.
- No hay avisos automaticos de pedido por correo ni WhatsApp.
- El pago es por referencia manual (Bold aun no esta conectado).
- No hay migraciones versionadas en `drizzle/`. El schema se aplica con scripts one-off
  en `scripts/oneoff/`.

## Estructura

```
v6
├─ src/app            rutas (pubblico, cuenta, admin, api)
├─ src/components     store, storefront (preview), admin, shared
├─ src/db             schema y cliente Drizzle
├─ src/lib            logica de dominio (orders, metrics, catalog, session, utils)
├─ qa                 tests bun de las funciones puras y guards de codigo
├─ docs
│  ├─ design-system   direccion, memoria del agente, tokens
│  ├─ engineering     proceso (orquestacion, batches, estado, trace)
│  ├─ adr             decisiones de arquitectura
│  └─ hoja-carga      plantillas CSV
├─ scripts            one-off y utilidades operativas
└─ tools/verifications dossiers de cierre por etapa
```

## Licencia

Codigo privado. Todos los derechos reservados.
