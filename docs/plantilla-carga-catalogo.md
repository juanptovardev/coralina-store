# Hoja para cargar la tienda (Coralina)

Esta hoja es para llenar y enviar. No hace falta saber de tecnología.

**Tres pasos:** categorías, productos, página de inicio.

**Reglas sencillas**

- Precios: pesos colombianos, números enteros, sin decimales y sin "$". Ejemplo: `289000`.
- Si no tienes un dato, déjalo en blanco. Es mejor vacío que inventado.
- Las fotos las puedes subir después en el panel, o mandar el archivo por aquí.
- Esta hoja es para las personas. Abajo del todo está la referencia técnica, esa no la necesita nadie más.

---

## Paso 1. Las categorías

Las categorías son las cajas grandes de la tienda (por ejemplo "Bikinis", "Enterizos", "Accesorios"). Copia este bloque por cada categoría.

```
Categoría número 1

Cómo se llama:                (por ejemplo: Bikinis)
Dirección de la categoría:    (por ejemplo: bikinis, en minúsculas y con guiones)
Frase que la describe:        (una o dos frases. Si no hay, déjalo en blanco)
Foto de portada:              (archivo o link)
Orden en el menú:             (1 es el primero, 2 el segundo, y así)
```

**Sobre la dirección**: es el pedacito del enlace que dice `cat=bikinis`, dentro de `coralina-store.vercel.app/coleccion?cat=bikinis`. Si no la escribes, la creamos con el nombre, pero conviene revisarla antes de publicar.

### Guía de tallas (opcional, una sola vez por categoría)

Solo si tienen medidas de referencia. Sirve para que cada persona sepa qué talla elegir.

```
Categoría:                 (a cuál aplica)
Medidas en:                cm
Columnas (qué se mide):    Busto,  Cintura,  Cadera
Filas (una por talla, con los números en el mismo orden de las columnas):
  XS:  80,  60,  88
  S:   84,  62,  90
  M:   88,  66,  94
```

La talla (XS, S, M...) siempre es la primera columna, esa no se escribe en la lista de columnas.

---

## Paso 2. Los productos

Copia este bloque por cada producto y envíalo. Uno por mensaje o todos juntos, como prefieras.

```
Producto número 1

Nombre del producto:         (por ejemplo: Bikini Coralina Verde Palma)
Categoría:                   (a cuál pertenece, de las del paso 1)
Descripción corta:           (una o dos frases. Cómo se ve y de qué material es)
Precio:                      (pesos colombianos, número entero)
Precio tachado:             (solo si antes costaba más de verdad)
Estado:                      borrador  o  publicado
Palabras para encontrarlo:   (por ejemplo: bikini, verde, playa)
Fotos:                       (portada primero, las demás después)
Tallas y cuántas hay:
  XS:  0
  S:   0
  M:   0
  L:   0
  XL:  0
```

**Cosas que conviene saber**

- La categoría no se puede cambiar una vez guardado el producto. En el panel sale como "no editable al editar". Conviene revisarla antes de guardar.
- "En borrador" significa que se guarda pero no aparece en la tienda. Sirve para dejar todo listo y publicarlo de una vez.
- "Precio tachado" es el precio anterior, tachado en pantalla. Solo si ese precio existió de verdad.
- Para que un producto se vea en la tienda necesita al menos una foto y stock en por lo menos una talla.
- "Palabras para encontrarlo" no se ven en la página, sirven para buscar y para organizar. Se pueden dejar en blanco.

---

## Paso 3. La página de inicio

Es la primera pantalla que ve la gente. Dos partes: la franja grande de arriba y los bloques de abajo.

```
Franja de arriba (banner)

Antetítulo:            (línea corta, arriba del título)
Título:                (por ejemplo: El mar te queda bien)
Texto:                 (una frase)
Botón:                 (qué dice el botón, por ejemplo: Ver la colección)
A dónde lleva:         (a la colección, a una categoría o a un producto)
Foto:                  (opcional)

Bloques de abajo, en este orden:

1. Categorías
   Título del bloque:
2. Destacados
   Título del bloque:
3. Editorial
   Título del bloque:
   Texto:
4. Testimonios
   (solo si hay reseñas reales, ver más abajo)
5. Novedades (correo)
   Título del bloque:
   Texto:
6. Pie de página
   Texto:                  (datos de contacto, horarios, envíos)
```

**A dónde puede llevar el botón**

- A la colección completa
- A una categoría (por ejemplo "Bikinis")
- A un producto (por ejemplo "Bikini Coralina Verde Palma")

### Testimonios (opcional)

Solo reseñas reales de personas que compraron, y con su permiso. Si no hay, ese bloque no se muestra.

```
Nombre:            Ciudad:            Producto:
"Lo que escribió":                       Foto:
```

---

## Ejemplo completo (para que se vea cómo queda)

Esto es un ejemplo inventado, solo para que se entienda el formato.

```
Categoría número 1

Cómo se llama:                Bikinis
Dirección de la categoría:    bikinis
Frase que la describe:        Trajes de baño de corte limpio, hechos a mano en Colombia.
Foto de portada:              fotos/bikinis-portada.jpg
Orden en el menú:             1
```

```
Producto número 1

Nombre del producto:         Bikini Coralina Verde Palma
Categoría:                   Bikinis
Descripción corta:           Triangular con lazos ajustables, en tela de secado rápido.
Precio:                      289000
Precio tachado:              339000
Estado:                      borrador
Palabras para encontrarlo:   bikini, verde, playa
Fotos:                       fotos/bikini-verde-1.jpg, fotos/bikini-verde-2.jpg
Tallas y cuántas hay:
  XS:  2
  S:   4
  M:   5
  L:   3
  XL:  0
```

