// Firma/verificación de la cookie de rol con HMAC-SHA256.
// Usa Web Crypto (crypto.subtle) → funciona tanto en el runtime Node como en el
// Edge (proxy.ts). En producción la cookie DEBE venir firmada; en dev/QA se acepta
// el valor plano para no romper las suites locales.

function getSecret(): string {
  const s = process.env.CORALINA_SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production" && process.env.SESSION_UNSIGNED !== "1") {
    throw new Error(
      "CORALINA_SESSION_SECRET requerido en producción (o setear SESSION_UNSIGNED=1 para demo).",
    );
  }
  return process.env.CORALINA_ADMIN_PASSWORD ?? "coralina-dev-secret";
}

if (process.env.NODE_ENV === "production" && process.env.SESSION_UNSIGNED === "1") {
  console.warn("[session] cookies SIN firmar (SESSION_UNSIGNED=1) en producción.");
}

const encoder = new TextEncoder();

async function hmac(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Devuelve `<role>.<hmac>` para setear en la cookie. */
export async function signRole(role: string): Promise<string> {
  return `${role}.${await hmac(role)}`;
}

/** Verifica la firma y devuelve el rol, o null si es inválida/ausente. */
export async function verifyRole(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const role = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = await hmac(role);
  return sig === expected ? role : null;
}

// Dev/QA (o SESSION_UNSIGNED=1): se usa la cookie plana. Prod: FIRMADA.
// (Las suites locales corren con `next start` = NODE_ENV=production; setean
//  SESSION_UNSIGNED=1 para poder mandar `coralina_role=admin` sin HMAC.)
const PLAIN_ALLOWED = () => process.env.NODE_ENV !== "production" || process.env.SESSION_UNSIGNED === "1";

/** Decodifica el rol de la cookie (verifica HMAC en prod, salvo SESSION_UNSIGNED=1). */
export async function decodeRole(raw: string | undefined | null): Promise<string | null> {
  if (!raw) return null;
  return PLAIN_ALLOWED() ? raw : verifyRole(raw);
}

/** Codifica el rol para la cookie (firma HMAC en prod, salvo SESSION_UNSIGNED=1). */
export async function encodeRole(role: string): Promise<string> {
  return PLAIN_ALLOWED() ? role : signRole(role);
}
