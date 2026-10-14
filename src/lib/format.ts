/**
 * Helpers de formato/parseo de precios en formato colombiano (es-CO).
 * Entrada del admin: pesos con "." de miles y "," de decimales.
 * Salida interna: centavos (entero), igual que price_cents en la BD.
 */

/** Limpia espacios, "$" y separadores; devuelve el número en pesos o null. */
function toPesos(raw: string): number | null {
  if (typeof raw !== "string") return null;
  let t = raw.trim().replace(/[$\s\u00A0]/g, "");
  if (!t || !/^[0-9.,]+$/.test(t)) return null;

  const hasDot = t.includes(".");
  const hasComma = t.includes(",");
  if (hasDot && hasComma) {
    // es-CO puro: "28.990,50" → el punto es miles y la coma decimal.
    t = t.replace(/\./g, "").replace(/,/g, ".");
  } else if (hasComma) {
    // Solo coma: siempre es decimal ("28990,50").
    t = t.replace(/,/g, ".");
  } else if (hasDot) {
    // Solo punto: ambiguo. Convención es-CO → miles si el último grupo
    // tiene 3 dígitos ("28.990", "1.234.567"); si no, decimal ("28990.5").
    const parts = t.split(".");
    const last = parts[parts.length - 1];
    if (parts.length > 2 || (parts.length === 2 && last.length === 3)) {
      t = t.replace(/\./g, "");
    }
  }

  const value = Number(t);
  if (!Number.isFinite(value)) return null;
  return value;
}

/** "28990" | "28.990" | "28990,50" | "28.990,50" → centavos. null si no parsea o ≤ 0. */
export function parsePriceInput(s: string): number | null {
  const pesos = toPesos(s);
  if (pesos === null || pesos <= 0) return null;
  return Math.round(pesos * 100);
}

/** Centavos → texto para prellenar el input del admin: 2899050 → "28.990,50". */
export function formatPriceInput(cents: number): string {
  if (!Number.isFinite(cents) || cents <= 0) return "";
  const whole = Math.floor(cents / 100);
  const frac = Math.round(cents % 100);
  const wholeStr = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return frac > 0 ? `${wholeStr},${String(frac).padStart(2, "0")}` : wholeStr;
}
