# Guía de estructuración de contenido visual: Coralina Store

> Cómo pasa una idea ("quiero que la home se vea bonita") a un árbol de contenido que el agente de
> diseño pueda llenar sin inventar datos y que el código pueda renderizar sin adivinar.
> Regla de oro: primero el contenido y su jerarquía, después la estructura, y el estilo al final.

---

## 1. Los cinco niveles

Todo lo que el agente produce vive en uno de estos niveles. No se mezcla.

| Nivel        | Qué es                                                                 | Quién lo decide  |
| ------------ | ---------------------------------------------------------------------- | ---------------- |
| **Marca**    | Identidad, audiencia, tono, dientes, tokens globales.                   | El dueño         |
| **Página**   | Un objetivo por ruta (`/`, `/coleccion`, `/producto/[slug]`).            | El dueño         |
| **Sección**  | Un bloque de sentido con propósito propio (hero, prueba, cierre).      | Diseño           |
| **Bloque**   | Un grupo repetible dentro de la sección (tarjeta, fila, columna, paso). | Diseño + código  |
| **Elemento** | Un dato u objeto concreto (título, botón, foto, badge real, precio).    | Contenido        |

Cada nivel tiene un nombre estable y un ID en el árbol. Si un elemento no se puede nombrar sin una
frase hecha ("la cosa esa de arriba"), no está listo para entrar.

## 2. La ficha obligatoria por nodo

Estos 16 campos son la unidad de trabajo. Los que no aplican se escriben `n/a`, no se borran.

| Campo             | Qué se escribe                                                                 |
| ----------------- | ------------------------------------------------------------------------------ |
| `id`              | Ruta estable: `home.hero.title`, `pdp.sizes.row`. Nada de `caja1`.               |
| `nivel`           | Marca, página, sección, bloque o elemento.                                     |
| `proposito`       | Una frase. Para qué existe. Si no se puede, se borra.                          |
| `decision`        | Qué decide la persona al verlo o tocarlo.                                      |
| `jerarquia`       | Primario, secundario, terciario, utilería. Un solo primario por pantalla.       |
| `contenido`       | Texto real, o `[POR DEFINIR]` con la pregunta. Nada de lorem ni de "Coralina exquisita". |
| `variante`        | Nombre de la variante visual: `hero-imagen`, `tarjeta-producto-lista`.          |
| `estados`         | inicial, vacio, cargando, error, sin-permiso, exito. Con su texto.              |
| `link`            | Destino real de la sección 7 de la memoria, o `url:` externa, o `n/a`.          |
| `assets`          | Qué imagen o icono. Con `[POR DEFINIR]` si no hay foto de producto.             |
| `tokens`          | Variables CSS que usa. Ningún hex suelto.                                      |
| `responsive`      | Qué cambia a 360, 768, 1024, 1440. Móvil primero.                               |
| `a11y`            | Rol, nombre accesible, orden de foco, contraste, teclas.                        |
| `reglas`          | R-XX de la memoria que aplican.                                                |
| `no_hace`         | Lo que esta pieza no hace (evita malas implementaciones).                       |
| `aceptacion`      | 2 a 4 comprobaciones binarias: qué se ve o qué responde si funciona.           |

## 3. El árbol en texto (formato de entrega)

