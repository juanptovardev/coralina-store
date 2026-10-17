// Throttle de login por cuenta (email|ip). En serverless el estado es por instancia
// (fail-open de facto con varias); el rate-limit global por IP (rate-limit.ts) sigue activo.

const WINDOW_MS = 15 * 60 * 1000; // ventana deslizante de 15 min
const MAX_FAILURES = 5; // el 6º fallo dentro de la ventana bloquea
const PURGE_MS = 20 * 60 * 1000; // purga perezosa de entradas más viejas que la ventana
const MAX_KEYS = 5000; // tope de tamaño del mapa

const failures = new Map<string, number[]>();

// Purga perezosa: descarta timestamps >PURGE_MS y aplica el tope de tamaño
// desalojando las claves más antiguas (orden de inserción del Map).
function purge(now: number): void {
  for (const [key, list] of failures) {
    const fresh = list.filter((t) => now - t < PURGE_MS);
    if (fresh.length === 0) failures.delete(key);
    else failures.set(key, fresh);
  }
  while (failures.size > MAX_KEYS) {
    const oldest = failures.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    failures.delete(oldest);
  }
}

/** Registra un fallo de login para la clave (email|ip). */
export function registerLoginFailure(key: string): void {
  const now = Date.now();
  const list = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  failures.set(key, list);
  purge(now);
}

/**
 * true si la clave está bloqueada (≥6 fallos en la ventana). retryAfterSeconds son
 * los segundos que faltan para que el fallo más antiguo salga de la ventana.
 */
export function checkLoginThrottle(key: string): { blocked: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const list = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  failures.set(key, list); // normaliza la entrada (descarta vencidos)
  if (list.length <= MAX_FAILURES) return { blocked: false, retryAfterSeconds: 0 };
  const retryAfterMs = list[0] + WINDOW_MS - now; // fallo más antiguo = list[0]
  return { blocked: true, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
}

/** Limpia el throttle de la clave (login exitoso). */
export function clearLoginThrottle(key: string): void {
  failures.delete(key);
}
