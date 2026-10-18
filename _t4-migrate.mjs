// T4 — migración aditiva e idempotente de la gestión de usuarios del panel.
//   DATABASE_URL="postgres://..." node _t4-migrate.mjs
// Añade a users: active (bool, default true) y last_login_at (timestamptz).
// Re-ejecutable sin efectos: todo va con IF NOT EXISTS. NO lo corre el build.
import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.error("[t4-migrate] DATABASE_URL no está definida: abortando.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();

  await client.query(
    `alter table users add column if not exists active boolean not null default true`,
  );
  console.log("[t4-migrate] OK: users.active (boolean not null default true).");

  await client.query(
    `alter table users add column if not exists last_login_at timestamptz`,
  );
  console.log("[t4-migrate] OK: users.last_login_at (timestamptz).");

  console.log("[t4-migrate] OK: migración T4 aplicada (idempotente).");
} catch (err) {
  console.error("[t4-migrate] FALLÓ:", err);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
