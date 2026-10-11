/** Scanner de referencias de imágenes subidas (GC de huérfanas, F5). */

// Captura el segmento tras /uploads/products/ hasta comilla/espacio/backslash/slash.
export const UPLOAD_URL_RE = /\/uploads\/products\/([^"'\s\\/]+)/g;

/**
 * Recolecta en `into` los nombres de archivo referenciados en cualquier
 * estructura (strings, arrays, objetos anidados — el jsonb de DB editable).
 * Normaliza ?query/#frag (una ref "/x.jpg?v=2" apunta al archivo "x.jpg").
 * Sin decodeURIComponent: los uploads son uuid.ext (nunca van codificados) y
 * decodificar %xx puede fabricar tokens imposibles (p.ej. %2F → "/") que
 * jamás igualan un nombre de disco; un % malformado tampoco puede lanzar.
 */
export function collectUploadNames(value: unknown, into: Set<string>) {
  if (typeof value === "string") {
    for (const m of value.matchAll(UPLOAD_URL_RE)) {
      into.add(m[1].split(/[?#]/)[0]);
    }
  } else if (Array.isArray(value)) {
    for (const v of value) collectUploadNames(v, into);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectUploadNames(v, into);
  }
}
