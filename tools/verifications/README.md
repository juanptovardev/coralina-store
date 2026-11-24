# Verificaciones

Cada cambio no trivial deja aqui un dossier con la evidencia que lo respalda,
para que nadie tenga que creer una afirmacion sin poder re-ejecutarla.

## Nombre del archivo

```
cierre-<etapa>-<fecha>.md
```

Ejemplo: `cierre-t4-2026-10-18.md`.

## Contenido minimo

1. Que se cambio y por que (una linea por punto).
2. SHA del commit y rama.
3. Comandos ejecutados con su salida esperada y la obtenida:
   - `npx tsc --noEmit` (EXIT 0)
   - `npm test` (todos los archivos verdes)
   - `npm run build` (EXIT 0)
   - Matriz en produccion (curl o Playwright), ruta por ruta con el status.
4. Que NO se verifico y por que.
5. Riesgos y deuda que quedan abiertos.
6. Como revertir.

## Regla

Si un dossier no se puede re-ejecutar, no es evidencia. Es una promesa.
