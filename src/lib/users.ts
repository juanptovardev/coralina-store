// Usuarios del panel: hash de contraseñas con scrypt (node:crypto, sin deps)
// y lookup por email. Formato almacenado: "<salt hex>:<hash hex>".
//
// scrypt es memory-hard (resistente a GPU/ASIC). Salt aleatorio por usuario de
// 16 bytes; la verificación usa timingSafeEqual sobre buffers de igual longitud.

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

const SALT_BYTES = 16;
const KEY_LEN = 64;

// Hash scrypt de un secreto aleatorio descartado (salt+key generados una vez).
// Único propósito: quemar scrypt en el branch "email desconocido" del login
// para que el timing de respuesta sea idéntico al de email existente (evita
// enumeración de emails midiendo latencia). Formato salt:hash, nunca matchea.
const DUMMY_HASH =
  "03612368727650f68b4e3ba308014aec:b9f9706eb4bb0e88f6089f2770e3eb5587bcba649efd6ae68fda429268830a59ad7edc76bc4c07e1bcf7692d7a0d5bc88781d7e9e9f71706f7baecb661ab62c1";

export type DbUser = typeof users.$inferSelect;

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scryptAsync(pw, salt, KEY_LEN);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

/** false si el formato almacenado no es reconocido (fail-closed). */
export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const sep = stored.indexOf(":");
  if (sep <= 0) return false;
  const salt = Buffer.from(stored.slice(0, sep), "hex");
  const expected = Buffer.from(stored.slice(sep + 1), "hex");
  if (salt.length === 0 || expected.length === 0) return false;
  const key = await scryptAsync(pw, salt, expected.length);
  return timingSafeEqual(key, expected);
}

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0] ?? null;
}

/**
 * Verificación de login por email, timing-uniforme: TODOS los caminos (email
 * desconocido, rol distinto, clave incorrecta) ejecutan scrypt exactamente una
 * vez, de modo que la respuesta no filtra por latencia cuál falló. Nunca lanza
 * (fail-closed → false).
 */
export async function checkEmailLogin(
  user: DbUser | null,
  password: string,
  expectedRole: string,
): Promise<boolean> {
  try {
    if (!user) {
      await verifyPassword(password, DUMMY_HASH);
      return false;
    }
    const pwOk = await verifyPassword(password, user.passwordHash);
    return pwOk && user.role === expectedRole;
  } catch {
    return false;
  }
}
