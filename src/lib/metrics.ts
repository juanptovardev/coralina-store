import { db } from "@/db";
import { orders } from "@/db/schema";
import { and, gte, ne, sql } from "drizzle-orm";

const DAY_MS = 86_400_000;

/** Bucket diario (YYYY-MM-DD) de los últimos 14 días naturales — en UTC. */
export type DayBucket = { date: string; count: number; revenueCents: number };

/**
 * Métricas del dashboard: una sola forma para /admin y /api/admin/orders.
 * Semántica UTC: "hoy" = día natural UTC (mismo límite que el bucket de hoy
 * de las barras); week/month siguen siendo ventanas móviles de 7/30 días.
 */
export type OrderMetrics = {
  today: number;
  prevDay: number;
  week: number;
  month: number;
  revenueMonth: number;
  avgTicket: number;
  byTag: Record<string, number>;
  byDay: DayBucket[];
};

/** Medianoche UTC del día de `now` (límite compartido por KPI "hoy" y barras). */
export function utcDayStart(now: number): number {
  return Math.floor(now / DAY_MS) * DAY_MS;
}

function utcDayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Agrupa pedidos en 14 buckets de día UTC (de hoy hacia atrás) con conteo y
 * facturación. Fuente única de las barras de 14 días: la usa buildOrderMetrics
 * para el dashboard (/admin) y la API de pedidos (métricas). Antes usaba hora
 * local del servidor; ahora la aritmética de días es 100% UTC (getUTC*).
 */
export function buildByDay14(
  list: { createdAt: Date | string; totalCents: number }[],
  now: number,
): DayBucket[] {
  const buckets = new Map<string, { count: number; revenueCents: number }>();
  for (let i = 13; i >= 0; i--) {
    buckets.set(utcDayKey(new Date(now - i * DAY_MS)), { count: 0, revenueCents: 0 });
  }
  for (const o of list) {
    const b = buckets.get(utcDayKey(new Date(o.createdAt)));
    if (b) {
      b.count += 1;
      b.revenueCents += o.totalCents;
    }
  }
  return [...buckets.entries()].map(([date, m]) => ({ date, ...m }));
}

/**
 * Fuente única de métricas (KPIs + byTag + barras): agregados SQL en vez de
 * cargar todos los pedidos en JS. Los límites de día se calculan en JS (UTC)
 * y viajan como parámetros absolutos — barras y KPI "hoy" comparten el MISMO
 * instante de medianoche UTC (equivalente a
 * date_trunc('day', created_at at time zone 'UTC'), sin depender de la TZ
 * del server de BD). Solo se lee el rango de las barras; la tabla completa
 * ya no se escanea.
 */
export async function buildOrderMetrics(now = Date.now()): Promise<OrderMetrics> {
  const todayStart = new Date(utcDayStart(now));
  const prevDayStart = new Date(todayStart.getTime() - DAY_MS);
  const weekStart = new Date(now - 7 * DAY_MS);
  const monthStart = new Date(now - 30 * DAY_MS);
  const window14Start = new Date(todayStart.getTime() - 13 * DAY_MS);

  const [kpi] = await db
    .select({
      today: sql<number>`count(*) filter (where ${orders.status} <> 'canceled' and ${orders.createdAt} >= ${todayStart})::int`,
      prevDay: sql<number>`count(*) filter (where ${orders.status} <> 'canceled' and ${orders.createdAt} >= ${prevDayStart} and ${orders.createdAt} < ${todayStart})::int`,
      week: sql<number>`count(*) filter (where ${orders.status} <> 'canceled' and ${orders.createdAt} >= ${weekStart})::int`,
      month: sql<number>`count(*) filter (where ${orders.status} <> 'canceled' and ${orders.createdAt} >= ${monthStart})::int`,
      revenueMonth: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${orders.status} <> 'canceled' and ${orders.createdAt} >= ${monthStart}), 0)::float8`,
      avgTicket: sql<number>`coalesce(round(avg(${orders.totalCents}) filter (where ${orders.status} <> 'canceled')), 0)::float8`,
    })
    .from(orders);

  const tagRows = await db
    .select({ tag: orders.operationalTag, n: sql<number>`count(*)::int` })
    .from(orders)
    .where(ne(orders.status, "canceled"))
    .groupBy(orders.operationalTag);

  // Rango exacto de las barras (14 días UTC, no cancelados): nada de escaneo completo.
  const dayRows = await db
    .select({ createdAt: orders.createdAt, totalCents: orders.totalCents })
    .from(orders)
    .where(and(ne(orders.status, "canceled"), gte(orders.createdAt, window14Start)));

  return {
    today: kpi.today,
    prevDay: kpi.prevDay,
    week: kpi.week,
    month: kpi.month,
    revenueMonth: kpi.revenueMonth,
    avgTicket: kpi.avgTicket,
    byTag: Object.fromEntries(tagRows.map((r) => [r.tag, r.n])),
    byDay: buildByDay14(dayRows, now),
  };
}
