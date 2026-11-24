# Consistencia visual

Reglas que la tienda y el panel comparten. Si algo las rompe, es un defecto.

## Tokens

Fuente unica: `docs/design-system/tokens.css` y `src/app/globals.css`.
Nada de valores de color a mano en componentes; se usa la variable.

## Dientes

ENERGY 2 / RHYTHM 2 / MOTION 2.

- 2 significa presente pero contenido. No hay parallax, ni pin, ni scroll-jacking.
- Movimiento permitido: hover, transicion de 120 a 320 ms, aparicion breve de un
  estado. Nada en loop infinito.

## Color

Base: arena y sal (neutros calidos). Tinta para texto en tres pesos (80, 60, 30).
Coral 700 es el unico acento y solo en el momento clave: CTA principal, foco
visible, error de campo, estado activo del pedido.

Prohibido:

- Gradiente azul a morado como color base.
- Glow en mas de 2 elementos a la vez.
- Glass en navbar, cards, modal y sidebar al mismo tiempo.
- Mas de 3 colores de marca por pantalla.

## Tipografia

Fraunces para display (titulos, kicker). Instrument Sans para UI, cuerpo y datos.
Numeros de dinero con `tabular-nums`.

## Geometria

- Espacio en base 4 (`s1` a `s9`).
- Radio: `sm`, `md`, `lg`, `pill` solo en chips y avatares.
- Altura de fila de tabla: 44 px. Tap target minimo: 44 px.

## Foco y teclado

- `:focus-visible` con anillo de 2 px coral 700 y offset de 2 px.
- Nunca `outline: none` sin reemplazo.
- Modal cierra con Escape.

## Estados

Toda lista tiene cuatro pantallas, no una: vacio, cargando, error, lleno.
Vacio y error dicen causa y siguiente accion. "No hay datos" no es valido.

## Copy

- Sin em dash en el texto visible (guion largo U+2014).
- Sin cifras inventadas: reseñas, clientas, certificaciones, plazos.
- Sin botones genericos tipo "Descubrir" o "Explorar mas".
- Precios con `formatCOP`. Envio gratis solo desde `FREE_SHIPPING_CENTS`.
