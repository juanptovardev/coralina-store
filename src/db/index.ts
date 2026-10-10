import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresql?: NodePgDatabase<Record<string, never>>;
};

/**
 * Conexión perezosa: no se evalúa al importar el módulo (así el build de Next
 * no falla cuando DATABASE_URL todavía no existe), pero falla de forma clara y
 * temprana en la primera consulta si falta la variable de entorno, en vez de
 * caer silenciosamente a los defaults locales de Postgres (ECONNREFUSED 5432).
 */
function createDb(): NodePgDatabase<Record<string, never>> {
  if (!databaseUrl) {
    throw new Error(
      "[db] DATABASE_URL no está definida: configura la cadena de conexión de Postgres.",
    );
  }
  const cached = globalForDb.__arenaNextJsPostgresql;
  if (cached) return cached;
  const pool = new Pool({ connectionString: databaseUrl });
  const instance = drizzle(pool);
  if (process.env.NODE_ENV !== "production") {
    globalForDb.__arenaNextJsPostgresql = instance;
  }
  return instance;
}

export const db = new Proxy({} as NodePgDatabase<Record<string, never>>, {
  get(_target, prop) {
    const real = createDb();
    const value = Reflect.get(real, prop);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
