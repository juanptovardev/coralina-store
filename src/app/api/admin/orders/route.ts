import { NextResponse } from "next/server";
import { passwordMatches } from "@/lib/admin-auth";
import { db } from "@/db";
import { customers, orderItems, orders, shipments, type OperationalTag } from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { recordAudit } from "@/lib/audit";
import { OPERATIONAL_TAGS } from "@/lib/constants";
import { transitionTag, createOrder, buildCartLines, restoreStock } from "@/lib/orders";
import { buildByDay14 } from "@/lib/metrics";
import { evaluateCart } from "@/lib/promo";
import { pageParams } from "@/lib/page-params";
import { getActor } from "@/lib/session";
import { ensureSeeded } from "@/lib/seed";
import { normalizeCartItems } from "@/lib/cart-input";

export async function GET(req: Request) {
  await ensureSeeded();
  const { searchParams } = new URL(req.url);
  const { page, pageSize, offset } = pageParams(searchParams, 100);

  // Métricas se calculan sobre TODOS los pedidos (semántica intacta); la
  // paginación solo recorta el array `orders` que viaja en la respuesta.
  // Tiebreaker por id: timestamps empatados no repiten/omiten filas entre páginas.
  const rows = await db
    .select({ o: orders, c: customers })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .orderBy(desc(orders.createdAt), desc(orders.id));
  const total = rows.length;
  const pageRows = rows.slice(offset, offset + pageSize);

  const ids = pageRows.map((r) => r.o.id);
  const items = ids.length ? await db.select().from(orderItems).where(inArray(orderItems.orderId, ids)) : [];
  const ships = ids.length ? await db.select().from(shipments).where(inArray(shipments.orderId, ids)) : [];

  const data = pageRows.map(({ o, c }) => ({
    ...o,
    customer: c,
    items: items.filter((i) => i.orderId === o.id),
    shipment: ships.find((s) => s.orderId === o.id) ?? null,
  }));

  const now = Date.now();
  const since = (h: number) => new Date(now - h * 3600 * 1000);
  const inRange = (d: Date, h: number) => d >= since(h);
  const revenue = (list: typeof rows) => list.reduce((a, r) => a + r.o.totalCents, 0);
  const valid = rows.filter((r) => r.o.status !== "canceled");

  const metrics = {
    today: valid.filter((r) => inRange(r.o.createdAt, 24)).length,
    week: valid.filter((r) => inRange(r.o.createdAt, 24 * 7)).length,
    month: valid.filter((r) => inRange(r.o.createdAt, 24 * 30)).length,
    revenueMonth: revenue(valid.filter((r) => inRange(r.o.createdAt, 24 * 30))),
    avgTicket: valid.length ? Math.round(revenue(valid) / valid.length) : 0,
    byTag: valid.reduce<Record<string, number>>((acc, r) => {
      acc[r.o.operationalTag] = (acc[r.o.operationalTag] ?? 0) + 1;
      return acc;
    }, {}),
    byDay: buildByDay14(valid.map((r) => r.o), now),
  };

  return NextResponse.json({ orders: data, metrics, page, pageSize, total });
}

