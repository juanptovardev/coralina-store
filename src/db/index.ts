import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresql?: NodePgDatabase<Record<string, never>>;
};

/**
 * Conexión perezosa: el pool y el cliente drizzle se crean en la primera
 * consulta (no al importar el módulo), así el build de Next no falla cuando
 * DATABASE_URL todavía no existe. Si falta la variable, la primera consulta
 * falla de forma clara en vez de caer silenciosamente a los defaults locales
 * de Postgres (ECONNREFUSED 5432).
 *
 * El env se lee dentro de la función (no en module scope) para tolerar
 * entrypoints que cargan dotenv después de importar este módulo.
 *
 * El cache vive en globalThis SIEMPRE (dev y prod): en dev sobrevive al HMR de
 * Next y en prod garantiza un único Pool por proceso (no un Pool por acceso).
 */
function createDb(): NodePgDatabase<Record<string, never>> {
  const cached = globalForDb.__arenaNextJsPostgresql;
  if (cached) return cached;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "[db] DATABASE_URL no está definida: configura la cadena de conexión de Postgres.",
    );
  }

  const instance = drizzle(
    new Pool({
      connectionString: databaseUrl,
      // Tamaño del pool configurable (PGPOOL_MAX) + límites de espera para no
      // colgar requests si la DB no responde. Clamp igual al de rate-limit.ts:
      // un valor inválido (NaN/0) no debe romper la adquisición de conexiones.
      max: Math.max(1, Number(process.env.PGPOOL_MAX) || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    }),
  );
  globalForDb.__arenaNextJsPostgresql = instance;
  return instance;
}

export const db = new Proxy({} as NodePgDatabase<Record<string, never>>, {
  get(_target, prop) {
    const real = createDb();
    const value = Reflect.get(real, prop);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
