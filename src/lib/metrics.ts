import { db } from "@/db";
import { orders } from "@/db/schema";
import { and, gte, ne, sql } from "drizzle-orm";

const DAY_MS = 86_400_000;
/** Colombia no tiene horario de verano: UTC-5 todo el año. */
export const BOGOTA_OFFSET_MS = 5 * 3600_000;

/** Bucket diario (YYYY-MM-DD) de los últimos 14 días naturales en hora de Bogotá. */
export type DayBucket = { date: string; count: number; revenueCents: number };

/**
 * Métricas del dashboard: una sola forma para /admin y /api/admin/orders.
 * Los cortes de día son de Bogotá (UTC-5), no de UTC: antes "hoy" cambiaba a
 * las 19:00 locales y las barras se corrían un día por la noche.
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

/** Medianoche de Bogotá del día de `now` (límite compartido por KPI "hoy" y barras). */
export function bogotaDayStart(now: number): number {
  return Math.floor((now - BOGOTA_OFFSET_MS) / DAY_MS) * DAY_MS + BOGOTA_OFFSET_MS;
}

/** Primer día del mes en curso a las 00:00 de Bogotá. */
export function bogotaMonthStart(now: number): number {
  const d = new Date(now - BOGOTA_OFFSET_MS);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) + BOGOTA_OFFSET_MS;
}

function bogotaDayKey(ms: number): string {
  const d = new Date(ms - BOGOTA_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Agrupa pedidos en 14 buckets de día de Bogotá (de hoy hacia atrás) con conteo
 * y facturación. Fuente única de las barras de 14 días: la usa buildOrderMetrics
 * para el dashboard (/admin) y la API de pedidos (métricas).
 */
export function buildByDay14(
  list: { createdAt: Date | string; totalCents: number }[],
  now: number,
): DayBucket[] {
  const buckets = new Map<string, { count: number; revenueCents: number }>();
  const todayStart = bogotaDayStart(now);
  for (let i = 13; i >= 0; i--) {
    buckets.set(bogotaDayKey(todayStart - i * DAY_MS), { count: 0, revenueCents: 0 });
  }
  for (const o of list) {
    const ms = typeof o.createdAt === "string" ? Date.parse(o.createdAt) : o.createdAt.getTime();
    const b = buckets.get(bogotaDayKey(ms));
    if (b) {
      b.count += 1;
      b.revenueCents += o.totalCents;
    }
  }
  return [...buckets.entries()].map(([date, m]) => ({ date, ...m }));
}

/**
 * Fuente única de métricas (KPIs + byTag + barras): agregados SQL en vez de
 * cargar todos los pedidos en JS. Los límites viajan como instantes absolutos
 * calculados con el offset fijo de Bogotá (UTC-5), así que no dependen de la
 * zona horaria del servidor ni de la de la base de datos.
 */
export async function buildOrderMetrics(now = Date.now()): Promise<OrderMetrics> {
  const todayStart = new Date(bogotaDayStart(now));
  const prevDayStart = new Date(todayStart.getTime() - DAY_MS);
  const weekStart = new Date(now - 7 * DAY_MS);
  const monthStart = new Date(bogotaMonthStart(now));
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
