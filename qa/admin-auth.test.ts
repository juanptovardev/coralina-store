// Test unitario de la credencial admin (fail-closed en prod).
// Correr: bun qa/admin-auth.test.ts
import { adminPassword, passwordMatches } from "../src/lib/admin-auth";

export {};

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log("  ✓ " + name);
  } else {
    fail++;
    console.log("  ✗ " + name);
  }
}

console.log("admin-auth");

const oldEnv = (process.env as Record<string, string>).NODE_ENV;

// Dev/QA sin clave explícita: cae a "coralina".
(process.env as Record<string, string>).NODE_ENV = "development";
delete process.env.CORALINA_ADMIN_PASSWORD;
ok("dev: default 'coralina' coincide", passwordMatches("coralina") === true);
ok("dev: otra clave no coincide", passwordMatches("otra") === false);

// Prod con clave configurada.
(process.env as Record<string, string>).NODE_ENV = "production";
process.env.CORALINA_ADMIN_PASSWORD = "s3cret";
ok("prod: clave correcta coincide", passwordMatches("s3cret") === true);
ok("prod: 'coralina' NO coincide", passwordMatches("coralina") === false);
ok("prod: undefined NO coincide", passwordMatches(undefined) === false);

// Prod SIN clave: fail-closed (throws; passwordMatches deniega).
delete process.env.CORALINA_ADMIN_PASSWORD;
ok(
  "prod sin clave: adminPassword truena",
  await (async () => {
    try {
      adminPassword();
      return false;
    } catch {
      return true;
    }
  })(),
);
ok("prod sin clave: passwordMatches deniega", passwordMatches("coralina") === false);

(process.env as Record<string, string>).NODE_ENV = oldEnv;

console.log(`\nPASS ${pass} · FAIL ${fail}`);
process.exitCode = fail > 0 ? 1 : 0;
