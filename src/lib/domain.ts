import type {
  OperationalTag,
  ShipmentStatus,
} from "@/db/schema";

/* ------------------- Máquina de estados: tag operativo --------------------- */

export const TAGS: OperationalTag[] = [
  "por_revisar",
  "por_empacar",
  "por_enviar",
  "por_recibir",
  "completado",
];

export const TAG_LABEL: Record<string, string> = {
  por_revisar: "Por revisar",
  por_empacar: "Por empacar",
  por_enviar: "Por enviar",
  por_recibir: "Por recibir",
  completado: "Completado",
  cancelado: "Cancelado",
};

/** Matriz de transiciones: adelante siempre; atrás permitido (UI confirma); cancelado desde cualquier punto salvo envío activo. */
export function canChangeTag(
  from: OperationalTag,
  to: OperationalTag,
  shipmentStatus?: ShipmentStatus | null,
): { ok: boolean; reason?: string; needsConfirm?: boolean } {
  if (from === "cancelado") return { ok: false, reason: "El pedido ya fue cancelado" };
  if (to === from) return { ok: false, reason: "Mismo estado" };
  if (to === "cancelado") {
    if (shipmentStatus === "despacho" || shipmentStatus === "reparto")
      return { ok: false, reason: "No se puede cancelar: el paquete ya salió (despacho/reparto)" };
    return { ok: true, needsConfirm: true };
  }
  if (from === "completado" && to !== "completado")
    return { ok: true, needsConfirm: true }; // reabrir: confirmación
  const fi = TAGS.indexOf(from);
  const ti = TAGS.indexOf(to);
  if (ti > fi) return { ok: true };
  if (ti < fi) return { ok: true, needsConfirm: true }; // hacia atrás: confirmación + audit
  return { ok: false, reason: "Transición no válida" };
}

/* ------------------- Máquina de estados: envío (Kanban) -------------------- */

export const SHIP_COLUMNS: { key: ShipmentStatus; label: string; hint: string }[] = [
  { key: "revision", label: "Revisión", hint: "Recibido, se verifica stock y datos" },
  { key: "despacho", label: "Despacho", hint: "Empacado, sale de bodega" },
  { key: "reparto", label: "Reparto", hint: "En manos del transportador" },
  { key: "completado", label: "Completado", hint: "Entregado (archivado automático a las 24 h)" },
];

export const SHIP_LABEL: Record<string, string> = {
  revision: "Revisión",
  despacho: "Despacho",
  reparto: "Reparto",
  completado: "Completado",
  archivado: "Archivado",
};

export function canMoveShipment(
  from: ShipmentStatus,
  to: ShipmentStatus,
  fclass: string,
  orderStatus: string,
): { ok: boolean; reason?: string } {
  if (fclass !== "enviar")
    return { ok: false, reason: "Clase no_enviar: esta orden no entra al Kanban" };
  if (orderStatus === "canceled")
    return { ok: false, reason: "Orden cancelada: su envío fue archivado" };
  if (from === to) return { ok: false, reason: "Misma columna" };
  if (to === "archivado")
    return { ok: false, reason: "El archivo es automático (24 h) o por cancelación" };
  return { ok: true };
}

/* ----------------------- Motor de promos (única fuente) -------------------- */

export type PromoLike = {
  id: string;
  name: string;
  type: "category" | "sku" | "combo" | "qty";
  scope: Record<string, unknown>;
  benefit: { kind: "pct" | "fixed"; value: number };
  startAt: string | Date;
  endAt: string | Date;
  enabled: boolean;
  priority: number;
  code: string | null;
  exclusive?: boolean;
};

export type CartLine = {
  variantId: string | number;
  productId: string | number;
  productName: string;
  categorySlug: string;
  size: string;
  sku: string;
  qty: number;
  price: number;
};

export type PromoResult = {
  subtotal: number;
  discount: number;
  total: number;
  applied: PromoLike | null;
  considered: Array<{ promo: PromoLike; ok: boolean; reason: string }>;
  note: string | null;
};

function promoActive(p: PromoLike, now = new Date()) {
  const s = new Date(p.startAt).getTime();
  const e = new Date(p.endAt).getTime();
  return p.enabled && now.getTime() >= s && now.getTime() <= e;
}

/**
 * Orden de evaluación (PRD 12.2):
 * 1. vigentes  2. elegibilidad por línea  3. reglas qty/monto
 * 4. prioridad ASC (default: más específica)  5. NO apila dos descuentos.
 */