```
Franja de arriba (banner)

Antetítulo:            Colección Caribe 2026
Título:                El mar te queda bien
Texto:                 Vestidos de baño hechos a mano en Colombia.
Botón:                 Ver la colección
A dónde lleva:         la colección completa
Foto:                  fotos/banner-verano.jpg

Bloques de abajo, en este orden:

1. Categorías
   Título del bloque:     Compra por categoría
2. Destacados
   Título del bloque:     Lo más deseado
3. Editorial
   Título del bloque:     Hecho para el agua
   Texto:                 Cada pieza se corta y se arma a mano en nuestro taller.
4. Testimonios
   (más adelante, cuando haya reseñas reales)
5. Novedades (correo)
   Título del bloque:     Novedades de Coralina
   Texto:                 Todavía no enviamos correos. Cuando abramos la lista, te avisamos.
6. Pie de página
   Texto:                 Hecho en Colombia. Despacho de 24 a 48 horas hábiles.
```

---

## Lo que no hay que escribir

- Reseñas, estrellas o "4,9 de 5" si nadie las ha escrito de verdad.
- Cantidad de clientas o de ventas que no sabemos.
- "Envío gratis" si no aplica a ese producto. El envío gratis tiene un mínimo de $250.000 en todo el pedido.
- Botones que no llevan a ninguna parte, tipo "Ver más" o "Descubre".
- Datos de contacto inventados. Si no hay teléfono o dirección, se deja vacío.

---

## Cómo me la mandas

- Por WhatsApp o correo, tal cual, en varios mensajes si hace falta.
- O en un archivo de texto o de Excel con la misma estructura.
- Si te queda más fácil una tabla, ya hay tres archivos de Excel listos en la carpeta `docs/hoja-carga/`: `1-categorias.csv`, `2-productos.csv` y `3-pagina-inicio.csv`. Solo se llenan los huecos. Si al abrirlos en Excel las tildes se ven raras, ábrelos en Google Sheets o usa Datos > Obtener datos > Desde texto/CSV y elige UTF-8.

Cuando llegue, la cargo yo en el panel y te muestro cómo quedó antes de publicar.

---

# Referencia técnica (solo para el equipo)

Esta parte no la necesita quien llena la hoja. Se conserva para implementar y auditar.

## Tablas y columnas

- `categories`: `name*`, `slug*` (único), `description`, `imageUrl`, `sortOrder`, `createdAt`.
- `size_charts`: `categoryId*` (único por categoría), `unit` (cm), `columns*`, `rows*`, `updatedBy`, `updatedAt`.
- `products`: `title*`, `handle*` (único), `description`, `categoryId`, `status` (draft/published/archived), `priceCents*`, `compareAtCents`, `images[]`, `tags[]`, `createdAt`.
- `variants`: `productId`, `size`, `sku`, `active`, único por (`productId`, `size`). El array `sizes` que llega en el input de la API crea las filas de esta tabla.
- `inventory_levels`: `variantId` (FK a `variants.id`), `stocked`, `threshold`. El stock vive aquí, no en `products`.
- `home_layouts`: `name*`, `mode`, `status`, `banner*`, `widgets*`, `sections*`, `version`, `publishedAt`, `updatedAt`.
- `theme_tokens`: `key*` (único), `value`.
- `promotions`: `name`, `type`, `categoryIds`, `productIds`, `percent`, `amountCents`, `minQty`, `minSubtotalCents`, `comboPriceCents`, `priority`, `stackable`, `enabled`, `startsAt`, `endsAt`, `code`, `usageCount`.

## API `/api/admin/catalog`

Acepta: `action`, `name`, `description`, `imageUrl`, `inheritFromCategoryId`, `rows`, `columns`, `categoryId`, `unit`, `backfillVariants`, `title`, `priceCents`, `images`, `sizes`, `status`, `compareAtCents`, `tags`, `id`, `hard`, `confirmText`, `password`, `variantId`, `stocked`, `expectedUpdatedAt`, `threshold`, `variantIds`, `mode`, `value`.

## Panel y rutas

- Categorías `/admin/categorias`, productos `/admin/productos`, home `/admin/diseno`.
- Diseños: banner y props con `text`, `size`, `label`, `link`.
- Destinos de botón (`resolveHref` en `src/lib/utils.ts`): `collection` o `url:/coleccion` van a `/coleccion`; `category:slug` va a `/coleccion?cat=slug`; `product:handle` va a `/producto/handle`.
- Corregido (era un 404): los botones por defecto apuntaban a `url:/catalogo`, ruta que no existe. Ahora usan `url:/coleccion` en los tres puntos donde se generaban: `defaultWidgets` en `src/lib/constants.ts` (los botones "Comprar ahora" y "Ver colección"), el fallback de `normalizeWidgets` en `src/lib/design.ts` y el placeholder del editor en `src/app/admin/diseno/page.tsx`. La ruta real de la colección es `/coleccion` (`/coleccion?cat=slug` para una categoría, `/producto/handle` para un producto).
- Guía de tallas: `columns` es un arreglo de `{ key, label, type: "text" | "number", locked? }` y `rows` un arreglo de objetos `{ [key]: valor }`. La columna "Talla" se crea sola con `key: "size"` y `locked: true`.
- Umbral de envío: `FREE_SHIPPING_CENTS = 25_000_000` (=$250.000 COP), único punto de verdad.
- Precios: la base de datos guarda céntimos; formatear siempre con `formatCOP` de `src/lib/constants.ts`.
- Rutas públicas: `/`, `/coleccion`, `/producto/[slug]`, `/checkout`, `/login`, `/register`, `/mi-cuenta`.
