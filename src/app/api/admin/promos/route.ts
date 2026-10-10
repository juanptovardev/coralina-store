import { NextResponse } from "next/server";
import { db } from "@/db";
import { promotions } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { recordAudit } from "@/lib/audit";
import { passwordMatches } from "@/lib/admin-auth";
import { getActor } from "@/lib/session";
import { ensureSeeded } from "@/lib/seed";

export async function GET() {
  await ensureSeeded();
  const rows = await db.select().from(promotions).orderBy(asc(promotions.priority));
  const now = Date.now();
  return NextResponse.json({
    promotions: rows.map((p) => ({
      ...p,
      state:
        !p.enabled
          ? "pausada"
          : p.endsAt && p.endsAt.getTime() < now
            ? "expirada"
            : p.startsAt.getTime() > now
              ? "programada"
              : "activa",
    })),
  });
}

export async function POST(req: Request) {
  const actor = await getActor();
  type PromoBody = {
    action?: string;
    type?: string;
    name?: string;
    categoryIds?: number[];
    productIds?: number[];
    percent?: number;
    amountCents?: number;
    minQty?: number;
    minSubtotalCents?: number;
    comboPriceCents?: number;
    priority?: number;
    enabled?: boolean;
    code?: string;
    startsAt?: string | null;
    endsAt?: string | null;
    id?: number;
    password?: string;
  };
  let body: PromoBody;
  try {
    body = (await req.json()) as PromoBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Solicitud inválida." }, { status: 400 });
  }
  const action = body.action as string;

  /**
   * Guardia compartida create/update: whitelist de tipo, montos/porcentajes,
   * contrato sku_percent (1 producto), categorías obligatorias, rango de
   * fechas y minQty entero ≥ 0. Devuelve los valores normalizados listos
   * para persistir.
   */
  function validatePromo(
    promo: PromoBody,
  ): { ok: true; values: (typeof promotions.$inferInsert) } | { ok: false; error: string } {
    const type = String(promo.type ?? "");
    const VALID_TYPES = ["category_percent", "category_amount", "sku_percent", "combo", "cart_amount"];
    if (!VALID_TYPES.includes(type)) {
      return { ok: false, error: "Tipo de promoción inválido." };
    }
    const amountCents = Number(promo.amountCents ?? 0);
    const percent = Number(promo.percent ?? 0);
    const comboPriceCents = Number(promo.comboPriceCents ?? 0);
    if (type === "category_amount" && amountCents <= 0) {
      return { ok: false, error: "El descuento fijo por categoría requiere un monto mayor a 0." };
    }
    if (type === "cart_amount" && amountCents <= 0 && percent <= 0) {
      return {
        ok: false,
        error: "El descuento por monto de carrito requiere un monto o un porcentaje mayor a 0.",
      };
    }
    if (type === "combo" && comboPriceCents <= 0) {
      return { ok: false, error: "El combo requiere un precio de combo mayor a 0." };
    }
    // Rango de porcentaje: un typo (p.ej. 500) no debe volverse 100% de descuento.
    if ((type === "category_percent" || type === "sku_percent") && (percent <= 0 || percent > 100)) {
      return { ok: false, error: "El porcentaje debe estar entre 1 y 100." };
    }
    if (type === "cart_amount" && percent > 100) {
      return { ok: false, error: "El porcentaje debe estar entre 0 y 100." };
    }
    const minSubtotalCents = Number(promo.minSubtotalCents ?? 0);
    const minQty = Number(promo.minQty ?? 0);
    const priority = Number(promo.priority ?? 10);
    if (![amountCents, percent, comboPriceCents, minSubtotalCents, minQty, priority].every(Number.isFinite)) {
      return { ok: false, error: "Montos o cantidades inválidos." };
    }
    if (!Number.isInteger(minQty) || minQty < 0) {
      return { ok: false, error: "La cantidad mínima debe ser un entero mayor o igual a 0." };
    }
    let startsAt: Date | null = null;
    if (promo.startsAt !== undefined && promo.startsAt !== null && promo.startsAt !== "") {
      startsAt = new Date(promo.startsAt);
      if (Number.isNaN(startsAt.getTime())) {
        return { ok: false, error: "Fecha de inicio inválida." };
      }
    }
    let endsAt: Date | null = null;
    if (promo.endsAt) {
      endsAt = new Date(promo.endsAt);
      if (Number.isNaN(endsAt.getTime())) {
        return { ok: false, error: "Fecha de fin inválida." };
      }
    }
    if (startsAt && endsAt && endsAt < startsAt) {
      return { ok: false, error: "La fecha de fin no puede ser anterior a la fecha de inicio." };
    }
    // Frontera admin → motor de precios: el storefront (domain.ts) solo
    // interpreta productIds en sku_percent (un producto) y categoryIds en el
    // resto; se normaliza para que ambos motores calculen lo mismo.
    let categoryIds = (promo.categoryIds as number[]) ?? [];
    let productIds = (promo.productIds as number[]) ?? [];
    if (type === "sku_percent") {
      categoryIds = [];
      if (productIds.length !== 1) {
        return { ok: false, error: "sku_percent requiere exactamente 1 producto (contrato del storefront)." };
      }
    } else {
      productIds = [];
    }
    // Una promo por categoría sin categorías es un "zombie": no aplica a nada
    // y ensucia la lista. Se rechaza en el borde.
    if (
      (type === "category_percent" || type === "category_amount") &&
      (!Array.isArray(categoryIds) || categoryIds.length < 1)
    ) {
      return { ok: false, error: "Una promo por categoría necesita al menos una categoría." };
    }
    return {
      ok: true,
      values: {
        name: String(promo.name ?? "Promo sin nombre"),
        type: type as (typeof promotions.$inferInsert)["type"],
        categoryIds,
        productIds,
        percent: Number(promo.percent ?? 0),
        amountCents: Number(promo.amountCents ?? 0),
        minQty: Number(promo.minQty ?? 0),
        minSubtotalCents: Number(promo.minSubtotalCents ?? 0),
        comboPriceCents: Number(promo.comboPriceCents ?? 0),
        priority: Number(promo.priority ?? 10),
        // Contrato single-promo (PRD 12.2): el motor no apila; se persiste
        // false para que la fila no mienta sobre el efecto real.
        stackable: false,
        enabled: promo.enabled !== false,
        code: String(promo.code ?? "").trim().toUpperCase(),
        // Default "ahora" solo aplica en create: en update el merge garantiza
        // que startsAt siempre trae el valor guardado (el "" cae en el `||`).
        startsAt: startsAt ?? new Date(),
        endsAt,
      },
    };
  }

  if (action === "create") {
    const v = validatePromo(body);
    if (!v.ok) {
      return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
    }
    const [p] = await db.insert(promotions).values(v.values).returning();
    await recordAudit({
      actor,
      module: "promos",
      entityType: "promotion",
      entityId: p.id,
      action: "create",
      summary: `${actor.name} creó la promoción «${p.name}».`,
    });
    return NextResponse.json({ ok: true, id: p.id });
  }

  if (action === "update") {
    const id = Number(body.id);
    const [p] = await db.select().from(promotions).where(eq(promotions.id, id)).limit(1);
    if (!p) return NextResponse.json({ ok: false, error: "Promo no encontrada." }, { status: 404 });
    // Edición con estado combinado: cada campo no enviado toma el valor
    // guardado, así la guardia valida el resultado EFECTIVO (un update parcial
    // ni falla con defaults zombis ni borra percent/code/umbrales). También
    // hace efectivo el guard endsAt < startsAt al editar solo una de las dos.
    // endsAt: null o "" significa "quitar la fecha de fin"; startsAt vacío
    // conserva el guardado (no tiene sentido resetearlo a ahora).
    const merged = {
      action,
      id,
      type: body.type ?? p.type,
      name: body.name ?? p.name,
      categoryIds: body.categoryIds ?? p.categoryIds,
      productIds: body.productIds ?? p.productIds,
      percent: body.percent ?? p.percent,
      amountCents: body.amountCents ?? p.amountCents,
      minQty: body.minQty ?? p.minQty,
      minSubtotalCents: body.minSubtotalCents ?? p.minSubtotalCents,
      comboPriceCents: body.comboPriceCents ?? p.comboPriceCents,
      priority: body.priority ?? p.priority,
      enabled: body.enabled ?? p.enabled,
      code: body.code ?? p.code,
      startsAt: body.startsAt || p.startsAt.toISOString(),
      endsAt:
        body.endsAt === null || body.endsAt === ""
          ? null
          : body.endsAt ?? p.endsAt?.toISOString() ?? null,
    };
    const v = validatePromo(merged);
    if (!v.ok) {
      return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
    }
    const [updated] = await db
      .update(promotions)
      .set(v.values)
      .where(eq(promotions.id, id))
      .returning();
    await recordAudit({
      actor,
      module: "promos",
      entityType: "promotion",
      entityId: id,
      action: "update",
      oldValue: { name: p.name, type: p.type, enabled: p.enabled, percent: p.percent, amountCents: p.amountCents },
      newValue: {
        name: updated.name,
        type: updated.type,
        enabled: updated.enabled,
        percent: updated.percent,
        amountCents: updated.amountCents,
      },
      summary: `${actor.name} actualizó la promoción «${updated.name}».`,
    });
    return NextResponse.json({ ok: true, id });
  }

  if (action === "toggle") {
    const id = Number(body.id);
    const [p] = await db.select().from(promotions).where(eq(promotions.id, id)).limit(1);
    if (!p) return NextResponse.json({ ok: false, error: "Promo no encontrada." }, { status: 404 });
    await db.update(promotions).set({ enabled: !p.enabled }).where(eq(promotions.id, id));
    await recordAudit({
      actor,
      module: "promos",
      entityType: "promotion",
      entityId: id,
      action: "status_change",
      oldValue: p.enabled,
      newValue: !p.enabled,
      summary: `${actor.name} ${p.enabled ? "pausó" : "activó"} la promoción «${p.name}».`,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "delete") {
    if (!actor.canHardDelete) {
      return NextResponse.json({ ok: false, error: "Tu rol no permite eliminar promociones." }, { status: 403 });
    }
    if (!passwordMatches(body.password)) {
      return NextResponse.json({ ok: false, error: "Reautenticación fallida." }, { status: 401 });
    }
    const id = Number(body.id);
    const [p] = await db.select().from(promotions).where(eq(promotions.id, id)).limit(1);
    if (!p) return NextResponse.json({ ok: false, error: "Promo no encontrada." }, { status: 404 });
    await recordAudit({
      actor,
      module: "promos",
      entityType: "promotion",
      entityId: id,
      action: "delete_hard",
      oldValue: { name: p.name, type: p.type },
      summary: `${actor.name} eliminó definitivamente la promoción «${p.name}».`,
    });
    await db.delete(promotions).where(eq(promotions.id, id));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: `Acción desconocida: ${action}` }, { status: 400 });
}
