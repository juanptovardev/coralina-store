import type { BannerConfig, WidgetInstance } from "@/db/schema";
import { BANNER_RATIO_MAX, BANNER_RATIO_MIN } from "./constants";

/**
 * Contraste estimado entre el texto blanco del hero y la foto del banner.
 * La zona de CONTENIDO recibe el overlay configurable + el degradado fijo (0.22)
 * que aplica el renderer. Umbral: 3:1 (WCAG AA para texto grande / display).
 */
export function contrastOk(overlayOpacity: number): boolean {
  return contrastRatio(overlayOpacity) >= 3;
}

export function contrastRatio(overlayOpacity: number): number {
  const PHOTO_LUMINANCE = 0.55; // foto de playa: clara
  const GRADIENT_BOOST = 0.22; // degradado fijo del renderer sobre la zona de contenido
  const effective = Math.min(0.95, overlayOpacity + GRADIENT_BOOST);
  const bgLum = PHOTO_LUMINANCE * (1 - effective);
  return (1.0 + 0.05) / (bgLum + 0.05);
}

export type ChecklistItem = { id: string; label: string; ok: boolean; hint: string };

export function publishChecklist(layout: {
  banner: BannerConfig;
  widgets: WidgetInstance[];
}): ChecklistItem[] {
  // Defensivo: los layouts migrados de v4 traen banner/widgets con otra forma
  // (widgets como objeto, banner.aspect). No debe reventar el GET del admin.
  const banner = (layout.banner ?? {}) as Partial<BannerConfig> & { aspect?: number; overlay?: number; slides?: { image?: string }[] };
  const widgets = Array.isArray(layout.widgets) ? layout.widgets : [];
  const ratio = banner.aspectRatio ?? banner.aspect ?? 0;
  const ratioOk = ratio >= BANNER_RATIO_MIN && ratio <= BANNER_RATIO_MAX;
  const hasImage = Boolean(readBanner(layout.banner).image);
  const title = widgets.find((w) => w.type === "title" && w.enabled);
  const cta = widgets.find((w) => w.type === "cta_primary" && w.enabled);
  const ctaLink = cta ? String((cta.props.link as string) ?? "") : "";
  const linkOk = !cta || /^(url:\/|url:https?:\/\/|product:|category:|collection:)/.test(ctaLink);
  const overlay = banner.overlayOpacity ?? banner.overlay ?? 0;

  return [
    { id: "image", label: "Imagen de banner cargada", ok: hasImage, hint: "Sube una foto horizontal." },
    {
      id: "ratio",
      label: "Proporción del banner dentro del rango 16:7.5 – 16:4.17",
      ok: ratioOk,
      hint: "Ajusta el slider de alto del banner.",
    },
    {
      id: "copy",
      label: "Al menos un título o un CTA activo",
      ok: Boolean(title || cta),
      hint: "Activa el widget Título o el CTA primario.",
    },
    {
      id: "contrast",
      label: "Contraste del texto sobre la foto (WCAG AA texto grande)",
      ok: contrastOk(overlay),
      hint: "Sube el overlay de contraste (mín. ~24%) para que el texto blanco se lea.",
    },
    { id: "links", label: "Enlaces de los CTA válidos", ok: linkOk, hint: "Usa una ruta interna o https://" },
  ];
}

export function readBanner(b: unknown) {
  const x = (b ?? {}) as Partial<BannerConfig> & { aspect?: number; overlay?: number; slides?: { image?: string }[] };
  return {
    image: x.imageUrl ?? x.slides?.[0]?.image ?? "",
    aspect: x.aspectRatio ?? x.aspect ?? 2.6,
    overlay: x.overlayOpacity ?? x.overlay ?? 0,
  };
}

/**
 * Convierte el `widgets` de un layout v4 (objeto booleano) a la forma v5
 * (array de instancias). Así el editor muestra capas, el checklist puede
 * evaluarse y guardar migra la fila sin pisar datos. Si ya es array, se
 * devuelve intacto.
 */
