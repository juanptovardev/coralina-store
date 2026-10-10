// Tests unitarios del helper de paginación admin. Correr: bun qa/page-params.test.ts
import { pageParams } from "../src/lib/page-params";

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
const mk = (q: string) => new URLSearchParams(q);
const MAX = Number.MAX_SAFE_INTEGER;

console.log("— sin params: comportamiento legacy (sin tope) —");
ok("sin page ni pageSize → sin tope", pageParams(mk(""), 100).pageSize === MAX);
ok("sin params → page 1 offset 0", pageParams(mk(""), 100).page === 1 && pageParams(mk(""), 100).offset === 0);
ok("audit sin params → también sin tope", pageParams(mk(""), 200).pageSize === MAX);

console.log("— con params explícitos: tope duro 200 —");
ok("pageSize=999 → clamp 200", pageParams(mk("pageSize=999"), 100).pageSize === 200);
ok("solo page → default del endpoint (orders 100)", pageParams(mk("page=2"), 100).pageSize === 100);
ok("solo page → default del endpoint (shipments/audit 200)", pageParams(mk("page=3"), 200).pageSize === 200);
ok("pageSize negativo → default", pageParams(mk("pageSize=-5"), 100).pageSize === 100);
ok("pageSize=0 → default", pageParams(mk("pageSize=0"), 100).pageSize === 100);
ok("pageSize=abc → default", pageParams(mk("pageSize=abc"), 100).pageSize === 100);

console.log("— page inválida cae a 1 —");
ok("page=abc → page 1", pageParams(mk("page=abc"), 100).page === 1);
ok("page=0 → page 1", pageParams(mk("page=0&pageSize=50"), 100).page === 1);
ok("page=-3 → page 1", pageParams(mk("page=-3&pageSize=50"), 100).page === 1);

console.log("— offset consistente —");
ok("page=2&pageSize=50 → offset 50", pageParams(mk("page=2&pageSize=50"), 100).offset === 50);
ok("page=5&pageSize=200 → offset 800", pageParams(mk("page=5&pageSize=200"), 200).offset === 800);

console.log(`\n${pass} pass / ${fail} fail`);
if (fail > 0) process.exitCode = 1;