export function evaluatePromos(
  lines: CartLine[],
  promos: PromoLike[],
  code?: string | null,
): PromoResult {
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  let pool = promos.filter((p) => promoActive(p));
  // Normalizar antes de decidir: un código en blanco ("   ") se trata como
  // "sin código" (auto-aplica solo promos sin código; espeja promo.ts).
  const wanted = (code ?? "").trim().toLowerCase();
  if (wanted) {
    pool = pool.filter((p) => (p.code ?? "").trim().toLowerCase() === wanted);
    if (!pool.length)
      return {
        subtotal,
        discount: 0,
        total: subtotal,
        applied: null,
        considered: [],
        note: `Código “${code}” no válido o vencido`,
      };
  } else {
    // Sin código: excluir promos con código (no se auto-aplican).
    pool = pool.filter((p) => (p.code ?? "").trim() === "");
  }
  const considered = pool
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .map((p) => ({ promo: p, ...eligibility(p, lines) }));
  const applied = considered.find((c) => c.ok)?.promo ?? null;
  const discount = applied ? computeDiscount(applied, lines, subtotal) : 0;
  return {
    subtotal,
    discount,
    total: subtotal - discount,
    applied,
    considered,
    note: applied
      ? null
      : wanted
        ? null
        : "Sin promos aplicables a este carrito",
  };
}

function eligibility(p: PromoLike, lines: CartLine[]) {
  if (p.type === "category") {
    const slugs =
      (p.scope.categories as string[] | undefined) ?? [p.scope.category as string];
    const hit = lines.filter((l) => slugs.includes(l.categorySlug));
    if (!hit.length) return { ok: false, reason: `Sin ítems de ${slugs.join(", ")}` };
    const minQty = (p.scope.minQty as number | undefined) ?? 0;
    const qty = hit.reduce((s, l) => s + l.qty, 0);
    if (minQty && qty < minQty)
      return { ok: false, reason: `Requiere ${minQty} ítem(s) de ${slugs.join(", ")}` };
    return { ok: true, reason: `${hit.length} línea(s) elegible(s)` };
  }
  if (p.type === "sku") {
    const hit = lines.filter((l) => l.productId === p.scope.productId);
    if (!hit.length) return { ok: false, reason: "Producto no en el carrito" };
    const minQty = (p.scope.minQty as number | undefined) ?? 0;
    const qty = hit.reduce((s, l) => s + l.qty, 0);
    if (minQty && qty < minQty)
      return { ok: false, reason: `Requiere ${minQty} unidad(es)` };
    return { ok: true, reason: "Producto presente" };
  }
  if (p.type === "combo") {
    const req = (p.scope.requires as Array<{ category: string; min: number }>) ?? [];
    const comboPrice = p.scope.comboPrice as number | undefined;
    if (comboPrice != null) {
      // Combo bundle v5 (N piezas a precio fijo): gate por TOTAL de piezas de
      // las categorías del combo (espeja promo.ts case "combo").
      const required = ((p.scope.minQty as number) ?? 0) || 2;
      const comboCats = req.map((r) => r.category);
      const qty = lines
        .filter((l) => comboCats.includes(l.categorySlug))
        .reduce((s, l) => s + l.qty, 0);
      if (qty < required) return { ok: false, reason: `Requiere ${required} piezas del combo` };
      return { ok: true, reason: "Combo completo" };
    }
    if (p.scope.union === true) {
      // Combo migrado de v4 (category_percent/junior multi-categoría):
      // elegibilidad OR sobre la unión de categorías + minQty total (espeja
      // promo.ts eligible), no exige una pieza de cada categoría.
      const comboCats = req.map((r) => r.category);
      const qty = lines
        .filter((l) => comboCats.includes(l.categorySlug))
        .reduce((s, l) => s + l.qty, 0);
      const minQty = ((p.scope.minQty as number) ?? 0) || 1;
      if (qty < minQty) return { ok: false, reason: `Requiere ${minQty} pieza(s) del combo` };
      return { ok: true, reason: "Combo completo" };
    }
    for (const r of req) {
      const qty = lines
        .filter((l) => l.categorySlug === r.category)
        .reduce((s, l) => s + l.qty, 0);
      if (qty < r.min)
        return { ok: false, reason: `Faltan ${r.min - qty} ítem(s) de ${r.category}` };
    }
    return { ok: true, reason: "Combo completo" };
  }
  if (p.type === "qty") {
    const minQty = (p.scope.minQty as number) ?? 0;
    const totalQty = lines.reduce((s, l) => s + l.qty, 0);
    const minAmount = (p.scope.minAmount as number) ?? 0;
    const amount = lines.reduce((s, l) => s + l.price * l.qty, 0);
    if (totalQty < minQty) return { ok: false, reason: `Requiere ${minQty} ítems` };
    if (minAmount && amount < minAmount)
      return { ok: false, reason: `Requiere monto mínimo` };
    return { ok: true, reason: "Cumple condición" };
  }
  return { ok: false, reason: "Tipo desconocido" };
}

