import { db } from "@/db";
import {
  customers,
  inventoryLevels,
  orderItems,
  orders,
  products,
  shipments,
  variants,
  type OperationalTag,
} from "@/db/schema";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { recordAudit } from "./audit";
import { evaluateCart, type CartLine } from "./promo";
import type { Actor } from "./session";

export type OrderInputItem = { variantId: number; quantity: number };

export type CreateOrderInput = {
  customerId?: number;
  customer?: { name: string; email: string; phone?: string; city?: string; address?: string };
  items: OrderInputItem[];
  source: "web" | "manual";
  fulfillmentClass: "enviar" | "no_enviar";
  paymentRef?: string;
  paymentMethod?: string;
  notes?: string;
  promoCode?: string | null;
};

export async function buildCartLines(items: OrderInputItem[]): Promise<CartLine[]> {
  const ids = items.map((i) => i.variantId);
  if (ids.length === 0) return [];
  const rows = await db
    .select({
      variantId: variants.id,
      size: variants.size,
      productId: products.id,
      categoryId: products.categoryId,
      title: products.title,
      price: products.priceCents,
    })
    .from(variants)
    .innerJoin(products, eq(products.id, variants.productId))
    .where(and(inArray(variants.id, ids), ne(variants.active, false)));

  return items
    .map((i) => {
      const r = rows.find((x) => x.variantId === i.variantId);
      if (!r) return null;
      return {
        variantId: r.variantId,
        productId: r.productId,
        categoryId: r.categoryId,
        title: r.title,
        size: r.size,
        unitPriceCents: r.price,
        quantity: i.quantity,
      } satisfies CartLine;
    })
    .filter((x): x is CartLine => x !== null);
}

async function nextDisplayId(): Promise<string> {
  // Secuencia PG atómica (orders_display_seq): dos checkouts concurrentes no
  // colisionan en display_id (antes: read-max + insert → 409 espurio por 23505).
  const res = await db.execute(sql`select nextval('orders_display_seq') as n`);
  const row = (res as unknown as { rows?: { n: string | number }[] }).rows?.[0];
  const n = Number(row!.n);
  return `#CR-${n}`;
}

/** Descuenta stock de forma atómica; devuelve false si no alcanza (evita negativos). */
async function decrementStock(variantId: number, qty: number): Promise<boolean> {
  const res = await db
    .update(inventoryLevels)
    .set({ stocked: sql`${inventoryLevels.stocked} - ${qty}`, updatedAt: new Date() })
    .where(and(eq(inventoryLevels.variantId, variantId), sql`${inventoryLevels.stocked} >= ${qty}`))
    .returning({ id: inventoryLevels.id });
  return res.length > 0;
}

async function restoreStock(variantId: number, qty: number): Promise<void> {
  await db
    .update(inventoryLevels)
    .set({ stocked: sql`${inventoryLevels.stocked} + ${qty}`, updatedAt: new Date() })
    .where(eq(inventoryLevels.variantId, variantId));
}

