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

// Entorno controlado (por si el shell ya trae CORALINA_* exportadas).
const ENV = process.env as Record<string, string>;
const savedNodeEnv = ENV.NODE_ENV;
const savedSecret = ENV.CORALINA_SESSION_SECRET;
const savedUnsigned = ENV.CORALINA_ALLOW_UNSIGNED;
ENV.NODE_ENV = "development";
delete ENV.CORALINA_SESSION_SECRET;
delete ENV.CORALINA_ALLOW_UNSIGNED;

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
ENV.NODE_ENV = "production";
delete ENV.CORALINA_ALLOW_UNSIGNED;
ENV.CORALINA_SESSION_SECRET = "test-secret";
ok("prod: decodeRole rechaza cookie plana", (await decodeRole("admin")) === null);
ok("prod: decodeRole acepta cookie firmada", (await decodeRole(await signRole("admin"))) === "admin");
delete ENV.CORALINA_SESSION_SECRET;
ok("prod sin secreto: signRole truena (fail-closed)", await signRole("admin").then(() => false, () => true));

// Prod + opt-in explícito (CORALINA_ALLOW_UNSIGNED=1) → permite cookie plana (QA).
ENV.CORALINA_ALLOW_UNSIGNED = "1";
ok("prod+opt-in: decodeRole acepta cookie plana", (await decodeRole("admin")) === "admin");

// Restaurar entorno.
if (savedNodeEnv === undefined) delete ENV.NODE_ENV;
else ENV.NODE_ENV = savedNodeEnv;
if (savedSecret === undefined) delete ENV.CORALINA_SESSION_SECRET;
else ENV.CORALINA_SESSION_SECRET = savedSecret;
if (savedUnsigned === undefined) delete ENV.CORALINA_ALLOW_UNSIGNED;
else ENV.CORALINA_ALLOW_UNSIGNED = savedUnsigned;

console.log(`\nPASS ${pass} · FAIL ${fail}`);
process.exitCode = fail > 0 ? 1 : 0;
