import { db } from "@/db";
import {
  customers,
  inventoryLevels,
  orderItems,
  orders,
  products,
  promotions,
  shipments,
  variants,
  type OperationalTag,
} from "@/db/schema";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { canChangeTag } from "./domain";
import { recordAudit } from "./audit";
import { evaluateCart, type CartLine } from "./promo";
import type { Actor } from "./session";

/** Cliente de ejecución: el pool global (db) o la transacción en curso (tx). */
type DbClient = Pick<typeof db, "select" | "insert" | "update">;

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
  idempotencyKey?: string | null;
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
async function decrementStock(variantId: number, qty: number, client: DbClient = db): Promise<boolean> {
  const res = await client
    .update(inventoryLevels)
    .set({ stocked: sql`${inventoryLevels.stocked} - ${qty}`, updatedAt: new Date() })
    .where(and(eq(inventoryLevels.variantId, variantId), sql`${inventoryLevels.stocked} >= ${qty}`))
    .returning({ id: inventoryLevels.id });
  return res.length > 0;
}

/**
 * Repone stock. Contrato: solo vale para pedidos que descontaron al crearse
 * (createOrder); los pedidos del seed se insertan directo en SQL y no descuentan.
 */
export async function restoreStock(variantId: number, qty: number, client: DbClient = db): Promise<void> {
  await client
    .update(inventoryLevels)
    .set({ stocked: sql`${inventoryLevels.stocked} + ${qty}`, updatedAt: new Date() })
    .where(eq(inventoryLevels.variantId, variantId));
}

export async function createOrder(
  input: CreateOrderInput,
  actor: Actor | { name: string; role: "admin" | "asesor" | "system" },
): Promise<{ ok: true; orderId: number; displayId: string } | { ok: false; error: string; code?: string }> {
  // Idempotencia: si el cliente reintenta el MISMO intento de checkout (misma
  // key), devolvemos el pedido ya creado sin tocar stock ni insertar nada.
  const idempotencyKey = input.idempotencyKey?.trim() || null;
  if (idempotencyKey) {
    const [existing] = await db
      .select({ id: orders.id, displayId: orders.displayId })
      .from(orders)
      .where(eq(orders.idempotencyKey, idempotencyKey))
      .limit(1);
    if (existing) {
      return { ok: true, orderId: existing.id, displayId: existing.displayId };
    }
  }

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

  // Totales y displayId se calculan ANTES de la transacción: solo leen BD,
  // y si fallan no dejan nada a medias.
  const totals = await evaluateCart(lines, input.promoCode ?? null);
  const displayId = await nextDisplayId();

  const now = new Date();
  const appliedPromo = totals.applied[0] ?? null;

  try {
    const created = await db.transaction(async (tx) => {
      // Reserva de inventario: el WHERE garantiza stocked >= qty (sin negativos).
      // Si una línea no alcanza, la tx completa hace rollback: no queda stock
      // descontado sin pedido (el rollback manual ya no existe).
      for (const l of lines) {
        const ok = await decrementStock(l.variantId, l.quantity, tx);
        if (!ok) {
          return {
            ok: false as const,
            error: `Sin stock suficiente para ${l.title} · talla ${l.size}.`,
          };
        }
      }

      const [order] = await tx
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
          // Atribución de promo (analítica F3): id de la promo aplicada
          // (single-promo por prioridad; espeja discount_breakdown[0]).
          promoId: appliedPromo?.id ?? null,
          paymentRef: input.paymentRef ?? "",
          paymentMethod: input.paymentMethod ?? "",
          // paid_at: el checkout web paga al confirmar (web = pagado en la
          // creación); los manuales se estampan cuando el tag llega a
          // completado (transitionTag).
          paidAt: input.source === "web" ? now : null,
          notes: input.notes ?? "",
          tagHistory: [{ tag: "por_revisar", at: now.toISOString(), by: actor.name }],
          updatedAt: now,
          idempotencyKey,
        })
        .returning();

      for (const l of lines) {
        const [v] = await tx.select().from(variants).where(eq(variants.id, l.variantId)).limit(1);
        await tx.insert(orderItems).values({
          orderId: order.id,
          variantId: l.variantId,
          productId: l.productId,
          categoryId: l.categoryId,
          productTitle: l.title,
          size: l.size,
          sku: v?.sku ?? "",
          unitPriceCents: l.unitPriceCents,
          quantity: l.quantity,
        });
      }

      if (input.fulfillmentClass === "enviar") {
        await tx.insert(shipments).values({
          orderId: order.id,
          status: "revision",
          statusHistory: [{ status: "revision", at: now.toISOString(), by: actor.name }],
        });
      }

      // Promo aplicada: su contador de usos sube dentro de la MISMA transacción.
      if (appliedPromo) {
        await tx
          .update(promotions)
          .set({ usageCount: sql`${promotions.usageCount} + 1` })
          .where(eq(promotions.id, appliedPromo.id));
      }

      await recordAudit(
        {
          actor,
          module: "pedidos",
          entityType: "order",
          entityId: displayId,
          action: "create",
          summary: `Pedido ${displayId} creado desde ${input.source === "web" ? "la tienda" : "el dashboard"} · clase ${input.fulfillmentClass}.`,
          newValue: { total: totals.totalCents, items: lines.length },
        },
        tx,
      );

      return { ok: true as const, orderId: order.id };
    });

    if (!created.ok) {
      return { ok: false, error: created.error };
    }
    return { ok: true, orderId: created.orderId, displayId };
  } catch (e) {
    const err = e as { code?: string; cause?: { code?: string } } | null;
    // Drizzle envuelve el error de PG: el código puede estar en e o en e.cause.
    if (err?.code === "23505" || err?.cause?.code === "23505") {
      // Colisión de display_id pese a la secuencia (p.ej. email duplicado u otro
      // índice único). Fallamos limpio (409) para que el cliente reintente.
      return { ok: false, error: "No se pudo crear el pedido por concurrencia. Intente de nuevo." };
    }
    // Error real (FK, red, BD): no lo enmascaramos — sube como 500 con su causa.
    // El rollback de la tx ya devolvió todo a su estado previo.
    throw e;
  }
}

