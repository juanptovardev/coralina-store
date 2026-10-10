import { NextResponse } from "next/server";
import { db } from "@/db";
import { customers, orderItems, orders } from "@/db/schema";
import { asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { recordAudit } from "@/lib/audit";
import { getActor } from "@/lib/session";
import { ensureSeeded } from "@/lib/seed";

/** VIP = LTV ≥ $50.000 (en centavos: 5_000_000). */
const VIP_CENTS = 5_000_000;

export async function GET(req: Request) {
  await ensureSeeded();
  const { searchParams } = new URL(req.url);

  // Detalle: cliente + historial de pedidos (?id=)
  const detailId = Number(searchParams.get("id") ?? 0);
  if (detailId) {
    const [cust] = await db.select().from(customers).where(eq(customers.id, detailId)).limit(1);
    if (!cust) return NextResponse.json({ ok: false, error: "Cliente no encontrado." }, { status: 404 });
    const hist = await db
      .select({
        id: orders.id,
        displayId: orders.displayId,
        status: orders.status,
        operationalTag: orders.operationalTag,
        totalCents: orders.totalCents,
        createdAt: orders.createdAt,
        itemCount: sql<number>`coalesce(sum(${orderItems.quantity}),0)::int`,
      })
      .from(orders)
      .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(eq(orders.customerId, detailId))
      .groupBy(orders.id)
      .orderBy(desc(orders.createdAt));
    return NextResponse.json({ customer: cust, orders: hist });
  }

  const q = (searchParams.get("q") ?? "").trim();
  const code = (searchParams.get("code") ?? "").trim();
  const segment = searchParams.get("segment") ?? "todos";
  const sort = searchParams.get("sort") ?? "name";
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = 50;

  // Si hay código de pedido, manda él: el WHERE de texto libre anularía el
  // filtro HAVING por código (p.ej. q="#CR-1042" no matchea nombre/correo).
  const where = code
    ? undefined
    : q
      ? or(
          ilike(customers.name, `%${q}%`),
          ilike(customers.email, `%${q}%`),
          ilike(customers.phone, `%${q}%`),
          ilike(customers.city, `%${q}%`),
        )
      : undefined;

  // Segmentos y búsqueda por código de pedido viven en HAVING (son agregados)
  const havingClauses = [];
  if (segment === "vip") {
    havingClauses.push(
      sql`coalesce(sum(case when ${orders.status} <> 'canceled' then ${orders.totalCents} else 0 end),0) >= ${VIP_CENTS}`,
    );
  } else if (segment === "recurrentes") {
    // Regla: recurrente = ≥ 2 pedidos NO cancelados (misma regla que las stats).
    havingClauses.push(sql`count(case when ${orders.status} <> 'canceled' then 1 end) >= 2`);
  } else if (segment === "sin_compras") {
    havingClauses.push(sql`count(case when ${orders.status} <> 'canceled' then 1 end) = 0`);
  }
  if (code) {
    havingClauses.push(
      sql`exists (select 1 from ${orders} where ${orders.customerId} = ${customers.id} and ${orders.displayId} ilike ${`%${code}%`})`,
    );
  }

  const ltvExpr = sql<number>`coalesce(sum(case when ${orders.status} <> 'canceled' then ${orders.totalCents} else 0 end),0)::float8`;

  const base = db
    .select({
      id: customers.id,
      name: customers.name,
      email: customers.email,
      phone: customers.phone,
      city: customers.city,
      address: customers.address,
      notes: customers.notes,
      createdAt: customers.createdAt,
      orderCount: sql<number>`count(${orders.id})::int`.as("order_count"),
      ltvCents: ltvExpr.as("ltv_cents"),
      lastOrderAt: sql<string | null>`max(${orders.createdAt})`.as("last_order_at"),
    })
    .from(customers)
    .leftJoin(orders, eq(orders.customerId, customers.id))
    .where(where)
    .groupBy(customers.id)
    .having(havingClauses.length ? sql.join(havingClauses, sql` and `) : sql`true`);

  const rows = await base
    .orderBy(sort === "ltv" ? desc(sql`coalesce(sum(case when ${orders.status} <> 'canceled' then ${orders.totalCents} else 0 end),0)`) : asc(customers.name))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(base.as("f"));

  // Stats globales (sin filtros de segmento/búsqueda)
  const agg = db
    .select({
      id: customers.id,
      cnt: sql<number>`count(${orders.id})::int`.as("cnt"),
      activeCnt: sql<number>`count(case when ${orders.status} <> 'canceled' then 1 end)::int`.as("active_cnt"),
      ltv: sql<number>`coalesce(sum(case when ${orders.status} <> 'canceled' then ${orders.totalCents} else 0 end),0)::float8`.as("ltv"),
    })
    .from(customers)
    .leftJoin(orders, eq(orders.customerId, customers.id))
    .groupBy(customers.id)
    .as("agg");

  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      vip: sql<number>`count(*) filter (where ${agg.ltv} >= ${VIP_CENTS})::int`,
      recurrentes: sql<number>`count(*) filter (where ${agg.activeCnt} >= 2)::int`,
      avgLtvCents: sql<number>`coalesce(round(avg(${agg.ltv})),0)::float8`,
    })
    .from(agg);

  return NextResponse.json({ customers: rows, total, page, pageSize, stats });
}

export async function POST(req: Request) {
  const actor = await getActor();
  const body = await req.json();
  const action = body.action as string;

  if (action === "update_notes") {
    const id = Number(body.id);
    const [cust] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
    if (!cust) return NextResponse.json({ ok: false, error: "Cliente no encontrado." }, { status: 404 });
    const notes = String(body.notes ?? "");
    await db.update(customers).set({ notes }).where(eq(customers.id, id));
    await recordAudit({
      actor,
      module: "clientes",
      entityType: "customer",
      entityId: id,
      action: "update",
      fieldChanged: "notes",
      oldValue: cust.notes,
      newValue: notes,
      summary: `${actor.name} actualizó las notas del cliente ${cust.name}.`,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: `Acción desconocida: ${action}` }, { status: 400 });
}
