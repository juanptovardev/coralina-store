// Test unitario de la firma de sesión (HMAC). Correr: bun qa/session-sign.test.ts
import { signRole, verifyRole, encodeRole, decodeRole } from "../src/lib/session-sign";

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

console.log("session-sign");

const signed = await signRole("admin");
ok("signRole produce <role>.<hmac>", /^admin\.[0-9a-f]{64}$/.test(signed));
ok("verifyRole acepta la firma válida", (await verifyRole(signed)) === "admin");
ok("verifyRole rechaza firma alterada", (await verifyRole(signed.slice(0, -1) + "0")) === null);
ok("verifyRole rechaza rol forjado", (await verifyRole("hacker." + signed.split(".")[1])) === null);
ok("verifyRole rechaza sin separador", (await verifyRole("admin")) === null);
ok("verifyRole rechaza vacío/undefined", (await verifyRole(undefined)) === null);

// En dev/QA (NODE_ENV != production) la cookie plana se acepta (para las suites).
ok("decodeRole dev acepta plano", (await decodeRole("admin")) === "admin");
ok("encodeRole dev no firma", (await encodeRole("asesor")) === "asesor");
// Un valor firmado también pasa decodeRole en dev (aunque sin verificar).
ok("decodeRole dev acepta firmado", (await decodeRole(signed)) === signed);

// Prod: fail-closed (exige CORALINA_SESSION_SECRET) y solo acepta firmadas.
const oldEnv = (process.env as Record<string, string>).NODE_ENV;
(process.env as Record<string, string>).NODE_ENV = "production";
process.env.CORALINA_SESSION_SECRET = "test-secret";
ok("prod: decodeRole rechaza cookie plana", (await decodeRole("admin")) === null);
ok("prod: decodeRole acepta cookie firmada", (await decodeRole(await signRole("admin"))) === "admin");
delete process.env.CORALINA_SESSION_SECRET;
ok("prod sin secreto: signRole truena (fail-closed)", await signRole("admin").then(() => false, () => true));
(process.env as Record<string, string>).NODE_ENV = oldEnv;

console.log(`\nPASS ${pass} · FAIL ${fail}`);
process.exitCode = fail > 0 ? 1 : 0;