export async function POST(req: Request) {
  const actor = await getActor();
  const body = await req.json();
  const action = body.action as string;

  if (action === "preview_totals") {
    const norm = normalizeCartItems(body.items, "quantity");
    if (!norm.ok) {
      return NextResponse.json({ ok: false, error: "Carrito inválido." }, { status: 400 });
    }
    const lines = await buildCartLines(norm.items);
    return NextResponse.json(await evaluateCart(lines));
  }

  if (action === "create_manual") {
    // Frontera compartida: mismo clamp/dedupe/caps que el checkout público
    // (/api/store) y el preview (/api/cart/evaluate) — una sola fuente de verdad.
    const raw = Array.isArray(body.items)
      ? (body.items as Array<{ variantId?: unknown; qty?: unknown; quantity?: unknown }>).map((i) => ({
          variantId: i?.variantId,
          quantity: i?.qty ?? i?.quantity,
        }))
      : [];
    const norm = normalizeCartItems(raw, "quantity");
    if (!norm.ok) {
      return NextResponse.json(
        { ok: false, error: norm.reason === "empty" ? "Carrito inválido." : "Carrito demasiado grande." },
        { status: 400 },
      );
    }
    const items = norm.items;
    const result = await createOrder(
      {
        customerId: body.customerId ? Number(body.customerId) : undefined,
        customer: body.customer,
        items,
        source: "manual",
        fulfillmentClass: body.fulfillmentClass === "no_enviar" ? "no_enviar" : "enviar",
        paymentRef: body.paymentRef ?? "",
        notes: body.notes ?? "",
      },
      actor,
    );
    return NextResponse.json(result, { status: result.ok ? 200 : result.code === "invalid_items" ? 400 : 409 });
  }

  if (action === "set_tag") {
    const id = Number(body.orderId);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
    }
    const tag = body.tag as OperationalTag;
    if (!OPERATIONAL_TAGS.some((t) => t.value === tag)) {
      return NextResponse.json({ ok: false, error: "Tag inválido." }, { status: 400 });
    }
    const res = await transitionTag(id, tag, actor);
    if ("noop" in res) return NextResponse.json({ ok: true });
    if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
    return NextResponse.json({ ok: true });
  }

  if (action === "bulk_tag") {
    const ids = (Array.isArray(body.orderIds) ? body.orderIds : [])
      .map(Number)
      .filter((n: number) => Number.isInteger(n) && n > 0);
    const tag = String(body.tag ?? "");
    if (!OPERATIONAL_TAGS.some((t) => t.value === tag)) {
      return NextResponse.json({ ok: false, error: "Tag inválido." }, { status: 400 });
    }
    if (!ids.length) {
      return NextResponse.json({ ok: false, error: "Sin pedidos seleccionados." }, { status: 400 });
    }
    let changed = 0;
    const errors: string[] = [];
    for (const id of ids) {
      const res = await transitionTag(id, tag as OperationalTag, actor);
      if ("noop" in res) continue;
      if (res.ok) changed += 1;
      else errors.push(`#${id}: ${res.error}`);
    }
    // Un bulk 100% no-op (idempotente) no es un error: 200 con changed=0.
    const okAll = errors.length === 0;
    return NextResponse.json(
      { ok: okAll, changed, total: ids.length, errors },
      { status: okAll ? 200 : 400 },
    );
  }

  if (action === "save_notes") {
    const id = Number(body.orderId);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
    }
    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    await db.update(orders).set({ notes: String(body.notes ?? "") }).where(eq(orders.id, id));
    await recordAudit({
      actor,
      module: "pedidos",
      entityType: "order",
      entityId: order.displayId,
      action: "update",
      fieldChanged: "notes",
      oldValue: order.notes,
      newValue: body.notes,
      summary: `${actor.name} actualizó las notas internas del pedido ${order.displayId}.`,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "hard_delete") {
    if (!actor.canHardDelete) {
      return NextResponse.json({ ok: false, error: "Tu rol no permite borrado definitivo." }, { status: 403 });
    }
    const id = Number(body.orderId);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
    }
    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    if (String(body.confirmText ?? "").trim() !== order.displayId) {
      return NextResponse.json({ ok: false, error: "El código escrito no coincide." }, { status: 400 });
    }
    if (!passwordMatches(body.password)) {
      return NextResponse.json({ ok: false, error: "Reautenticación fallida." }, { status: 401 });
    }
    // Operación destructiva multi-tabla: restore de stock + deletes en UNA
    // transacción. Si algo falla no queda stock repuesto con el pedido vivo
    // (un reintento no repone de nuevo). El audit se escribe tras el commit.
    await db.transaction(async (tx) => {
      // Reponer stock si el pedido NO estaba cancelado: al crearse descontó stock
      // (un cancelado ya lo repuso una sola vez vía transitionTag).
      // Contrato: solo pedidos creados vía createOrder; los del seed se insertan
      // directo en SQL y no descontaron stock (no se debe inflar inventario).
      if (order.status !== "canceled") {
        const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, id));
        for (const it of items) await restoreStock(it.variantId, it.quantity, tx);
      }
      await tx.delete(shipments).where(eq(shipments.orderId, id));
      await tx.delete(orderItems).where(eq(orderItems.orderId, id));
      await tx.delete(orders).where(eq(orders.id, id));
    });

    await recordAudit({
      actor,
      module: "pedidos",
      entityType: "order",
      entityId: order.displayId,
      action: "delete_hard",
      oldValue: { total: order.totalCents, tag: order.operationalTag },
      summary: `${actor.name} eliminó definitivamente el pedido ${order.displayId} (cascada: items + envío).`,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: `Acción desconocida: ${action}` }, { status: 400 });
}