export type TagTransitionResult =
  | { ok: true }
  | { noop: true }
  | { ok: false; status: number; error: string };

/** Falla de una transición de tag: sale de la tx como excepción para forzar rollback. */
class TagTransitionRejected extends Error {
  constructor(readonly result: { ok: false; status: number; error: string }) {
    super(result.error);
  }
}

/**
 * Transición de tag en UNA transacción: SELECT ... FOR UPDATE serializa dos
 * cambios concurrentes sobre la misma fila (mata el TOCTOU del guard+update),
 * valida contra la matriz canChangeTag y aplica tag + tag_history + stock +
 * envío + audit dentro de la misma tx. Nada se persiste a medias.
 */
export async function transitionTag(
  orderId: number,
  tag: OperationalTag,
  actor: Actor,
): Promise<TagTransitionResult> {
  try {
    return await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1)
        .for("update");
      if (!order) {
        throw new TagTransitionRejected({ ok: false, status: 404, error: "Pedido no encontrado." });
      }
      if (order.operationalTag === tag) return { noop: true };

      const [ship] = await tx.select().from(shipments).where(eq(shipments.orderId, orderId)).limit(1);
      const check = canChangeTag(order.operationalTag, tag, ship?.status ?? null);
      if (!check.ok) {
        throw new TagTransitionRejected({
          ok: false,
          status: 409,
          error: check.reason ?? "Transición no permitida.",
        });
      }

      const history = [...order.tagHistory, { tag, at: new Date().toISOString(), by: actor.name }];
      const wasCanceled = order.status === "canceled";
      const willCancel = tag === "cancelado";

      // Reactivar un pedido cancelado exige re-reservar stock (puede fallar si
      // ya se vendió). Si no alcanza, la tx hace rollback y nada cambia.
      if (wasCanceled && !willCancel) {
        const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
        for (const it of items) {
          const ok = await decrementStock(it.variantId, it.quantity, tx);
          if (!ok) {
            throw new TagTransitionRejected({
              ok: false,
              status: 400,
              error: `Sin stock suficiente para ${it.productTitle} · talla ${it.size}.`,
            });
          }
        }
      }

      await tx
        .update(orders)
        .set({
          operationalTag: tag,
          tagHistory: history,
          status: tag === "completado" ? "completed" : tag === "cancelado" ? "canceled" : "pending",
          // Ciclo de vida (F3): cancelado estampa canceled_at (solo la primera
          // vez; re-cancelar no lo pisa) y se limpia al salir del tag.
          canceledAt: willCancel ? (order.canceledAt ?? new Date()) : null,
          // Completado estampa paid_at si aún no existe (los web ya lo traen
          // desde createOrder). undefined = drizzle omite la columna.
          paidAt: tag === "completado" ? (order.paidAt ?? new Date()) : undefined,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));

      if (willCancel && !wasCanceled) {
        // Primera cancelación: se devuelve el stock UNA sola vez y se archiva el envío.
        const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
        for (const it of items) await restoreStock(it.variantId, it.quantity, tx);
        await tx
          .update(shipments)
          .set({ status: "archivado", archivedAt: new Date() })
          .where(eq(shipments.orderId, orderId));
      } else if (wasCanceled && !willCancel) {
        // Reactivación: el envío archivado vuelve al tablero en Revisión.
        const [sh] = await tx.select().from(shipments).where(eq(shipments.orderId, orderId)).limit(1);
        if (sh && sh.status === "archivado") {
          await tx
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

      await recordAudit(
        {
          actor,
          module: "pedidos",
          entityType: "order",
          entityId: order.displayId,
          action: "status_change",
          fieldChanged: "operational_tag",
          oldValue: order.operationalTag,
          newValue: tag,
          summary: `${actor.name} cambió el estado del equipo del pedido ${order.displayId} de ${order.operationalTag} a ${tag}.`,
        },
        tx,
      );
      return { ok: true };
    });
  } catch (e) {
    if (e instanceof TagTransitionRejected) return e.result;
    throw e;
  }
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
