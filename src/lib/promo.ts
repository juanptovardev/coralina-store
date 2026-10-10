import { db } from "@/db";
import { promotions } from "@/db/schema";
import { asc } from "drizzle-orm";

export type CartLine = {
  variantId: number;
  productId: number;
  categoryId: number;
  title: string;
  size: string;
  unitPriceCents: number;
  quantity: number;
};

export type AppliedPromo = { id: number; label: string; amountCents: number };

export type CartTotals = {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  applied: AppliedPromo[];
};

function eligible(
  line: CartLine,
  promo: { type: string; categoryIds: number[]; productIds: number[] },
): boolean {
  const byCat = promo.categoryIds.length > 0 && promo.categoryIds.includes(line.categoryId);
  const byProd = promo.productIds.length > 0 && promo.productIds.includes(line.productId);
  if (promo.categoryIds.length === 0 && promo.productIds.length === 0) return promo.type === "cart_amount";
  return byCat || byProd;
}

/**
 * Motor único de evaluación: se usa igual en el carrito del storefront,
 * en el preview del dashboard y al crear pedidos manuales.
 *
 * Contrato de códigos (espeja evaluatePromos de domain.ts):
 * - `code` presente → el pool se reduce a las promos que declaran ese código.
 * - Sin código → la auto-aplicación solo considera promos SIN código; una promo
 *   con `code` exige escribirlo (no se auto-aplica). Mantiene la paridad
 *   drawer/server porque domain.ts aplica la misma regla.
 * - NO apila (PRD 12.2): la primera promo aplicable por prioridad es la
 *   única que se aplica (espeja evaluatePromos de domain.ts).
 */
export async function evaluateCart(lines: CartLine[], code?: string | null): Promise<CartTotals> {
  if (lines.length === 0) {
    return { subtotalCents: 0, discountCents: 0, totalCents: 0, applied: [] };
  }
  const subtotal = lines.reduce((acc, l) => acc + l.unitPriceCents * l.quantity, 0);

  const now = new Date();
  // Desempate determinista por id: los empates de prioridad no deben elegir
  // promo distinta entre el motor server y el drawer (regla de oro V3).
  const all = await db
    .select()
    .from(promotions)
    .orderBy(asc(promotions.priority), asc(promotions.id));
  let active = all.filter(
    (p) => p.enabled && p.startsAt <= now && (!p.endsAt || p.endsAt >= now),
  );
  const wanted = (code ?? "").trim().toLowerCase();
  if (wanted) {
    // Con código: el pool se reduce a la promo que declara ese código.
    active = active.filter((p) => (p.code ?? "").trim().toLowerCase() === wanted);
  } else {
    // Sin código: la auto-aplicación solo considera promos sin código.
    active = active.filter((p) => (p.code ?? "").trim() === "");
  }

  const applied: AppliedPromo[] = [];

  for (const promo of active) {
    const scoped = lines.filter((l) => eligible(l, promo));
    if (scoped.length === 0 && promo.type !== "cart_amount") continue;

    const scopedQty = scoped.reduce((a, l) => a + l.quantity, 0);
    const scopedSubtotal = scoped.reduce((a, l) => a + l.unitPriceCents * l.quantity, 0);
    let amount = 0;

    if (promo.type === "category_percent" || promo.type === "sku_percent") {
      if (promo.minQty && scopedQty < promo.minQty) continue;
      amount = Math.round((scopedSubtotal * promo.percent) / 100);
    } else if (promo.type === "category_amount") {
      if (promo.minQty && scopedQty < promo.minQty) continue;
      // Monto fijo flat por promo (espeja domain.ts computeDiscount): igual al drawer.
      amount = Math.min(promo.amountCents, scopedSubtotal);
    } else if (promo.type === "combo") {
      const required = promo.minQty || 2;
      if (scopedQty < required) continue;
      const units: number[] = [];
      for (const l of scoped) for (let i = 0; i < l.quantity; i++) units.push(l.unitPriceCents);
      units.sort((a, b) => b - a);
      const bundles = Math.floor(units.length / required);
      let covered = 0;
      for (let b = 0; b < bundles; b++) {
        const slice = units.slice(b * required, b * required + required);
        covered += slice.reduce((a, v) => a + v, 0);
      }
      amount = Math.max(0, covered - promo.comboPriceCents * bundles);
    } else if (promo.type === "cart_amount") {
      // Igualar al drawer (domain.ts:190): minQty aplica sobre el total del carrito.
      const totalQty = lines.reduce((a, l) => a + l.quantity, 0);
      if (promo.minQty && totalQty < promo.minQty) continue;
      if (subtotal < promo.minSubtotalCents) continue;
      amount =
        promo.amountCents > 0
          ? Math.min(promo.amountCents, subtotal)
          : Math.round((subtotal * promo.percent) / 100);
    }

    if (amount <= 0) continue;
    // Contrato single-promo: la primera promo aplicable por prioridad es la
    // única (domain.ts hace exactamente esto con considered.find(c => c.ok)).
    applied.push({ id: promo.id, label: promo.name, amountCents: amount });
    break;
  }

  // Reconciliar el desglose: discountBreakdown se persiste en el pedido y
  // debe sumar exactamente discountCents (recorte desde el final).
  let running = applied.reduce((a, p) => a + p.amountCents, 0);
  if (running > subtotal) {
    running = subtotal;
    if (applied[0]) applied[0].amountCents = subtotal;
  }
  const discount = running;
  return {
    subtotalCents: subtotal,
    discountCents: discount,
    totalCents: subtotal - discount,
    applied,
  };
}
