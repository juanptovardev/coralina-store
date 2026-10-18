// Validación pura de la gestión de usuarios del panel (T4). Sin IO: la usa el
// endpoint /api/admin/users. generateTemporaryPassword es la única que toca
// node:crypto (genera entropía, no hace red ni DB).

import { randomBytes } from "node:crypto";

export const USER_ROLES = ["admin", "asesor", "cliente"] as const;
export type UserRole = (typeof USER_ROLES)[number];

// Formato básico local@dominio.tld (el email se normaliza: trim+lowercase).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

/** Contraseña temporal: 12 bytes → base64url (16 chars, sin relleno). */
export function generateTemporaryPassword(): string {
  return randomBytes(12).toString("base64url");
}

export type ValidateResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type CreateUserInput = {
  email?: unknown;
  name?: unknown;
  role?: unknown;
  password?: unknown;
};

export type CreateUserData = {
  email: string;
  name: string;
  role: UserRole;
  /** Solo presente si el admin la escribió; ausente = el servidor genera una. */
  password?: string;
};

export function validateCreateUser(input: CreateUserInput): ValidateResult<CreateUserData> {
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";

  if (email.length === 0 || email.length > 254 || !EMAIL_RE.test(email)) {
    return { ok: false, error: "Ingresa un email válido." };
  }
  if (name.length < 2 || name.length > 80) {
    return { ok: false, error: "El nombre debe tener entre 2 y 80 caracteres." };
  }
  if (!isUserRole(input.role)) {
    return { ok: false, error: "Rol inválido." };
  }

  // password OPCIONAL: si viene (no vacío) debe estar en rango; el espacio cuenta.
  const raw = input.password;
  if (raw !== undefined && raw !== null && raw !== "") {
    const pw = typeof raw === "string" ? raw : "";
    if (pw.length < 8 || pw.length > 128) {
      return { ok: false, error: "La contraseña debe tener entre 8 y 128 caracteres." };
    }
    return { ok: true, data: { email, name, role: input.role, password: pw } };
  }
  return { ok: true, data: { email, name, role: input.role } };
}

export type UpdateUserInput = { name?: unknown; role?: unknown };
export type UpdateUserData = { name?: string; role?: UserRole };

export function validateUpdateUser(input: UpdateUserInput): ValidateResult<UpdateUserData> {
  const data: UpdateUserData = {};

  if (input.name !== undefined) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (name.length < 2 || name.length > 80) {
      return { ok: false, error: "El nombre debe tener entre 2 y 80 caracteres." };
    }
    data.name = name;
  }
  if (input.role !== undefined) {
    if (!isUserRole(input.role)) {
      return { ok: false, error: "Rol inválido." };
    }
    data.role = input.role;
  }
  if (data.name === undefined && data.role === undefined) {
    return { ok: false, error: "Nada que actualizar." };
  }
  return { ok: true, data };
}
