# Coralina Store: dirección de diseño

> Este archivo es la fuente de verdad visual del proyecto. Si algo no está aquí, es propuesta
> pendiente y se marca `[POR DEFINIR]` o `[PROPUESTA]`. Nada se inventa como si fuera real.
> Nombre: dirección, no "DESIGN.md", porque la skill stitch-design-taste está suspendida por orden
> del usuario y no quiero que un agente la confunda con una salida de esa skill.

## 1. Qué es la marca (hechos verificados en el repo)

- Vende **trajes de baño / swimwear**.
- **Hecho a mano en Colombia** (footer, ValueStrip y copy del storefront ya lo dicen así).
- Piezas de **corte limpio** y **colores de atardecer** (copy del hero de respaldo).
- **Talla real por categoría**, con guía de tallas (`size_charts`) por categoría.
- Venta **online**, con pago por **referencia segura** (la pasarela Bold aún no está integrada).
- Despacho de **24 a 48 horas hábiles** en Colombia.
- **Envío gratis desde $250.000 COP**. Es el único umbral y no se repite otro distinto.
- Precios en **COP enteros**, sin decimales, sin "$" pegado al número dentro del texto.

## 2. Qué NO está confirmado (prohibido afirmarlo como hecho)

- Composición de la tela (italiana, % reciclado, UV50+): `[POR CONFIRMAR CON LA DUEÑA]`.
- Certificaciones de protección UV o de materiales: no existen, no se mencionan.
- Número de clientas, reseñas, estrellas, "4,9 de 5": no hay datos reales, no se escriben.
- Tiempo de retracto o cambios: `[POR CONFIRMAR]` antes de publicar una política.
- Tallas disponibles más allá de XS a L: `[POR CONFIRMAR]`.
- Contacto real (WhatsApp, correo, dirección, NIT): `[POR DEFINIR]`.

Regla: si un dato no está en este archivo ni viene del usuario, se escribe como `[POR DEFINIR]`
en el borrador y se pregunta. No se rellena con algo plausible.

## 3. A quién le habla

- Mujeres en Colombia, principalmente Bogotá y ciudades grandes, 22 a 45 años.
- Compran traje de baño por ocasión (viaje, piscina, primera vez con una marca propia), no por impulso semanal.
- Tienen miedo a la talla. Lo que las convence es la guía de tallas, la foto real de la pieza y el cambio sin pelea.
- Leen en el celular, con datos, en una pausa del día.

`[POR CONFIRMAR]` la ocasión dominante y el ticket que esperan. Mientras no haya dato, la marca no
promete "envío en 24 h" ni "el más vendido".

## 4. Dientes: ENERGY / RHYTHM / MOTION

| Diente     | Valor | Qué significa en Coralina                                                                 |
| --------- | ----- | ----------------------------------------------------------------------------------------- |
| **ENERGY** | 2     | Habla de frente, sin gritar. Frases cortas, verbos concretos, cero "elevá tu estilo".       |
| **RHYTHM** | 2     | Las secciones respiran distinto entre sí, pero no hay collage. Una sección ancha, una en dos columnas, una lista. No tres rejillas iguales seguidas. |
| **MOTION** | 2     | Movimiento por función: aparece al hacer scroll, responde al toque, marca el paso del carrito. Nada late en bucle. `prefers-reduced-motion` respetado siempre. |

Estos valores se escriben en cada entrega. Si una pantalla se siente plana, no se sube el diente
por decorar: se busca el punto focal que falta.

## 5. Paleta (propuesta, confirmar con la dueña)

Base: neutros cálidos de arena y tinta. Acento: un solo coral. Nada de azul a morado.

| Rol                  | Token              | Hex       | Uso                                                                 |
| -------------------- | ------------------ | --------- | ------------------------------------------------------------------- |
| Fondo base           | `--c-arena`        | `#F7F2EA` | Fondos de página, tablas, tarjetas en reposo.                        |
| Superficie elevada   | `--c-sal`          | `#FFFFFF` | Modales, tarjetas activas, campos de formulario.                    |
| Texto y estructura   | `--c-tinta`        | `#141C1A` | Texto principal, bordes fuertes, sidebar del admin.                 |
| Texto secundario     | `--c-tinta-60`     | `#5A635F` | Subtítulos, hints, metadatos. Mínimo 4,5:1 sobre arena.              |
| Acento               | `--c-coral`        | `#D9614C` | Un solo momento por pantalla: CTA principal, estado activo, alerta. |
| Acento profundo      | `--c-coral-700`    | `#A8432F` | Texto sobre coral claro, hover, foco.                               |
| Éxito                | `--c-verde`        | `#1F6F4A` | Confirmaciones. Texto sobre arena, no sobre coral.                  |
| Aviso                | `--c-ambar`        | `#8A5A00` | Pendientes, stock bajo.                                             |
| Error                | `--c-rojo`         | `#A4241B` | Fallos, acciones destructivas.                                     |