function computeDiscount(p: PromoLike, lines: CartLine[], subtotal: number) {
  const comboCats = ((p.scope.requires as Array<{ category: string }>) ?? []).map((r) => r.category);
  const comboPrice = p.scope.comboPrice as number | undefined;
  if (p.type === "combo" && comboPrice != null) {
    // Bundle v5: N piezas (las más caras primero) a precio fijo — espeja la
    // matemática de bundles de promo.ts (covered − comboPrice × bundles).
    const required = ((p.scope.minQty as number) ?? 0) || 2;
    const units: number[] = [];
    for (const l of lines) {
      if (!comboCats.includes(l.categorySlug)) continue;
      for (let i = 0; i < l.qty; i++) units.push(l.price);
    }
    units.sort((a, b) => b - a);
    const bundles = Math.floor(units.length / required);
    let covered = 0;
    for (let b = 0; b < bundles; b++) {
      covered += units.slice(b * required, b * required + required).reduce((a, v) => a + v, 0);
    }
    return Math.min(subtotal, Math.max(0, covered - comboPrice * bundles));
  }
  // Combo v4: el descuento aplica sobre las líneas de las categorías del
  // combo, no sobre todo el carrito (espeja promo.ts scopedSubtotal).
  const catSlugs =
    (p.scope.categories as string[] | undefined) ??
    (p.scope.category ? [p.scope.category as string] : []);
  const base =
    p.type === "category"
      ? lines
          .filter((l) => catSlugs.includes(l.categorySlug))
          .reduce((s, l) => s + l.price * l.qty, 0)
      : p.type === "sku"
        ? lines
            .filter((l) => l.productId === p.scope.productId)
            .reduce((s, l) => s + l.price * l.qty, 0)
        : p.type === "combo"
          ? lines
              .filter((l) => comboCats.includes(l.categorySlug))
              .reduce((s, l) => s + l.price * l.qty, 0)
          : subtotal;
  const raw = p.benefit.kind === "pct" ? (base * p.benefit.value) / 100 : p.benefit.value;
  return Math.min(base, Math.round(raw));
}

/* ---------------------- Validación de publicación (Home) ------------------- */

export function validateLayoutPublish(layout: {
  banner: { slides: Array<{ image: string; title: string; ctaLabel: string; ctaLink: string; cta2Label: string; cta2Link: string }>; aspect: number; overlay: number; textOn: "light" | "dark" };
}) {
  const checks: Array<{ key: string; label: string; ok: boolean; detail: string }> = [];
  const slides = layout.banner.slides;
  checks.push({
    key: "image",
    label: "Imagen presente en todos los slides",
    ok: slides.length >= 1 && slides.every((s) => !!s.image),
    detail: slides.length ? `${slides.length} slide(s) con imagen` : "Agrega al menos 1 slide",
  });
  const aspectOk = layout.banner.aspect >= 2.13 && layout.banner.aspect <= 3.84;
  checks.push({
    key: "ratio",
    label: "Relación de aspecto dentro del rango (16:7.5 → 16:4.17)",
    ok: aspectOk,
    detail: `Actual: 16:${layout.banner.aspect.toFixed(2)}`,
  });
  checks.push({
    key: "copy",
    label: "Título o CTA primario en cada slide",
    ok: slides.every((s) => s.title.trim() || s.ctaLabel.trim()),
    detail: "Cada slide necesita título o CTA",
  });
  const linkOk = slides.every((s) => linkValid(s.ctaLink) && (linkValid(s.cta2Link) || !s.cta2Label.trim()));
  checks.push({
    key: "links",
    label: "Enlaces de CTA válidos (producto/categoría/URL http-s)",
    ok: linkOk,
    detail: "Verifica los enlaces de los CTAs",
  });
  return { checks, ok: checks.every((c) => c.ok) };
}

export function linkValid(link: string): boolean {
  if (!link || link === "collection") return link === "collection" || link === "";
  if (link.startsWith("url:"))
    return /^url:https?:\/\/.+/.test(link);
  if (link.startsWith("product:") || link.startsWith("category:"))
    return link.length > link.indexOf(":") + 1;
  return false;
}

/* ------------------------------ Inventario --------------------------------- */

export const STOCK_THRESHOLD = 5;

export function stockLevel(stock: number): "out" | "low" | "med" | "high" {
  if (stock <= 0) return "out";
  if (stock <= STOCK_THRESHOLD) return "low";
  if (stock <= 15) return "med";
  return "high";
}
