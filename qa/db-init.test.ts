// Contrato de la conexión perezosa a la DB. Correr: bun qa/db-init.test.ts
export {}; // módulo → habilita top-level await

let pass = 0;
let fail = 0;
const ok = (name: string, cond: boolean, detail = "") => {
  if (cond) {
    pass++;
    console.log(`  ok - ${name}`);
  } else {
    fail++;
    console.log(`  FAIL - ${name} ${detail}`);
  }
};

const clearCache = () => {
  delete (globalThis as Record<string, unknown>).__arenaNextJsPostgresql;
};
let n = 0;
const fresh = () => import(`../src/db/index?t=${n++}`);

console.log("— sin DATABASE_URL —");
delete process.env.DATABASE_URL;
clearCache();

let imported = true;
let a: typeof import("../src/db/index");
try {
  a = await fresh();
} catch {
  imported = false;
  a = undefined as unknown as typeof import("../src/db/index");
}
ok("el import no lanza sin DATABASE_URL", imported);

let err: unknown = null;
try {
  void a.db.select;
} catch (e) {
  err = e;
}
ok(
  "acceder a db.select sin DATABASE_URL lanza error claro",
  err instanceof Error && /DATABASE_URL no está definida/.test((err as Error).message),
  err instanceof Error ? `(msg: ${(err as Error).message})` : "(no lanzó)",
);

console.log("— con DATABASE_URL (dummy, sin conectar) —");
process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/nodb";
clearCache();

const b = await fresh();
ok(
  "dos accesos a db.$client devuelven la MISMA instancia (memoización)",
  b.db.$client === b.db.$client,
);

console.log(`\n${pass} pass / ${fail} fail`);
if (fail > 0) process.exitCode = 1;
