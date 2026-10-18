import { cookies } from "next/headers";
import { decodeRole } from "./session-sign";

export type SessionRole = "admin" | "asesor" | "cliente";

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
