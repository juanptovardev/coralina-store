// Credencial de reautenticación del panel admin (acciones destructivas + login).
// Fail-closed en producción: sin CORALINA_ADMIN_PASSWORD se rechaza TODO (no hay
// default público). En dev/QA cae a "coralina" para no romper el demo local.
//
// Comparación constant-time: se hashea ambos lados con sha256 (normaliza la
// longitud) y se compara con timingSafeEqual — evita fugas por timing sin
// filtrar la longitud del secreto.

import { createHash, timingSafeEqual } from "node:crypto";

export function adminPassword(): string {
  const p = process.env.CORALINA_ADMIN_PASSWORD;
  if (p) return p;
  if (process.env.NODE_ENV === "production") {
    throw new Error("CORALINA_ADMIN_PASSWORD requerido en producción");
  }
  return "coralina"; // solo dev/QA
}

/** true solo si `input` coincide con la clave admin. Fail-closed: nunca lanza. */
export function passwordMatches(input: unknown): boolean {
  try {
    const expected = adminPassword();
    const given = String(input ?? "");
    const a = createHash("sha256").update(given, "utf8").digest();
    const b = createHash("sha256").update(expected, "utf8").digest();
    return timingSafeEqual(a, b);
  } catch (e) {
    // Fail-closed: sin clave configurada en prod, TODO intento se deniega. Log para ops
    // (distingue "clave incorrecta" de "app mal configurada").
    console.error("[admin-auth] clave admin no disponible:", e);
    return false;
  }
}
