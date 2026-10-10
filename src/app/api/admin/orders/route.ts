import { NextResponse } from "next/server";
import { passwordMatches } from "@/lib/admin-auth";
import { db } from "@/db";
import { customers, orderItems, orders, shipments, type OperationalTag } from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { recordAudit } from "@/lib/audit";
import { OPERATIONAL_TAGS } from "@/lib/constants";
import { changeOperationalTag, createOrder } from "@/lib/orders";
import { buildByDay14 } from "@/lib/metrics";
import { evaluateCart } from "@/lib/promo";
import { buildCartLines } from "@/lib/orders";
import { canChangeTag } from "@/lib/domain";
import { getActor } from "@/lib/session";
import { ensureSeeded } from "@/lib/seed";
import { normalizeCartItems } from "@/lib/cart-input";

/**
 * Valida la transición de tag operativo contra la matriz única canChangeTag.
 * "ok" = transición real permitida; "noop" = ya estaba en ese tag; "error" = inválida.
 */
type TagGuard =
  | { kind: "ok" }
  | { kind: "noop" }
  | { kind: "error"; status: number; error: string };

async function checkTagTransition(orderId: number, tag: OperationalTag): Promise<TagGuard> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return { kind: "error", status: 404, error: "Pedido no encontrado." };
  if (order.operationalTag === tag) return { kind: "noop" };
  const [ship] = await db.select().from(shipments).where(eq(shipments.orderId, orderId)).limit(1);
  const check = canChangeTag(order.operationalTag, tag, ship?.status ?? null);
  if (!check.ok) return { kind: "error", status: 409, error: check.reason ?? "Transición no permitida." };
  return { kind: "ok" };
}

export async function GET() {
  await ensureSeeded();
  const rows = await db
    .select({ o: orders, c: customers })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .orderBy(desc(orders.createdAt));

  const ids = rows.map((r) => r.o.id);
  const items = ids.length ? await db.select().from(orderItems).where(inArray(orderItems.orderId, ids)) : [];
  const ships = ids.length ? await db.select().from(shipments).where(inArray(shipments.orderId, ids)) : [];

  const data = rows.map(({ o, c }) => ({
    ...o,
    customer: c,
    items: items.filter((i) => i.orderId === o.id),
    shipment: ships.find((s) => s.orderId === o.id) ?? null,
  }));

  const now = Date.now();
  const since = (h: number) => new Date(now - h * 3600 * 1000);
  const inRange = (d: Date, h: number) => d >= since(h);
  const revenue = (list: typeof data) => list.reduce((a, o) => a + o.totalCents, 0);
  const valid = data.filter((o) => o.status !== "canceled");

  const metrics = {
    today: valid.filter((o) => inRange(o.createdAt, 24)).length,
    week: valid.filter((o) => inRange(o.createdAt, 24 * 7)).length,
    month: valid.filter((o) => inRange(o.createdAt, 24 * 30)).length,
    revenueMonth: revenue(valid.filter((o) => inRange(o.createdAt, 24 * 30))),
    avgTicket: valid.length ? Math.round(revenue(valid) / valid.length) : 0,
    byTag: valid.reduce<Record<string, number>>((acc, o) => {
      acc[o.operationalTag] = (acc[o.operationalTag] ?? 0) + 1;
      return acc;
    }, {}),
    byDay: buildByDay14(valid, now),
  };

  return NextResponse.json({ orders: data, metrics });
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
    const guard = await checkTagTransition(id, tag);
    if (guard.kind === "error") {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }
    const res = await changeOperationalTag(id, tag, actor);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
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
      const guard = await checkTagTransition(id, tag as OperationalTag);
      if (guard.kind === "error") {
        errors.push(`#${id}: ${guard.error}`);
        continue;
      }
      if (guard.kind === "noop") continue;
      const res = await changeOperationalTag(id, tag as OperationalTag, actor);
      if (res.ok) changed += 1;
      else errors.push(`#${id}: ${res.error ?? "error"}`);
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
    await recordAudit({
      actor,
      module: "pedidos",
      entityType: "order",
      entityId: order.displayId,
      action: "delete_hard",
      oldValue: { total: order.totalCents, tag: order.operationalTag },
      summary: `${actor.name} eliminó definitivamente el pedido ${order.displayId} (cascada: items + envío).`,
    });
    await db.delete(shipments).where(eq(shipments.orderId, id));
    await db.delete(orderItems).where(eq(orderItems.orderId, id));
    await db.delete(orders).where(eq(orders.id, id));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: `Acción desconocida: ${action}` }, { status: 400 });
}