Reglas de color:
-  Components claros: arena y sal. Tinta para texto y estructura. Coral para **el** momento.
-  Coral nunca es texto pequeño sobre arena (no alcanza 4,5:1). Coral es relleno con texto tinta o sal.
-  Estados del sistema (éxito, aviso, error) no usan coral: usan verde, ámbar y rojo.
-  Degradados: solo si separan dos niveles de jerarquía reales. Prohibido degradado de página completa.
-  Máximo 3 colores visibles por pantalla además de los neutros.

## 6. Tipografía (propuesta)

- **Display**: `Fraunces` (serif variable, ejes suaves). Razón: el tono es artesanal y hecho a mano; una serif
  con carácter sostiene el titular del hero sin gritar.
- **UI y datos**: `Instrument Sans`. Razón: numerales claros y tabulares, lectura buena en 13 a 16 px,
  y no es la tipografía por defecto de todo modelo (Inter, Geist, Space Grotesk).
- Escala: 12, 14, 16, 18, 22, 28, 36, 48, 64. Salto de 1,25 en el cuerpo y 1,4 en el display.
- Cuerpo de texto: 16 px mínimo en el celular. Line-height 1,5 en cuerpo, 1,15 en titulares.
- Precios y cantidades: siempre `font-variant-numeric: tabular-nums`.
- Cargas: `next/font` local, sin CDN externo, sin FOUT.

`[POR CONFIRMAR]` si la marca ya tiene tipografías licenciadas. Si sí, mandan ellas y este bloque se
reescribe.

## 7. Geometría y ritmo

- Escala de espacio en 4: 4, 8, 12, 16, 24, 32, 48, 64, 96.
- Radios: 2 (chips), 6 (campos), 12 (tarjetas), 20 (modales). Prohibido el píldora universal.
- Elevación: nivel 0 plano, nivel 1 `0 1px 2px rgba(20,28,26,.08)`, nivel 2 `0 8px 24px rgba(20,28,26,.12)`.
  Una pantalla tiene como mucho dos elementos en nivel 2.
- Contenedor: 1200 px máximo, 12 columnas de escritorio, 4 de celular, gutter 24 / 16.
- Densidad: el admin es denso (filas 44 px, tablas con 12 px de padding vertical). La tienda respira
  (secciones de 96 px de aire arriba y abajo en escritorio, 56 px en celular).

## 8. Voz

- Español de Colombia. Tuteo neutro ("elige", "mira", "te queda"), no voseo.
- Frases cortas. Un verbo principal por frase.
- Se nombra lo concreto: la prenda, la talla, el precio, el plazo.
- Sin em dash. Sin signos de exclamación dobles. Sin mayúsculas de énfasis.
- Sin estas palabras: elevar, desbloquear, potenciar, robusto, integral, sinérgico, seamless,
  revolucionario, próximo nivel, "tu mejor versión", "experiencia única".
- Si no hay dato, se dice "te confirmamos por WhatsApp" y no se promete un número.

## 9. Lo que este proyecto no hace

- No vende con pasarela todavía: el pago es referencia segura revisada a mano.
- No promete envíos internacionales.
- No tiene programa de puntos ni suscripciones.
- No inventa reseñas, premios ni prensa.
- No usa video autoplay con sonido.
- No usa contadores de urgencia falsos ("solo quedan 2" cuando no es real).

Si una propuesta necesita alguna de esas cosas, no es una decisión de diseño: es un cambio de
alcance que se lleva al dueño.

## 10. Pendientes para cerrar esta dirección

1.  Datos reales de contacto y redes (WhatsApp, correo, Instagram).
2.  Logo y mark en vector, con versión clara y oscura, o confirmación de usar el wordmark actual.
3.  Confirmación de la paleta y de la tipografía propuestas, o marca real licenciada.
4.  Fotografía de producto propia (mínimo 6 piezas) o autorización para usar foto de banco.
5.  Política de cambios y devoluciones escrita y con fecha.
