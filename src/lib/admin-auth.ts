// Credencial de reautenticación del panel admin (acciones destructivas + login).
// Fail-closed en producción: sin CORALINA_ADMIN_PASSWORD se rechaza TODO (no hay
// default público). En dev/QA cae a "coralina" para no romper el demo local.
//
// Nota: la comparación no es constant-time. Mitigado por el rate-limit del
// boundary; se difiere un timingSafeEqual (reviews lo dejaron como opcional).

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
    return String(input ?? "") === adminPassword();
  } catch {
    return false;
  }
}
