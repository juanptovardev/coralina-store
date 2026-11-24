# Execution batches (prompts congelados)

Cada etapa se escribe aqui antes de lanzarla y no se edita despues.

## Plantilla

```
## T-<n> - <titulo>

Objetivo:
Alcance (archivos permitidos):
Prohibido:
Criterios de aceptacion ejecutables:
  1. <comando> -> <salida esperada>
  2. ...
Presupuesto de lectura: <n> archivos
REPORTA obligatorio: SHA, comandos + salida, archivos tocados,
  fuera de alcance, riesgos.
```

## Historial

| Etapa | Titulo | Estado |
| --- | --- | --- |
| F0 | Base y estabilidad del admin | CERRADA |
| F1 | Integridad de datos (transacciones, validacion) | CERRADA |
| F2 | Robustez de acciones (busy, confirmaciones, paginacion) | CERRADA |
| F3 | Datos y analitica (timestamps, KPIs, TZ) | CERRADA |
| F4 | Enterprise y ops (sesion firmada, users, CI) | CERRADA |
| F5 | Producto (envios, inventario, promos) | CERRADA |
| T1 | Auth por cuenta, sin selector de rol | CERRADA y en prod |
| T2 | Auto-registro con rol cliente | CERRADA y en prod |
| T3 | Panel de cliente /mi-cuenta | CERRADA y en prod |
| T4 | Gestion de cuentas en admin | CERRADA y en prod |
| D1 | Anti-slop dashboard (Bogota, cifras honestas) | CERRADA y en prod |
| D2 | Anti-slop tienda (COP, umbral unico, copy honesto) | CERRADA y en prod |
| D3 | Enlaces reales (resolveHref + checklist 409) | CERRADA y en prod |
| D4 | Design system entregado (5 archivos) | ENTREGADO, sin commit |
| O1 | Limpieza del workspace + enterprise | EN CURSO |

## Siguiente

- Cargar catalogo real (categorias, tallas, productos, home publicado).
- Ver `docs/engineering/ESTADO_ORQUESTACION.md`.
