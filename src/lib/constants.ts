import type { SectionInstance, WidgetInstance } from "@/db/schema";

export const BRAND = {
  name: "Coralina",
  tagline: "Swimwear tropical·elegante",
};

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export const DEFAULT_TOKENS: Record<string, string> = {
  "color/primary": "#C9643C",
  "color/accent": "#E8A44A",
  "color/surface-warm": "#F5DFA0",
  "color/surface-base": "#FAF3E4",
  "color/ink": "#2E211B",
};

export const TOKEN_LABELS: Record<string, string> = {
  "color/primary": "Terracota · CTAs y acentos fuertes",
  "color/accent": "Ámbar · hover y badges",
  "color/surface-warm": "Arena · fondos de sección",
  "color/surface-base": "Lino · fondo general",
  "color/ink": "Tinta · textos",
};

/** Rango permitido de aspect ratio del banner: 16:7.5 → 16:4.17 */
export const BANNER_RATIO_MIN = 2.13;
export const BANNER_RATIO_MAX = 3.84;

/** Plano espacial: zona de la modelo y zona de contenido por layout (columnas 1–12). */
export const LAYOUT_PLANE = {
  preset_left: {
    label: "Izquierda",
    modelZone: [7, 12] as [number, number],
    contentZone: [1, 6] as [number, number],
    align: "left" as const,
    help: "Usa una foto horizontal donde la modelo esté a la derecha. El texto quedará a la izquierda y no le tapará la cara.",
  },
  preset_center: {
    label: "Centro",
    modelZone: [4, 9] as [number, number],
    contentZone: [3, 10] as [number, number],
    align: "center" as const,
    help: "Ideal para fotos donde la modelo está centrada y hay aire arriba o abajo. El texto va centrado, estilo editorial.",
  },
  preset_right: {
    label: "Derecha",
    modelZone: [1, 5] as [number, number],
    contentZone: [7, 12] as [number, number],
    align: "right" as const,
    help: "Usa una foto horizontal donde la modelo esté a la izquierda. El texto quedará a la derecha.",
  },
  builder: {
    label: "Constructor libre",
    modelZone: [8, 12] as [number, number],
    contentZone: [1, 7] as [number, number],
    align: "left" as const,
    help: "Tú decides dónde va cada bloque sobre la grilla de 12 columnas. Siempre revisa la vista móvil antes de publicar.",
  },
};

export type LayoutMode = keyof typeof LAYOUT_PLANE;

export const BANNER_IMAGES: Record<LayoutMode, string> = {
  preset_left:
    "https://images.pexels.com/photos/32796804/pexels-photo-32796804.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=760&w=1900",
  preset_center:
    "https://images.pexels.com/photos/32689386/pexels-photo-32689386.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=760&w=1900",
  preset_right:
    "https://images.pexels.com/photos/31277421/pexels-photo-31277421.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=760&w=1900",
  builder:
    "https://images.pexels.com/photos/34036177/pexels-photo-34036177.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=760&w=1900",
};

export const OPERATIONAL_TAGS = [
  { value: "por_revisar", label: "Por revisar" },
  { value: "por_empacar", label: "Por empacar" },
  { value: "por_enviar", label: "Por enviar" },
  { value: "por_recibir", label: "Por recibir" },
  { value: "completado", label: "Completado" },
  { value: "cancelado", label: "Cancelado" },
] as const;

export const TAG_FLOW = [
  "por_revisar",
  "por_empacar",
  "por_enviar",
  "por_recibir",
  "completado",
] as const;

export const SHIPMENT_COLUMNS = [
  { value: "revision", label: "Revisión" },
  { value: "despacho", label: "Despacho" },
  { value: "reparto", label: "Reparto" },
  { value: "completado", label: "Completado" },
] as const;

export function defaultWidgets(mode: LayoutMode): WidgetInstance[] {
  const plane = LAYOUT_PLANE[mode];
  const colStart = plane.contentZone[0];
  const colSpan = plane.contentZone[1] - plane.contentZone[0] + 1;
  const align = plane.align;
  const base = { colStart, colSpan, align };
  return [
    {
      id: "w-kicker",
      type: "kicker",
      enabled: true,
      slot: "content_top",
      grid: { ...base, row: 1 },
      props: { text: "Colección Caribe 2026" },
      zIndex: 2,
    },
    {
      id: "w-title",
      type: "title",
      enabled: true,
      slot: "content_main",
      grid: { ...base, row: 2 },
      props: { text: "El mar te queda bien", size: "L" },
      zIndex: 3,
    },
    {
      id: "w-subtitle",
      type: "subtitle",
      enabled: true,
      slot: "content_main",
      grid: { ...base, row: 3 },
      props: {
        text: "Vestidos de baño hechos a mano en Colombia. Tela italiana, secado rápido y tallaje real.",
      },
      zIndex: 3,
    },
    {
      id: "w-cta1",
      type: "cta_primary",
      enabled: true,
      slot: "content_bottom",
      grid: { ...base, row: 4 },
      props: { label: "Comprar ahora", link: "url:/catalogo" },
      zIndex: 4,
    },
    {
      id: "w-cta2",
      type: "cta_secondary",
      enabled: true,
      slot: "content_bottom",
      grid: { ...base, row: 4 },
      props: { label: "Ver colección", link: "url:/catalogo" },
      zIndex: 4,
    },
    {
      id: "w-benefits",
      type: "benefits",
      enabled: true,
      slot: "benefits_bar",
      grid: { colStart: 1, colSpan: 12, row: 5, align: "center" },
      props: {
        items: [
          { icon: "wave", text: "Envío gratis desde $250.000" },
          { icon: "shell", text: "Cambios de talla sin costo" },
          { icon: "coral", text: "Hecho a mano en Colombia" },
        ],
      },
      zIndex: 5,
    },
    {
      id: "w-dots",
      type: "slider_dots",
      enabled: false,
      slot: "content_bottom",
      grid: { ...base, row: 6 },
      props: {},
      zIndex: 2,
    },
  ];
}

export function defaultSections(): SectionInstance[] {
  return [
    { id: "s-categories", type: "categories", enabled: true, order: 1, props: { title: "Explora por categoría" } },
    { id: "s-featured", type: "featured", enabled: true, order: 2, props: { title: "Lo más deseado" } },
    { id: "s-editorial", type: "editorial", enabled: true, order: 3, props: { title: "Hecho para el agua" } },
    { id: "s-testimonials", type: "testimonials", enabled: true, order: 4, props: {} },
    { id: "s-newsletter", type: "newsletter", enabled: true, order: 5, props: {} },
    { id: "s-footer", type: "footer", enabled: true, order: 6, props: {} },
  ];
}

export function formatCOP(cents: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Math.round(cents / 100));
}

/** Umbral de envío gratis en céntimos: $250.000 COP. Único punto de verdad para toda la tienda. */
export const FREE_SHIPPING_CENTS = 25_000_000;
