// Validación pura del auto-registro de clientes (T2). Sin IO: la misma función
// se usa en el endpoint /api/register (servidor) y en /register (cliente).

export type RegisterInput = {
  name?: unknown;
  email?: unknown;
  password?: unknown;
};

export type RegisterData = {
  name: string;
  email: string;
  password: string;
};

export type ValidateRegisterResult =
  | { ok: true; data: RegisterData }
  | { ok: false; error: string };

// Formato básico local@dominio.tld (el email ya viene normalizado: trim+lowercase).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Regla única de contraseña (registro y cambio de clave). No recorta: el espacio
 * es un carácter válido del secreto. Devuelve el mensaje de error o null.
 */
export function validatePassword(password: unknown): string | null {
  const value = typeof password === "string" ? password : "";
  if (value.length < 8 || value.length > 128) {
    return "La contraseña debe tener entre 8 y 128 caracteres.";
  }
  return null;
}

export function validateRegistration(input: RegisterInput): ValidateRegisterResult {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  // La contraseña NO se recorta: el espacio es un carácter válido del secreto.
  const password = typeof input.password === "string" ? input.password : "";

  if (name.length < 2 || name.length > 80) {
    return { ok: false, error: "El nombre debe tener entre 2 y 80 caracteres." };
  }
  if (email.length === 0 || email.length > 254 || !EMAIL_RE.test(email)) {
    return { ok: false, error: "Ingresa un email válido." };
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    return { ok: false, error: passwordError };
  }
  return { ok: true, data: { name, email, password } };
}