```
coralina
├─ home                       propósito: mostrar la colección y llevar a una pieza
│  ├─ hero                   una sola decisión: Ver la colección
│  │  ├─ kicker              "Colección Caribe 2026"            [texto]
│  │  ├─ title               "El mar te queda bien"            [texto]
│  │  ├─ subtitle            "Trajes de baño hechos a mano en Colombia."
│  │  ├─ cta_primario        "Ver la colección" -> /coleccion   [foco único]
│  │  └─ imagen              ratio 4:5, alt con prenda y color  [asset]
│  ├─ categorias             máximo 6, con foto real o sin foto
│  ├─ destacados             máximo 4 piezas publicadas
│  ├─ editorial              "Hecho para el agua" + cuidado de la tela
│  ├─ testimonios            oculto si no hay testimonios reales
│  └─ newsletter             oculto si no hay backend
├─ coleccion                  propósito: que encuentre su talla rápido
│  ├─ filtros                categoría, talla, precio
│  ├─ grid                   tarjeta de producto
│  └─ vacio                  "Todavía no hay piezas publicadas. ..."
├─ producto/[slug]            propósito: decidir talla y comprar
│  ├─ galeria
│  ├─ ficha                  precio, guía de tallas, stock real
│  ├─ envio                  "Envío gratis desde $250.000" + 24 a 48 h
│  └─ cta                    "Agregar al carrito · $249.000"
├─ checkout                   propósito: cerrar el pedido sin duda
│  ├─ resumen
│  ├─ form                   nombre, correo, teléfono, ciudad, dirección
│  └─ pago                   referencia segura (no pasarela)
└─ admin
   ├─ resumen (/)            qué pasó hoy y qué resolver
   ├─ pedidos                tabla densa, filtros, paginación
   ├─ productos              listado y edición
   ├─ cuentas                /admin/usuarios
   └─ diseño                 preview del home
```

## 4. Reglas de estructura

1. **Una decisión por sección.** Si una sección quiere que la persona vea, compare y compre, son tres.
2. **Orden por fricción, no por gusto.** La objeción más caras primero: talla, tela, precio, envío, confianza.
3. **Máximo 6 elementos por bloque.** Más de eso deja de leer.
4. **Repetición con variación.** Dos secciones seguidas no pueden tener la misma composición (RHYTHM 2).
5. **Un solo punto focal por pantalla.** El resto baja de peso o de tamaño, nunca los dos a la vez.
6. **Ningún elemento huérfano.** Si un título, botón o imagen no puede explicarse con la ficha, se corta.
7. **Todo bloque de datos nace con vacío, cargando y error.** Se escriben antes de que el bloque exista.
8. **El admin es tabla y decisión, no tarjetas y decoración.** La tienda sí puede respirar.

## 5. Nombres

- `id`: minúsculas, punto por nivel, sin números de versiones: `home.hero.cta_primario`.
- Variante: `kebab-case` con el nombre visual, no con el de la tecnología: `hero-texto-izquierda`.
- Archivo de sección: `home.hero.tsx`, `collection.grid.tsx`, `pdp.galeria.tsx`.
- Token: `--c-` color, `--s-` espacio, `--r-` radio, `--t-` tipografía, `--e-` elevación, `--m-` movimiento.
- Prohibido: `Card2`, `NewHero`, `divPrincipal`, `componente`, `final`, `v2`.

## 6. Assets

### 6.1 Imágenes de producto
- Mínimo por pieza: frontal en fondo claro, espalda, y una de detalle del tejido o costura.
- Un solo fondo para todo el catálogo. Nada de la foto en la playa como principal.
- Proporción 4:5 en vertical. Encuadre completo de la prenda, sin cortar el tirante en la principal.
- Peso: 1600 px de ancho máximo, WebP o AVIF, menos de 250 KB por foto.
- Nombre: `{categoria}-{producto}-{vista}-{color}.webp`, todo en minúsculas.
- Texto alternativo: "Bikini Coralina verde palma, vista frontal" y no "img1234".

### 6.2 Si no hay fotos reales
- No se usa foto de banco ni imagen generada como si fuera la prenda.
- Se usa una lámina de color de la marca con el nombre de la pieza y la leyenda "foto pendiente".
- Se pide la foto antes o después, nunca se finge.

### 6.3 Categorías y editorial
- Categoría: 3:ius2 o 4:3, con la prenda y su temperatura de color. Sin collage de 4 modelos.
- Editorial: 16:9 en horizontal, 4:5 en móvil. Se entregan dos recortes, no un mismo archivo estirado.

## 7. Estados (obligatorios y con la conversación completa)

Cada bloque que pinta datos trae sus seis estados escritos:

