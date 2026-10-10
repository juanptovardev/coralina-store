// Rate limiter en memoria (sin deps) para los POST públicos de la tienda.
// Ventana fija: max WINDOW_MS requests por IP. No es distribuido (multi-instancia
// requiere store externo); para una sola instancia Next es suficiente.

const IS_PROD = process.env.NODE_ENV === "production";
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
// Opt-in explícito para eximir loopback en producción (solo para QA local).
const ALLOW_LOCAL = process.env.RATE_LIMIT_ALLOW_LOCAL === "1";

// Clamps: valores inválidos/negativos no deben desactivar el limitador.
const WINDOW_MS = Math.max(1000, Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000);
const MAX_REQUESTS = Math.max(1, Number(process.env.RATE_LIMIT_MAX) || 30);
const MAX_TRACKED_IPS = 1000;

const hits = new Map<string, number[]>();

// Validación de forma: solo aceptamos un header de proxy si PARECE una IP.
// (Aun así, TRUST_PROXY=1 asume que el proxy SOBREESCRIBE x-real-ip/x-forwarded-for;
//  con un proxy mal configurado los headers siguen siendo falsificables.)
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const isIp = (v: string) => IPV4.test(v) || v.includes(":"); // IPv4 o IPv6 (mínimo)

if (IS_PROD && !TRUST_PROXY) {
  console.warn(
    "[rate-limit] TRUST_PROXY!=1 en producción: todas las peticiones comparten el bucket 'unknown' (30/min global).",
  );
}

export function clientIp(req: Request): string {
  // Los headers de proxy solo se confían con TRUST_PROXY=1 (p.ej. tras Vercel, que
  // sobreescribe x-real-ip). Sin proxy confiable son falsificables por el cliente.
  if (TRUST_PROXY) {
    const real = req.headers.get("x-real-ip")?.trim();
    if (real && isIp(real)) return real;
    const fwd = req.headers.get("x-forwarded-for");
    if (fwd) {
      const parts = fwd.split(",").map((s) => s.trim()).filter(Boolean);
      // El proxy añade el cliente real a la derecha; la izquierda la controla el cliente.
      const right = parts[parts.length - 1];
      if (right && isIp(right)) return right;
    }
  }
  // Sin identidad fiable: en producción "unknown" SE LIMITA (fail-closed); en dev,
  // "local" queda exento para QA/smoke local.
  return IS_PROD ? "unknown" : "local";
}

/** true = permitido, false = excedió el límite (429). */
export function rateLimit(ip: string): boolean {
  // Loopback exento solo en dev (QA/smoke local) o con opt-in explícito
  // RATE_LIMIT_ALLOW_LOCAL=1. En producción sin opt-in NO se exime (fail-closed):
  // así un `x-real-ip: 127.0.0.1` falsificado no evade el límite.
  if ((!IS_PROD || ALLOW_LOCAL) && (ip === "127.0.0.1" || ip === "::1" || ip === "local")) return true;
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_REQUESTS) {
    hits.set(ip, list);
    return false;
  }
  list.push(now);
  hits.set(ip, list);
  // Cota de memoria dura: desaloja las IPs más antiguas (orden de inserción del Map).
  while (hits.size > MAX_TRACKED_IPS) {
    const oldest = hits.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    hits.delete(oldest);
  }
  return true;
}

export const RATE_LIMIT_ERROR = "Demasiadas solicitudes. Intenta de nuevo más tarde.";
export const RATE_LIMIT_RETRY_AFTER = String(Math.ceil(WINDOW_MS / 1000));
