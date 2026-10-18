import { cookies } from "next/headers";
import { decodeRole, encodeRole } from "./session-sign";

export type SessionRole = "admin" | "asesor" | "cliente";

// Formato básico local@dominio.tld. La identidad guardada SIEMPRE viene
// normalizada (trim+lowercase) al emitirse en /api/mi-cuenta/session.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Rol de la sesión actual leído de la cookie `coralina_role` (verificada por
 * session-sign). null si no hay sesión válida. Nunca lanza (fail-closed → null).
 */
export async function getSessionRole(): Promise<SessionRole | null> {
  try {
    const raw = (await cookies()).get("coralina_role")?.value;
    const role = await decodeRole(raw);
    return role === "admin" || role === "asesor" || role === "cliente" ? role : null;
  } catch {
    return null;
  }
}

/**
 * Email de la sesión, leído de la cookie `coralina_identity` (firmada con el
 * mismo HMAC que el rol). La emite /api/mi-cuenta/session SOLO tras verificar
 * la contraseña de la cuenta; así el email nunca llega por el body de las
 * acciones de /api/mi-cuenta. null si falta o es inválida (fail-closed).
 */
export async function getSessionEmail(): Promise<string | null> {
  try {
    const raw = (await cookies()).get("coralina_identity")?.value;
    const value = await decodeRole(raw);
    if (!value) return null;
    const email = value.trim().toLowerCase();
    if (email.length === 0 || email.length > 254 || !EMAIL_RE.test(email)) return null;
    return email;
  } catch {
    return null;
  }
}

/** Codifica el email para la cookie de identidad (firmada en prod). */
export async function encodeSessionIdentity(email: string): Promise<string> {
  return encodeRole(email.trim().toLowerCase());
}
