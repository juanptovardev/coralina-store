// F4 — alta/actualización de usuario del panel. Manual e idempotente (upsert):
//   F4_EMAIL="sofia@coralina.com" F4_PW="clave" F4_ROLE="admin" [F4_NAME="Sofía"] \
//     DATABASE_URL="postgres://..." node _f4-create-user.mjs
// Sin F4_EMAIL/F4_PW/F4_ROLE no hace nada (no interactivo, seguro de re-ejecutar).
// Prefijo F4_ para no colisionar con EMAIL/ROLE ya exportadas en el shell.
// Hash scrypt con defaults de node:crypto (N=16384, r=8, p=1, salt 16B,
// key 64B) — mismo formato "salt:hex" que verifica src/lib/users.ts.
import { randomBytes, scryptSync } from "node:crypto";
import pg from "pg";

const email = (process.env.F4_EMAIL ?? "").trim().toLowerCase();
const pw = process.env.F4_PW ?? "";
const role = (process.env.F4_ROLE ?? "").trim();
const name = (process.env.F4_NAME ?? "").trim() || email.split("@")[0] || "";

if (!email || !pw || !role) {
  console.error("[f4-create-user] F4_EMAIL, F4_PW y F4_ROLE son requeridas (env). Nada hecho.");
  process.exit(1);
}
if (role !== "admin" && role !== "asesor") {
  console.error("[f4-create-user] ROLE debe ser 'admin' o 'asesor'. Nada hecho.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("[f4-create-user] DATABASE_URL no está definida: abortando.");
  process.exit(1);
}

const salt = randomBytes(16);
const key = scryptSync(pw, salt, 64);
const passwordHash = `${salt.toString("hex")}:${key.toString("hex")}`;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  const { rows } = await client.query(
    `insert into users (email, password_hash, name, role)
     values ($1, $2, $3, $4)
     on conflict (email) do update
       set password_hash = excluded.password_hash,
           name = excluded.name,
           role = excluded.role
     returning id, email, name, role`,
    [email, passwordHash, name, role],
  );
  const u = rows[0];
  console.log(`[f4-create-user] OK (upsert): id=${u.id} email=${u.email} role=${u.role} name="${u.name}".`);
} catch (err) {
  console.error("[f4-create-user] FALLÓ:", err);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
