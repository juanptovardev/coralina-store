// Normalización compartida de items de carrito para las fronteras públicas
// (/api/store y /api/cart/evaluate). Una sola fuente ⇒ el preview y el cobro
// no divergen: clamp 1..9, dedupe por variante sumando cantidades (cap 9),
// y topes de tamaño (raw > 500 o más de 50 variantes distintas).

export function clampQty(n: unknown): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < 1) return 1;
  return Math.min(9, v);
}

export type NormalizedItem = { variantId: number; quantity: number };
export type CartNormalizeResult =
  | { ok: true; items: NormalizedItem[] }
  | { ok: false; reason: "too_big" | "empty" };

// Acepta el nombre de campo de cada caller: `qty` en /api/store, `quantity` en /api/cart/evaluate.
export function normalizeCartItems(raw: unknown, qtyKey: "qty" | "quantity"): CartNormalizeResult {
  const arr = Array.isArray(raw) ? raw : [];
  if (arr.length > 500) return { ok: false, reason: "too_big" };
  const merged = new Map<number, number>();
  for (const i of arr) {
    const obj = i as Record<string, unknown> | null;
    const variantId = Number(obj?.variantId);
    if (!Number.isInteger(variantId) || variantId <= 0) continue;
    const qty = clampQty(obj?.[qtyKey]);
    merged.set(variantId, Math.min(9, (merged.get(variantId) ?? 0) + qty));
  }
  if (merged.size === 0) return { ok: false, reason: "empty" };
  if (merged.size > 50) return { ok: false, reason: "too_big" };
  return { ok: true, items: [...merged.entries()].map(([variantId, quantity]) => ({ variantId, quantity })) };
}
