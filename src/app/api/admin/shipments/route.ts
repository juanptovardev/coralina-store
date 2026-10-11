import { NextResponse } from "next/server";
import { db } from "@/db";
import { customers, orderItems, orders, shipments, type ShipmentStatus } from "@/db/schema";
import { asc, eq, inArray } from "drizzle-orm";
import { recordAudit } from "@/lib/audit";
import { archiveCompletedShipments } from "@/lib/orders";
import { canMoveShipment } from "@/lib/domain";
import { pageParams } from "@/lib/page-params";
import { getActor } from "@/lib/session";
import { ensureSeeded } from "@/lib/seed";

const VALID: ShipmentStatus[] = ["revision", "despacho", "reparto", "completado", "archivado"];

export async function GET(req: Request) {
  await ensureSeeded();
  await archiveCompletedShipments(); // job 24h idempotente

  const { searchParams } = new URL(req.url);
  const { page, pageSize, offset } = pageParams(searchParams, 200);

  // Tiebreaker por id: timestamps empatados no repiten/omiten filas entre páginas.
  const rows = await db
    .select({ s: shipments, o: orders, c: customers })
    .from(shipments)
    .innerJoin(orders, eq(orders.id, shipments.orderId))
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .orderBy(asc(shipments.createdAt), asc(shipments.id));
  const total = rows.length;
  const pageRows = rows.slice(offset, offset + pageSize);

  const ids = pageRows.map((r) => r.o.id);
  const items = ids.length ? await db.select().from(orderItems).where(inArray(orderItems.orderId, ids)) : [];

  const cards = pageRows.map(({ s, o, c }) => ({
    id: s.id,
    orderId: o.id,
    status: s.status,
    statusHistory: s.statusHistory,
    completedAt: s.completedAt,
    archivedAt: s.archivedAt,
    createdAt: s.createdAt,
    carrier: s.carrier,
    trackingCode: s.trackingCode,
    displayId: o.displayId,
    operationalTag: o.operationalTag,
    orderStatus: o.status,
    totalCents: o.totalCents,
    customerName: c.name,
    city: c.city,
    itemCount: items.filter((i) => i.orderId === o.id).reduce((a, i) => a + i.quantity, 0),
  }));

  return NextResponse.json({ shipments: cards, page, pageSize, total });
}

export async function POST(req: Request) {
  const actor = await getActor();
  const body = await req.json();
  const action = body.action as string;

  if (action === "move") {
    const id = Number(body.shipmentId);
    const status = body.status as ShipmentStatus;
    if (!VALID.includes(status)) {
      return NextResponse.json({ ok: false, error: "Columna inválida." }, { status: 400 });
    }
    const [ship] = await db.select().from(shipments).where(eq(shipments.id, id)).limit(1);
    if (!ship) return NextResponse.json({ ok: false, error: "Envío no encontrado." }, { status: 404 });

    const [order] = await db.select().from(orders).where(eq(orders.id, ship.orderId)).limit(1);
    if (order?.status === "canceled") {
      return NextResponse.json(
        { ok: false, error: "El pedido está cancelado: su envío no puede volver al tablero." },
        { status: 409 },
      );
    }

    // Validación server-side del movimiento (misma matriz que el Kanban).
    const check = canMoveShipment(
      ship.status,
      status,
      order?.fulfillmentClass ?? "",
      order?.status ?? "",
    );
    if (!check.ok) {
      return NextResponse.json({ ok: false, error: check.reason ?? "Movimiento no permitido." }, { status: 409 });
    }

    const history = [
      ...ship.statusHistory,
      { status, at: new Date().toISOString(), by: actor.name },
    ];
    await db
      .update(shipments)
      .set({
        status,
        statusHistory: history,
        completedAt: status === "completado" ? new Date() : null,
        archivedAt: status === "archivado" ? new Date() : null,
      })
      .where(eq(shipments.id, id));

    await recordAudit({
      actor,
      module: "envios",
      entityType: "shipment",
      entityId: order?.displayId ?? id,
      action: "status_change",
      fieldChanged: "status",
      oldValue: ship.status,
      newValue: status,
      summary: `${actor.name} movió el envío de ${order?.displayId ?? `#${id}`} de ${ship.status} a ${status}.`,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "set_tracking") {
    const id = Number(body.shipmentId);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ ok: false, error: "Envío inválido." }, { status: 400 });
    }
    const carrier = String(body.carrier ?? "").trim();
    const trackingCode = String(body.trackingNumber ?? "").trim();
    if (carrier.length > 80) {
      return NextResponse.json(
        { ok: false, error: "La transportadora no puede superar 80 caracteres." },
        { status: 400 },
      );
    }
    if (trackingCode.length > 80) {
      return NextResponse.json(
        { ok: false, error: "El número de guía no puede superar 80 caracteres." },
        { status: 400 },
      );
    }
    const [ship] = await db.select().from(shipments).where(eq(shipments.id, id)).limit(1);
    if (!ship) return NextResponse.json({ ok: false, error: "Envío no encontrado." }, { status: 404 });

    // Escritura de una sola tabla: el UPDATE es atómico; no requiere transacción.
    await db
      .update(shipments)
      .set({ carrier, trackingCode })
      .where(eq(shipments.id, id));

    const [order] = await db.select().from(orders).where(eq(orders.id, ship.orderId)).limit(1);
    await recordAudit({
      actor,
      module: "envios",
      entityType: "shipment",
      entityId: order?.displayId ?? id,
      action: "set_tracking",
      fieldChanged: "carrier,tracking_code",
      oldValue: { carrier: ship.carrier, trackingCode: ship.trackingCode },
      newValue: { carrier, trackingCode },
      summary: `${actor.name} guardó transportadora/guía del envío de ${order?.displayId ?? `#${id}`}.`,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "run_archive_job") {
    const n = await archiveCompletedShipments();
    return NextResponse.json({ ok: true, archived: n });
  }

  return NextResponse.json({ ok: false, error: `Acción desconocida: ${action}` }, { status: 400 });
}
