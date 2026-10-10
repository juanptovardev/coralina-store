/**
 * ?page= (1-based) + ?pageSize= con tope duro (200).
 *
 * El tope SOLO aplica cuando el cliente pide paginación explícita (?page o
 * ?pageSize): sin parámetros se devuelve todo (comportamiento legacy de la UI
 * sin controles de página — nada se trunca en silencio).
 */
export function pageParams(sp: URLSearchParams, defaultSize: number) {
  const p = Number(sp.get("page"));
  const s = Number(sp.get("pageSize"));
  const page = Number.isInteger(p) && p >= 1 ? p : 1;
  const requested = sp.has("page") || sp.has("pageSize");
  const pageSize = requested
    ? Math.min(200, Number.isInteger(s) && s >= 1 ? s : defaultSize)
    : Number.MAX_SAFE_INTEGER;
  return { page, pageSize, offset: (page - 1) * pageSize };
}
