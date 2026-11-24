# Ejemplo lleno: home de Coralina, hoy (catálogo vacío y después)

> Mismo árbol, dos estados. Sirve para que el agente vea que "vacío" también es diseño, no una
> pantalla en blanco esperando datos. La copia viene del repo; los pendientes van como pendientes.

## Estado A: hoy, sin layout publicado

En producción `home_layouts` está en 0, así que la home cae en `FallbackHero`. Eso es el estado
inicial y debe verse terminado, no como un error.

```
home
├─ proposito: que en 5 segundos entienda qué vendemos y toque una pieza
├─ modo: fallback (sin layout en la base)
├─ hero  [único bloque, fondo arena, texto tinta]
│  ├─ kicker: "Colección Caribe 2026"
│  ├─ title: "El mar te queda bien"
│  ├─ subtitle: "Vestidos de baño hechos a mano en Colombia.
│  │              Tela italiana, secado rápido y tallaje real."
│  ├─ cta_primario: "Comprar ahora" -> url:/coleccion        [coral, único foco]
│  ├─ cta_secundario: "Ver colección" -> url:/coleccion      [texto, sin relleno]
│  ├─ imagen: [POR DEFINIR: foto 4:5 de la pieza 1]
│  │           fallback: lámina de color con "foto pendiente"
│  └─ estados:
│     ├─ vacio: si /coleccion devuelve 0 piezas, el hero sigue y el aviso de abajo explica
│     └─ error: si falla la API, hero estático con la copia y el enlace
├─ aviso_catalogo  (solo cuando products = 0)
│  ├─ texto: "La tienda abre con las primeras piezas. Cuando estén cargadas, aparecen aquí."
│  └─ link: "Ver cómo se ven" -> n/a  (no se ofrece lo que no existe)
└─ footer
   ├─ descripcion: "Swimwear de corte limpio y colores de atardecer.
   │                  Diseñado y confeccionado en Colombia."
   ├─ ayuda: "Despacho de 24 a 48 h hábiles en Colombia"
   │         "Envío gratis desde $250.000"
   │         "Portal del equipo" -> /admin
   └─ legal: "© 2026 Coralina · Hecho en Colombia · Precios incluyen IVA"
```

Lo que NO aparece en este estado, a propósito: testimonios, estrellas, "4,9 de 5",
"+2.300 clientas", combos que no existen, links a redes que no tenemos.

## Estado B: con layout publicado y 6 piezas

```
home
├─ hero                        primario
│  ├─ kicker   "Colección Caribe 2026"
│  ├─ title    "El mar te queda bien"
│  ├─ subtitle "Vestidos de baño hechos a mano en Colombia."
│  ├─ cta      "Ver la colección" -> url:/coleccion
│  └─ imagen   [REAL: 4:5, pieza 1, fondo arena]
├─ categorias                  secundario, ritmo: fila
│  ├─ "Bikinis"        -> url:/coleccion?cat=bikinis        [foto real o lámina]
│  ├─ "Enterizos"      -> url:/coleccion?cat=enterizos
│  ├─ "Tankinis"       -> url:/coleccion?cat=tankinis
│  └─ "Accesorios"     -> url:/coleccion?cat=accesorios
├─ destacados                  primario de esta pantalla: solo 4
│  ├─ tarjeta_producto  x4     foto 4:5, nombre, precio formatCOP, "Agotado en tu talla" si aplica
│  └─ link   "Ver toda la colección" -> url:/coleccion
├─ editorial                   secundario, ritmo: dos columnas 5/7
│  ├─ title  "Hecho para el agua"
│  ├─ copy   "Cada pieza se corta y se cose a mano en Colombia.
│  │          La tela seca rápido, así que no te cambia el plan."
│  ├─ cta    "Ver precios y tallas" -> url:/coleccion
│  └─ imagen 16:9 escritorio / 4:5 móvil  [REAL o lámina]
├─ testimonios                 oculto: no hay testimonios reales cargados
├─ newsletter                  oculto: no hay backend de lista
└─ footer                      igual al estado A
```

## Diferencias entre A y B (solo contenido, no código nuevo)

| Bloque       | A: sin layout                    | B: con layout                                   |
| ------------ | -------------------------------- | ----------------------------------------------- |
| hero         | hero de respaldo, misma copia    | hero guardado, copia editable                   |
| categorias   | no aparece                       | 4 filas, foto real o lámina por categoría       |
| destacados   | no aparece                       | 4 piezas publicadas, precio real                |
| editorial    | no aparece                       | 2 columnas, foto 16:9 / 4:5                     |
| testimonios  | oculto                           | visible solo si `items.length > 0`              |
| newsletter   | oculto (texto honesto si se abre) | visible solo si el backend existe               |
| aviso vacío  | "La tienda abre con las primeras piezas" | desaparece                              |

## Criterio de aceptación de la home

- [ ] Con 0 productos, la home no se ve rota ni vacía: se ve una tienda en apertura con su copia real.
- [ ] Con 6 productos, aparecen 4 en destacados y "Ver toda la colección" lleva a las 6.
- [ ] Ningún texto aparece con `[POR DEFINIR]` en producción. Esos son solo para borrador.
- [ ] Cero apariciones de "Chile", "Santiago", "Pacífico Sur", "$30.000", "10% OFF", "612 reseñas",
      "Compra verificada", "Combo Marea" y del guion largo U+2014 en el HTML servido.
- [ ] El precio de la tarjeta viene de la base y lo pinta `formatCOP`. Nunca escrito a mano.
- [ ] "Envío gratis desde $250.000" coincide con `FREE_SHIPPING_CENTS` en el código.
- [ ] Vacío, cargando y error están escritos por cada bloque que lee datos.
- [ ] A 360 px no hay scroll horizontal en ninguna de las dos pantallas.
- [ ] Tab llega al CTA, al enlace de colección y al pie; el foco se ve.
