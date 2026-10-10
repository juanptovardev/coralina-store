/** Bucket diario de los últimos 14 días naturales (hora local del servidor). */
export type DayBucket = { date: string; count: number; revenueCents: number };

/**
 * Agrupa pedidos en 14 buckets de día (de hoy hacia atrás) con conteo y facturación.
 * Fuente única de verdad de las barras de 14 días: la usa el dashboard (/admin)
 * y la API de pedidos (métricas).
 */
export function buildByDay14(
  list: { createdAt: Date | string; totalCents: number }[],
  now: number,
): DayBucket[] {
  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const buckets = new Map<string, { count: number; revenueCents: number }>();
  for (let i = 13; i >= 0; i--) {
    buckets.set(key(new Date(now - i * 86_400_000)), { count: 0, revenueCents: 0 });
  }
  for (const o of list) {
    const b = buckets.get(key(new Date(o.createdAt)));
    if (b) {
      b.count += 1;
      b.revenueCents += o.totalCents;
    }
  }
  return [...buckets.entries()].map(([date, m]) => ({ date, ...m }));
}
