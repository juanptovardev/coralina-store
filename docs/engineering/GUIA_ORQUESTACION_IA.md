# Guia de orquestacion IA

Como se trabaja este repo con agentes. Corto y aplicable.

## Regla base

El agente no califica su propio trabajo. Quien implementa no es quien cierra.

## Ciclo por etapa

1. **Plan**: se escribe la etapa y sus criterios de aceptacion ejecutables en
   `EXECUTION_BATCHES.md`. Aceptacion = comando con salida esperada. Nunca un adjetivo.
2. **Aislamiento**: una rama por etapa (`feat/<etapa>`). Un solo worktree activo.
3. **Ejecucion**: el obrero implementa solo dentro del alcance declarado.
4. **Verificacion propia**: el orquestador re-ejecuta, no lee claims.
   `npx tsc --noEmit`, `npm test`, `npm run build`.
5. **Cierre ciego**: sesion fresca con el diff y los criterios, sin la
   conversacion de implementacion. Veredicto CERRADA, CERRADA-CON-RESERVAS o RECHAZADA
   en `tools/verifications/cierre-<etapa>-<fecha>.md`.
6. **Deploy y smoke**: push, deploy READY en Vercel, matriz de rutas en produccion.
7. **Bitacora**: se anota en `ESTADO_ORQUESTACION.md` (append-only).

## Reglas duras

- Sin dossier no hay merge.
- Dos fallos de aceptacion en la misma etapa = STOP y escalar.
- Si un test cambia tras un refactor, el refactor esta mal.
- Archivo fuera de alcance: se declara o se revierte.
- Erratas se corrigen en el lanzador, nunca editando el prompt ya lanzado.

## Verificacion (lo unico valido)

```powershell
npx tsc --noEmit
npm test
npm run build
```

Y en produccion, matriz por ruta con `curl.exe` o Playwright.

Prohibido: suites QA locales (`suite-*.mjs`, `ui-audit`, `parity-*`, `scripts/qa-server.ps1`).
No son fiables en este entorno y ya se retiraron.
