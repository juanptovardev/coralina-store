// Validación pura del perfil de cliente (T3) y del cambio de contraseña.
// Sin IO: se usa en /api/mi-cuenta (servidor) y en el panel (cliente).

import { validatePassword } from "./validate-register";

export type ProfileInput = {
  name?: unknown;
  phone?: unknown;
  city?: unknown;
  address?: unknown;
};

export type ProfileData = {
  name: string;
  phone: string;
  city: string;
  address: string;
};

export type ValidateProfileResult =
  | { ok: true; data: ProfileData }
  | { ok: false; error: string };

export const PROFILE_LIMITS = {
  nameMin: 2,
  nameMax: 80,
  phoneMax: 20,
  cityMax: 60,
  addressMax: 160,
} as const;

export function validateProfile(input: ProfileInput): ValidateProfileResult {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const phone = typeof input.phone === "string" ? input.phone.trim() : "";
  const city = typeof input.city === "string" ? input.city.trim() : "";
  const address = typeof input.address === "string" ? input.address.trim() : "";

  if (name.length < PROFILE_LIMITS.nameMin || name.length > PROFILE_LIMITS.nameMax) {
    return { ok: false, error: "El nombre debe tener entre 2 y 80 caracteres." };
  }
  if (phone.length > PROFILE_LIMITS.phoneMax) {
    return { ok: false, error: "El teléfono no puede superar 20 caracteres." };
  }
  if (city.length > PROFILE_LIMITS.cityMax) {
    return { ok: false, error: "La ciudad no puede superar 60 caracteres." };
  }
  if (address.length > PROFILE_LIMITS.addressMax) {
    return { ok: false, error: "La dirección no puede superar 160 caracteres." };
  }

  return { ok: true, data: { name, phone, city, address } };
}

export type PasswordChangeInput = {
  currentPassword?: unknown;
  newPassword?: unknown;
};

export type PasswordChangeData = {
  currentPassword: string;
  newPassword: string;
};

export type ValidatePasswordChangeResult =
  | { ok: true; data: PasswordChangeData }
  | { ok: false; error: string };

export function validatePasswordChange(input: PasswordChangeInput): ValidatePasswordChangeResult {
  // Ninguna de las dos se recorta: el espacio es un carácter válido del secreto.
  const currentPassword = typeof input.currentPassword === "string" ? input.currentPassword : "";
  const newPassword = typeof input.newPassword === "string" ? input.newPassword : "";

  if (currentPassword.length === 0) {
    return { ok: false, error: "Ingresa tu contraseña actual." };
  }
  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return { ok: false, error: passwordError };
  }
  return { ok: true, data: { currentPassword, newPassword } };
}