export async function createOrder(
  input: CreateOrderInput,
  actor: Actor | { name: string; role: "admin" | "asesor" | "system" },
): Promise<{ ok: true; orderId: number; displayId: string } | { ok: false; error: string; code?: string }> {
  const lines = await buildCartLines(input.items.filter((i) => i.quantity > 0));
  if (lines.length === 0) {
    return { ok: false, code: "invalid_items", error: "El pedido no tiene productos válidos." };
  }

  let customerId = input.customerId;
  if (!customerId && input.customer) {
    // Upsert atómico por email (índice único customers_email_uniq): dos envíos
    // concurrentes del mismo email no crean filas duplicadas.
    const email = input.customer.email.trim().toLowerCase();
    const [c] = await db
      .insert(customers)
      .values({
        name: input.customer.name,
        email,
        phone: input.customer.phone ?? "",
        city: input.customer.city ?? "",
        address: input.customer.address ?? "",
      })
      .onConflictDoUpdate({
        target: customers.email,
        // Solo sobrescribe lo enviado; los campos omitidos conservan el valor
        // previo (no se borran datos de contacto con un vacío).
        set: {
          name: input.customer.name,
          phone: input.customer.phone ? input.customer.phone : sql`${customers.phone}`,
          city: input.customer.city ? input.customer.city : sql`${customers.city}`,
          address: input.customer.address ? input.customer.address : sql`${customers.address}`,
        },
      })
      .returning({ id: customers.id });
    customerId = c.id;
  }
  if (!customerId) return { ok: false, error: "Falta el cliente del pedido." };

  // Totales y displayId se calculan ANTES de reservar stock: solo leen BD,
  // y si fallan no dejan stock descontado sin pedido (ventana de fuga).
  const totals = await evaluateCart(lines, input.promoCode ?? null);
  const displayId = await nextDisplayId();

  // Reserva de inventario atómica con rollback manual si alguna línea falla.
  const taken: OrderInputItem[] = [];
  for (const l of lines) {
    const ok = await decrementStock(l.variantId, l.quantity);
    if (!ok) {
      for (const t of taken) await restoreStock(t.variantId, t.quantity);
      return { ok: false, error: `Sin stock suficiente para ${l.title} · talla ${l.size}.` };
    }
    taken.push({ variantId: l.variantId, quantity: l.quantity });
  }

  const now = new Date();

  let order;
  try {
    [order] = await db
      .insert(orders)
      .values({
        displayId,
        customerId,
        source: input.source,
        status: "pending",
        operationalTag: "por_revisar",
        fulfillmentClass: input.fulfillmentClass,
        subtotalCents: totals.subtotalCents,
        discountCents: totals.discountCents,
        totalCents: totals.totalCents,
        discountBreakdown: totals.applied.map((a) => ({ label: a.label, amountCents: a.amountCents })),
        paymentRef: input.paymentRef ?? "",
        paymentMethod: input.paymentMethod ?? "",
        notes: input.notes ?? "",
        tagHistory: [{ tag: "por_revisar", at: now.toISOString(), by: actor.name }],
      })
      .returning();
  } catch (e) {
    // Devolvemos el stock ya descontado ante CUALQUIER fallo del insert.
    for (const t of taken) await restoreStock(t.variantId, t.quantity);
    const err = e as { code?: string; cause?: { code?: string } } | null;
    // Drizzle envuelve el error de PG: el código puede estar en e o en e.cause.
    if (err?.code === "23505" || err?.cause?.code === "23505") {
      // Colisión de display_id pese a la secuencia (p.ej. email duplicado u otro
      // índice único). Fallamos limpio (409) para que el cliente reintente.
      return { ok: false, error: "No se pudo crear el pedido por concurrencia. Intente de nuevo." };
    }
    // Error real (FK, red, BD): no lo enmascaramos — sube como 500 con su causa.
    throw e;
  }

  try {
    for (const l of lines) {
      const [v] = await db.select().from(variants).where(eq(variants.id, l.variantId)).limit(1);
      await db.insert(orderItems).values({
        orderId: order.id,
        variantId: l.variantId,
        productTitle: l.title,
        size: l.size,
        sku: v?.sku ?? "",
        unitPriceCents: l.unitPriceCents,
        quantity: l.quantity,
      });
    }

    if (input.fulfillmentClass === "enviar") {
      await db.insert(shipments).values({
        orderId: order.id,
        status: "revision",
        statusHistory: [{ status: "revision", at: now.toISOString(), by: actor.name }],
      });
    }

    await recordAudit({
      actor,
      module: "pedidos",
      entityType: "order",
      entityId: displayId,
      action: "create",
      summary: `Pedido ${displayId} creado desde ${input.source === "web" ? "la tienda" : "el dashboard"} · clase ${input.fulfillmentClass}.`,
      newValue: { total: totals.totalCents, items: lines.length },
    });
  } catch (e) {
    // Fallo tras reservar stock: no dejamos un pedido a medias ni inventario
    // descontado — se borra lo insertado y se devuelve el stock.
    await db.delete(orderItems).where(eq(orderItems.orderId, order.id));
    await db.delete(shipments).where(eq(shipments.orderId, order.id));
    await db.delete(orders).where(eq(orders.id, order.id));
    for (const t of taken) await restoreStock(t.variantId, t.quantity);
    throw e;
  }

  return { ok: true, orderId: order.id, displayId };
}

