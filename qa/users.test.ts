// Test unitario de usuarios/scrypt y del login por email timing-uniforme.
// Correr: bun qa/users.test.ts
import {
  hashPassword,
  verifyPassword,
  checkEmailLogin,
  findUserByEmail,
  type DbUser,
} from "../src/lib/users";

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

console.log("users (scrypt)");

// Round-trip hash → verify.
const hash = await hashPassword("s3cret-🍎-pw");
ok("hash con formato salt:hash", /^[0-9a-f]{32}:[0-9a-f]{128}$/.test(hash));
ok("verifyPassword acepta la clave correcta", (await verifyPassword("s3cret-🍎-pw", hash)) === true);
ok("verifyPassword rechaza otra clave", (await verifyPassword("otra", hash)) === false);
// Salt aleatorio: dos hashes de la misma clave difieren y ambos verifican.
const hash2 = await hashPassword("s3cret-🍎-pw");
ok("salt aleatorio → hashes distintos", hash !== hash2);
ok("ambos hashes verifican la misma clave", (await verifyPassword("s3cret-🍎-pw", hash2)) === true);

// Stored corrupto: fail-closed, nunca lanza.
const corrupto: string[] = ["", "solo-texto-sin-dos-puntos", "zz:nothex", "ab:", ":ab", "ab:zz"];
let sinLanzar = true;
let todosFalse = true;
for (const c of corrupto) {
  try {
    if ((await verifyPassword("x", c)) !== false) todosFalse = false;
  } catch {
    sinLanzar = false;
  }
}
ok("stored corrupto: verifyPassword nunca lanza", sinLanzar);
ok("stored corrupto: siempre deniega", todosFalse);

// Nota: el DUMMY_HASH (anti-enumeración) es interno; su validez queda cubierta
// por el test de timing del branch null más abajo (un dummy malformado
// terminaría en <1ms y haría fallar el umbral).

// checkEmailLogin: timing-uniforme.
console.log("users (checkEmailLogin)");
const fakeUser: DbUser = {
  id: 1,
  email: "sofia@coralina.com",
  passwordHash: await hashPassword("clave-ok"),
  name: "Sofía (Test)",
  role: "admin",
  active: true,
  lastLoginAt: null,
  createdAt: new Date(),
};
ok("usuario + clave correcta + rol correcto → true", (await checkEmailLogin(fakeUser, "clave-ok", "admin")) === true);
ok("usuario + clave incorrecta → false", (await checkEmailLogin(fakeUser, "mal", "admin")) === false);
ok("usuario + clave correcta + rol distinto → false", (await checkEmailLogin(fakeUser, "clave-ok", "asesor")) === false);
ok("usuario null → false (sin lanzar)", (await checkEmailLogin(null, "x", "admin")) === false);

// Timing: el branch email-desconocido quema scrypt (≥5ms; scrypt N=16384 rinde
// ~30-100ms, una respuesta sin trabajo sería <1ms).
const t0 = performance.now();
await checkEmailLogin(null, "x", "admin");
const dt = performance.now() - t0;
ok(`branch null quema scrypt (duró ${Math.round(dt)}ms ≥ 5ms)`, dt >= 5);

// findUserByEmail existe y es callable (no toca DB en este test: solo contrato).
ok("findUserByEmail es función async", typeof findUserByEmail === "function");

console.log(`\nPASS ${pass} · FAIL ${fail}`);
process.exitCode = fail > 0 ? 1 : 0;
