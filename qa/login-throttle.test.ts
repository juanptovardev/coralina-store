// Tests unitarios del throttle de login. Correr: bun qa/login-throttle.test.ts
import {
  checkLoginThrottle,
  registerLoginFailure,
  clearLoginThrottle,
} from "../src/lib/login-throttle";

let pass = 0;
let fail = 0;
const ok = (name: string, cond: boolean) => {
  if (cond) {
    pass++;
    console.log(`  ok - ${name}`);
  } else {
    fail++;
    console.log(`  FAIL - ${name}`);
  }
};

console.log("— (a) 5 fallos no bloquean —");
const kA = "a@coralina.com|10.0.0.1";
for (let i = 0; i < 5; i++) registerLoginFailure(kA);
ok("5 fallos → no bloqueado", checkLoginThrottle(kA).blocked === false);

console.log("— (b) el 6º fallo bloquea con retryAfterSeconds > 0 —");
registerLoginFailure(kA);
const blocked = checkLoginThrottle(kA);
ok("6º fallo → bloqueado", blocked.blocked === true);
ok("retryAfterSeconds > 0 al bloquear", blocked.retryAfterSeconds > 0);

console.log("— (e) retryAfterSeconds ≤ 900 (15 min) —");
ok("retryAfterSeconds ≤ 900", blocked.retryAfterSeconds <= 900);

console.log("— (c) clear() permite de nuevo —");
clearLoginThrottle(kA);
ok("tras clear() → no bloqueado", checkLoginThrottle(kA).blocked === false);

console.log("— (d) claves distintas no se afectan —");
const kBlocked = "bloqueado@coralina.com|10.0.0.2";
const kClean = "limpio@coralina.com|10.0.0.3";
for (let i = 0; i < 6; i++) registerLoginFailure(kBlocked);
ok("clave con 6 fallos → bloqueada", checkLoginThrottle(kBlocked).blocked === true);
ok("clave distinta → no afectada", checkLoginThrottle(kClean).blocked === false);

console.log(`\n${pass} pass / ${fail} fail`);
if (fail > 0) process.exitCode = 1;
