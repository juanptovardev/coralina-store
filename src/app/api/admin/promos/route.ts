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

  if (action === "create") {
    const type = String(body.type ?? "");
    const VALID_TYPES = ["category_percent", "category_amount", "sku_percent", "combo", "cart_amount"];
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ ok: false, error: "Tipo de promoción inválido." }, { status: 400 });
    }
    const amountCents = Number(body.amountCents ?? 0);
    const percent = Number(body.percent ?? 0);
    const comboPriceCents = Number(body.comboPriceCents ?? 0);
    if (type === "category_amount" && amountCents <= 0) {
      return NextResponse.json(
        { ok: false, error: "El descuento fijo por categoría requiere un monto mayor a 0." },
        { status: 400 },
      );
    }
    if (type === "cart_amount" && amountCents <= 0 && percent <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "El descuento por monto de carrito requiere un monto o un porcentaje mayor a 0.",
        },
        { status: 400 },
      );
    }
    if (type === "combo" && comboPriceCents <= 0) {
      return NextResponse.json(
        { ok: false, error: "El combo requiere un precio de combo mayor a 0." },
        { status: 400 },
      );
    }
    // Rango de porcentaje: un typo (p.ej. 500) no debe volverse 100% de descuento.
    if ((type === "category_percent" || type === "sku_percent") && (percent <= 0 || percent > 100)) {
      return NextResponse.json(
        { ok: false, error: "El porcentaje debe estar entre 1 y 100." },
        { status: 400 },
      );
    }
    if (type === "cart_amount" && percent > 100) {
      return NextResponse.json(
        { ok: false, error: "El porcentaje debe estar entre 0 y 100." },
        { status: 400 },
      );
    }
    const nums = {
      amountCents,
      percent,
      comboPriceCents,
      minSubtotalCents: Number(body.minSubtotalCents ?? 0),
      minQty: Number(body.minQty ?? 0),
      priority: Number(body.priority ?? 10),
    };
    if (Object.values(nums).some((v) => !Number.isFinite(v))) {
      return NextResponse.json({ ok: false, error: "Montos o cantidades inválidos." }, { status: 400 });
    }
    if (body.endsAt && Number.isNaN(new Date(body.endsAt).getTime())) {
      return NextResponse.json({ ok: false, error: "Fecha de fin inválida." }, { status: 400 });
    }
    // Frontera admin → motor de precios: el storefront (domain.ts) solo
    // interpreta productIds en sku_percent (un producto) y categoryIds en el
    // resto; se normaliza para que ambos motores calculen lo mismo.
    let categoryIds = (body.categoryIds as number[]) ?? [];
    let productIds = (body.productIds as number[]) ?? [];
    if (type === "sku_percent") {
      categoryIds = [];
      if (productIds.length !== 1) {
        return NextResponse.json(
          { ok: false, error: "sku_percent requiere exactamente 1 producto (contrato del storefront)." },
          { status: 400 },
        );
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
      return NextResponse.json(
        { ok: false, error: "Una promo por categoría necesita al menos una categoría." },
        { status: 400 },
      );
    }
    const [p] = await db
      .insert(promotions)
      .values({
        name: String(body.name ?? "Promo sin nombre"),
        type: type as (typeof promotions.$inferInsert)["type"],
        categoryIds,
        productIds,
        percent: Number(body.percent ?? 0),
        amountCents: Number(body.amountCents ?? 0),
        minQty: Number(body.minQty ?? 0),
        minSubtotalCents: Number(body.minSubtotalCents ?? 0),
        comboPriceCents: Number(body.comboPriceCents ?? 0),
        priority: Number(body.priority ?? 10),
        // Contrato single-promo (PRD 12.2): el motor no apila; se persiste
        // false para que la fila no mienta sobre el efecto real.
        stackable: false,
        enabled: body.enabled !== false,
        code: String(body.code ?? "").trim().toUpperCase(),
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
      })
      .returning();
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