export async function changeOperationalTag(
  orderId: number,
  tag: OperationalTag,
  actor: Actor,
): Promise<{ ok: boolean; error?: string }> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return { ok: false, error: "Pedido no encontrado." };
  if (order.operationalTag === tag) return { ok: true };

  const history = [...order.tagHistory, { tag, at: new Date().toISOString(), by: actor.name }];
  const wasCanceled = order.status === "canceled";
  const willCancel = tag === "cancelado";

  // Reactivar un pedido cancelado exige re-reservar stock (puede fallar si ya se vendió).
  // Se hace ANTES de tocar el pedido: si no alcanza, nada cambia.
  if (wasCanceled && !willCancel) {
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    const taken: OrderInputItem[] = [];
    for (const it of items) {
      const ok = await decrementStock(it.variantId, it.quantity);
      if (!ok) {
        for (const t of taken) await restoreStock(t.variantId, t.quantity);
        return { ok: false, error: `Sin stock suficiente para ${it.productTitle} · talla ${it.size}.` };
      }
      taken.push({ variantId: it.variantId, quantity: it.quantity });
    }
  }

  await db
    .update(orders)
    .set({
      operationalTag: tag,
      tagHistory: history,
      status: tag === "completado" ? "completed" : tag === "cancelado" ? "canceled" : "pending",
    })
    .where(eq(orders.id, orderId));

  if (willCancel && !wasCanceled) {
    // Primera cancelación: se devuelve el stock UNA sola vez y se archiva el envío.
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    for (const it of items) await restoreStock(it.variantId, it.quantity);
    await db
      .update(shipments)
      .set({ status: "archivado", archivedAt: new Date() })
      .where(eq(shipments.orderId, orderId));
  } else if (wasCanceled && !willCancel) {
    // Reactivación: el envío archivado vuelve al tablero en Revisión.
    const [sh] = await db.select().from(shipments).where(eq(shipments.orderId, orderId)).limit(1);
    if (sh && sh.status === "archivado") {
      await db
        .update(shipments)
        .set({
          status: "revision",
          archivedAt: null,
          statusHistory: [
            ...sh.statusHistory,
            { status: "revision", at: new Date().toISOString(), by: actor.name },
          ],
        })
        .where(eq(shipments.orderId, orderId));
    }
  }

  await recordAudit({
    actor,
    module: "pedidos",
    entityType: "order",
    entityId: order.displayId,
    action: "status_change",
    fieldChanged: "operational_tag",
    oldValue: order.operationalTag,
    newValue: tag,
    summary: `${actor.name} cambió el estado del equipo del pedido ${order.displayId} de ${order.operationalTag} a ${tag}.`,
  });
  return { ok: true };
}

/** Job 24h: los envíos completados hace más de 24h pasan a archivados. */
export async function archiveCompletedShipments(): Promise<number> {
  const rows = await db
    .update(shipments)
    .set({ status: "archivado", archivedAt: new Date() })
    .where(
      and(
        eq(shipments.status, "completado"),
        sql`${shipments.completedAt} is not null and ${shipments.completedAt} <= now() - interval '24 hours'`,
      ),
    )
    .returning({ id: shipments.id });
  if (rows.length > 0) {
    await recordAudit({
      actor: { name: "Sistema", role: "system" },
      module: "envios",
      entityType: "shipment",
      action: "status_change",
      summary: `${rows.length} envío(s) completados hace más de 24h pasaron a Archivados.`,
    });
  }
  return rows.length;
}