export function normalizeWidgets(raw: unknown, slide?: Record<string, any>): WidgetInstance[] {
  if (Array.isArray(raw)) return raw as WidgetInstance[];
  if (!raw || typeof raw !== "object") return [];
  const w = raw as Record<string, any>;
  const s = (slide ?? {}) as Record<string, any>;
  const on = (v: unknown) => v !== false; // en v4 la ausencia significa activo
  const link = (v: unknown): string => {
    const val = typeof v === "string" ? v.trim() : "";
    if (!val) return "url:/coleccion";
    if (/^(url:|product:|category:|collection:)/.test(val)) return val;
    if (val === "collection") return "url:/coleccion";
    if (/^https?:\/\//.test(val)) return `url:${val}`;
    return val.startsWith("/") ? `url:${val}` : `url:/${val}`;
  };
  const base = (type: WidgetInstance["type"], props: Record<string, unknown>) => ({
    id: String(type),
    type,
    enabled: true,
    slot: "content_main" as WidgetInstance["slot"],
    grid: { colStart: 1, colSpan: 6, row: 1, align: "left" as const },
    props,
    zIndex: 1,
  });
  const benefits = Array.isArray(w.benefits)
    ? w.benefits.filter((b: any) => b?.on).map((b: any) => ({ icon: b?.icon, text: b?.text }))
    : [];
  return [
    { ...base("kicker", { text: s.kicker ?? "" }), enabled: on(w.kicker), slot: "content_top" },
    base("title", { text: s.title ?? "", size: s.titleSize ?? "L" }),
    { ...base("subtitle", { text: s.subtitle ?? "" }), enabled: on(w.subtitle) },
    { ...base("cta_primary", { label: s.ctaLabel ?? "Comprar", link: link(s.ctaLink) }), enabled: on(w.ctaPrimary), slot: "content_bottom" },
    { ...base("cta_secondary", { label: s.cta2Label ?? "Ver más", link: link(s.cta2Link) }), enabled: on(w.ctaSecondary), slot: "content_bottom" },
    { ...base("benefits", { items: benefits }), enabled: benefits.length > 0, slot: "benefits_bar" },
    { ...base("slider_dots", {}), enabled: on(w.dots), slot: "content_bottom" },
  ] as WidgetInstance[];
}

/** Normaliza el banner v4/v5 a la forma que espera el editor (con claves v5). */
export function normalizeBanner(raw: unknown): Record<string, any> {
  const b = (raw ?? {}) as Record<string, any>;
  const slide = Array.isArray(b.slides) ? b.slides[0] : undefined;
  return {
    ...b,
    imageUrl: b.imageUrl ?? slide?.image ?? "",
    aspectRatio: b.aspectRatio ?? b.aspect ?? 2.6,
    overlayOpacity: b.overlayOpacity ?? b.overlay ?? 0.3,
  };
}

const SECTION_V4_TO_V5: Record<string, string> = {
  categorias: "categories",
  destacados: "featured",
  editorial: "editorial",
  testimonios: "testimonials",
  newsletter: "newsletter",
  footer: "footer",
  combo: "combo",
};

const SECTION_V5_TO_V4: Record<string, string> = {
  categories: "categorias",
  featured: "destacados",
  editorial: "editorial",
  testimonials: "testimonios",
  newsletter: "newsletter",
  footer: "footer",
  combo: "combo",
};

/** Convierte secciones v4 (data) a v5 (props) para el editor. */
export function normalizeSections(raw: unknown): any[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s: any, i: number) => ({
    id: s?.id ?? `s${i}`,
    type: SECTION_V4_TO_V5[s?.type] ?? s?.type,
    order: typeof s?.order === "number" ? s.order : i,
    enabled: s?.enabled !== false,
    props: s?.props ?? s?.data ?? {},
  }));
}

/** Normaliza un layout v4/v5 a la forma que espera el editor/renderer. */
export function normalizeLayout(l: any): any {
  const banner = normalizeBanner(l?.banner);
  const slide = Array.isArray(banner.slides) ? banner.slides[0] : undefined;
  return {
    ...l,
    banner,
    widgets: normalizeWidgets(l?.widgets, slide),
    sections: normalizeSections(l?.sections),
  };
}

/** Inverso: widgets v5 (array) → objeto v4 que consume el storefront. */
export function denormalizeWidgets(raw: unknown): Record<string, any> {
  if (!Array.isArray(raw)) return (raw ?? {}) as Record<string, any>;
  const find = (t: string) => raw.find((w: any) => w?.type === t) as any;
  const benefitsW = find("benefits");
  const benefitItems =
    benefitsW?.enabled !== false && Array.isArray(benefitsW?.props?.items) ? benefitsW.props.items : [];
  return {
    dots: find("slider_dots")?.enabled !== false,
    kicker: find("kicker")?.enabled !== false,
    subtitle: find("subtitle")?.enabled !== false,
    ctaPrimary: find("cta_primary")?.enabled !== false,
    ctaSecondary: find("cta_secondary")?.enabled !== false,
    benefits: benefitItems
      .filter((it: any) => it)
      .map((it: any) => ({ on: true, icon: it.icon ?? "wave", text: it.text ?? "" })),
  };
}

/** Inverso: secciones v5 → v4 (data) para el storefront. */
export function denormalizeSections(raw: unknown): any[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s: any, i: number) => ({
    type: SECTION_V5_TO_V4[s?.type] ?? s?.type,
    enabled: s?.enabled !== false,
    data: s?.props ?? s?.data ?? {},
    order: typeof s?.order === "number" ? s.order : i,
    ...(s?.locked ? { locked: true } : {}),
  }));
}

/** Escribe el texto de los widgets v5 de vuelta a la primera slide (home v4). */
export function applyWidgetsToSlide(banner: Record<string, any>, widgets: unknown): Record<string, any> {
  if (!Array.isArray(widgets)) return banner;
  const b = { ...banner };
  const slides = Array.isArray(b.slides) ? [...b.slides] : [];
  if (slides.length === 0) return b;
  const find = (t: string) => widgets.find((w: any) => w?.type === t) as any;
  const s0 = { ...slides[0] };
  const set = (key: string, val: unknown) => {
    if (typeof val === "string") s0[key] = val;
  };
  const unlink = (v: unknown) => (typeof v === "string" ? v.replace(/^url:/, "") : "");
  set("kicker", find("kicker")?.props?.text);
  set("title", find("title")?.props?.text);
  set("subtitle", find("subtitle")?.props?.text);
  set("ctaLabel", find("cta_primary")?.props?.label);
  set("cta2Label", find("cta_secondary")?.props?.label);
  const cta1 = find("cta_primary");
  const cta2 = find("cta_secondary");
  if (cta1) set("ctaLink", unlink(cta1.props?.link));
  if (cta2) set("cta2Link", unlink(cta2.props?.link));
  slides[0] = s0;
  b.slides = slides;
  return b;
}