| Estado     | Qué dice y qué ofrece                                                                    |
| ---------- | ---------------------------------------------------------------------------------------- |
| inicial    | datos reales, y si vacío, pasa al estado vacío.                                          |
| vacio      | por qué está vacío y la acción que lo llena. "Aún no hay pedidos hoy. ..."         |
| cargando   | qué está cargando, con esqueleto de la forma final, no spinner en el centro de la nada. |
| error      | qué falló, si se pierden datos y el botón "Reintentar".                                   |
| sin-permiso| qué rol hace falta y el enlace a la pantalla que sí puede.                               |
| exito      | qué quedó guardado y a dónde sigue. Sin "operación exitosa".                              |

Un vacío no es un error. Un error no es un vacío. Un sin-permiso no es un vacío. Tres pantallas
distintas y tres textos distintos.

## 8. Imágenes técnicas: verificación binaria

Cada asset se acepta o se devuelve:

- [ ] ¿Existe el archivo y se ve a su tamaño real, no en una miniatura de 80 px?
- [ ] ¿El texto alternativo describe la prenda y la vista, no la marca?
- [ ] ¿Tiene los dos recortes (escritorio y móvil) cuando la sección los pide?
- [ ] ¿Pesa menos que el límite y usa WebP o AVIF?
- [ ] ¿Si el archivo no carga, el hueco tiene color y nombre en vez de un link roto?
- [ ] ¿La imagen no muestra a una persona o marca que no tengamos autorizada?

## 9. Del contenido al árbol: ejemplo lleno

Pedido: "la tienda abre con la colección Caribe 2026".

```
home
├─ hero
│  ├─ proposito: la persona entiende la colección y va a verla
│  ├─ nivel: sección            jerarquia: primario
│  ├─ decision: "toca Ver la colección"
│  ├─ contenido:
│  │  ├─ kicker: "Colección Caribe 2026"
│  │  ├─ title: "El mar te queda bien"
│  │  ├─ subtitle: "Vestidos de baño hechos a mano en Colombia.
│  │  │              Tela italiana, secado rápido y tallaje real."
│  │  └─ cta: "Ver la colección" -> url:/coleccion
│  ├─ assets: [POR DEFINIR: foto de la pieza 1 en 4:5, fondo claro]
│  ├─ tokens: --c-arena, --c-tinta, --c-coral (solo el CTA), --t-display
│  ├─ responsive: 360 apila texto y botón sobre imagen 4:5; 1440 dos columnas 5/7
│  ├─ a11y: imagen con alt; sin texto en la imagen; orden del DOM texto antes que foto
│  ├─ estados: vacio (sin layout) = hero de respaldo con la misma copia
│  ├─ reglas: R1, R3, R4, R7, R9, R13
│  ├─ no_hace: no promete envío gratis, no dice "4,9 de 5", no cierra con "descubre más"
│  └─ aceptacion: dedo en móvil llega al botón sin zoom; el botón lleva a /coleccion con 0 piezas
└─ ...
```

Nota: el ejemplo usa la copia que ya está en el repo, no datos nuevos. La foto queda pendiente y se
declara pendiente.

## 10. Cómo se revisa una entrega (5 minutos, sin opinar)

1.  ¿Cada `contenido` es un hecho de la memoria o un `[POR DEFINIR]` con pregunta? Si hay un dato
    plausible inventado, devuelta.
2.  ¿Cada `link` está en las rutas reales? Si apunta a `/catalogo`, devuelta.
3.  ¿Los tres estados de datos están escritos y dicen causa y siguiente acción? Si no, devuelta.
4.  ¿Se entiende el punto focal sin leer el CSS? Si hay que explicarlo, devuelta.
5.  ¿El formulario 9 tiene los 10 puntos y el checklist 10 en PASS/FAIL con evidencia? Si no, devuelta.

Devolver no es regañar: es una lista de arreglos numerada, con la decisión que falta en cada uno.

## 11. Lo que la guía no permite

- Rellenar huecos con un número redondo plausible.
- Usar "miles de clientas", "hecho a mano" fuera de su realidad verificada, ni "premium" como
  calidad.
- Poner testimonios inventados con iniciales.
- Presentar el contenido pendiente como final en una imagen de concepto.
- Construir una rejilla de cuatro columnas de seis features porque "así se ve la marca".
