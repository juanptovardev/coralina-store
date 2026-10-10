import { cookies } from "next/headers";
import { decodeRole } from "./session-sign";

export type Role = "admin" | "asesor";

export type Actor = {
  role: Role;
  name: string;
  canHardDelete: boolean;
  canPurgeAudit: boolean;
};

const NAMES: Record<Role, string> = {
  admin: "Sofía Marín (Admin)",
  asesor: "Juan Pérez (Asesor)",
};

export async function getActor(): Promise<Actor> {
  const store = await cookies();
  const raw = store.get("coralina_role")?.value;
  // Prod: la cookie va firmada (HMAC). Dev/QA: se acepta el valor plano.
  const decoded = await decodeRole(raw);
  if (decoded !== "admin" && decoded !== "asesor") {
    throw new ForbiddenError("Sesión inválida o ausente.");
  }
  const role: Role = decoded;
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
