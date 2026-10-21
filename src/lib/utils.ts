export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const BOGOTA_DATE: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  timeZone: "America/Bogota",
};

export function fmtDate(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("es-CO", BOGOTA_DATE);
}

export function fmtDateTime(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("es-CO", {
    ...BOGOTA_DATE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return "hace un momento";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  const days = Math.floor(s / 86400);
  return days === 1 ? "hace 1 día" : `hace ${days} días`;
}

export function daysAgoISO(days: number, hours = 0) {
  return new Date(Date.now() - days * 86400000 - hours * 3600000).toISOString();
}

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/* ------------------------- Color / contraste (WCAG) ------------------------ */

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [
    parseInt(f.slice(0, 2), 16),
    parseInt(f.slice(2, 4), 16),
    parseInt(f.slice(4, 6), 16),
  ];
}

export function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string) {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function hexToHsl(hex: string) {
  let [r, g, b] = hexToRgb(hex);
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Contraste estimado del banner: asumimos tono medio cálido de la foto
 * (#B08968) mezclado con el overlay negro. Determinista y conservador.
 */
export function bannerContrast(textOn: "light" | "dark", overlay: number) {
  const base = hexToRgb("#B08968");
  const k = 1 - Math.min(0.4, Math.max(0, overlay));
  const bg = "#" + base.map((c) => Math.round(c * k).toString(16).padStart(2, "0")).join("");
  const text = textOn === "light" ? "#FFF9EF" : "#241A10";
  const ratio = contrastRatio(text, bg);
  return { ratio: Math.round(ratio * 100) / 100, pass: ratio >= 4.5, bg, text };
}

/* --------------------------------- CSV ------------------------------------ */

export function resolveHref(link: string): string {
  if (!link) return "/coleccion";
  if (link === "collection") return "/coleccion";
  if (link.startsWith("category:")) return `/coleccion?cat=${link.slice(9)}`;
  if (link.startsWith("product:")) return `/producto/${link.slice(8)}`;
  if (link.startsWith("url:")) return link.slice(4);
  return "/coleccion";
}

export const KNOWN_ROUTES = [
  "/",
  "/coleccion",
  "/producto/",
  "/checkout",
  "/mi-cuenta",
  "/login",
  "/register",
  "/admin",
];

export function isKnown(href: string): boolean {
  if (/^https?:\/\//i.test(href)) return true;
  const path = href.split(/[?#]/)[0];
  if (path === "/") return true;
  if (path.startsWith("/producto/")) return path.length > "/producto/".length;
  return KNOWN_ROUTES.some(
    (r) => r !== "/" && r !== "/producto/" && (path === r || path.startsWith(r + "/")),
  );
}

export function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
