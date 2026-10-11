/** Scanner de referencias de imágenes subidas (GC de huérfanas, F5). */

// Captura el segmento tras /uploads/products/ hasta comilla/espacio/backslash/slash.
export const UPLOAD_URL_RE = /\/uploads\/products\/([^"'\s\\/]+)/g;

/**
 * Recolecta en `into` los nombres de archivo referenciados en cualquier
 * estructura (strings, arrays, objetos anidados — el jsonb de DB editable).
 * Normaliza ?query/#frag (una ref "/x.jpg?v=2" apunta al archivo "x.jpg") y
 * decodifica %xx con fallback crudo: un % malformado no debe tumbar el scan
 * con URIError (frontera, input no confiable).
 */
export function collectUploadNames(value: unknown, into: Set<string>) {
  if (typeof value === "string") {
    for (const m of value.matchAll(UPLOAD_URL_RE)) {
      const raw = m[1].split(/[?#]/)[0];
      let name = raw;
      try {
        name = decodeURIComponent(raw);
      } catch {
        /* token crudo */
      }
      into.add(name);
    }
  } else if (Array.isArray(value)) {
    for (const v of value) collectUploadNames(v, into);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectUploadNames(v, into);
  }
}
