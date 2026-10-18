import { cookies } from "next/headers";
import { decodeRole } from "./session-sign";

export type Role = "admin" | "asesor" | "cliente";

export type Actor = {
  role: Role;
  name: string;
  canHardDelete: boolean;
  canPurgeAudit: boolean;
};

const NAMES: Record<Role, string> = {
  admin: "Sofía Marín (Admin)",
  asesor: "Juan Pérez (Asesor)",
  cliente: "Cliente",
};

export async function getActor(): Promise<Actor> {
  const store = await cookies();
  const raw = store.get("coralina_role")?.value;
  // Prod: la cookie va firmada (HMAC). Dev/QA: se acepta el valor plano.
  const decoded = await decodeRole(raw);
  // Sigue estricto admin|asesor: "cliente" (T2) queda fuera de getActor a propósito
  // (defensa en profundidad de /api/admin/*). El panel de cliente valida su sesión
  // con getSessionRole (session-role.ts), no con getActor.
  if (decoded !== "admin" && decoded !== "asesor") {
    throw new ForbiddenError("Sesión inválida o ausente.");
  }
  return actorForRole(decoded);
}

/** Actor para un rol dado (mismo criterio que getActor). Útil al emitir sesión. */
export function actorForRole(role: Role): Actor {
  return {
    role,
    name: NAMES[role],
    canHardDelete: role === "admin",
    canPurgeAudit: role === "admin",
  };
}

export class ForbiddenError extends Error {
  constructor(message = "Tu rol no permite esta acción.") {
    super(message);
  }
}
