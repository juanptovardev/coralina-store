// Tests unitarios del rate limiter. Correr: bun qa/rate-limit.test.ts
export {}; // módulo → habilita top-level await

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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// El módulo lee env en el import → re-importamos con query distinta por escenario.
let n = 0;
const fresh = () => import(`../src/lib/rate-limit?t=${n++}`);

process.env.RATE_LIMIT_WINDOW_MS = "1000"; // mínimo del clamp (R24)
process.env.RATE_LIMIT_MAX = "3";
process.env["TRUST_PROXY"] = "1";
(process.env as Record<string, string>).NODE_ENV = "development";

console.log("— modo dev (loopback exento) —");
let rl = await fresh();

ok(
  "permite 3 y bloquea la 4ta",
  rl.rateLimit("1.2.3.4") && rl.rateLimit("1.2.3.4") && rl.rateLimit("1.2.3.4") && rl.rateLimit("1.2.3.4") === false,
);
ok(
  "loopback exento en dev",
  rl.rateLimit("127.0.0.1") && rl.rateLimit("127.0.0.1") && rl.rateLimit("127.0.0.1") && rl.rateLimit("127.0.0.1"),
);
ok("Retry-After >= 1", Number(rl.RATE_LIMIT_RETRY_AFTER) >= 1);
ok(
  "clientIp prefiere x-real-ip",
  rl.clientIp(new Request("http://x", { headers: { "x-real-ip": "8.8.8.8" } })) === "8.8.8.8",
);
ok(
  "clientIp ignora header no-IP",
  rl.clientIp(new Request("http://x", { headers: { "x-real-ip": "evil, 1.2.3.4" } })) === "local",
);
ok(
  "clientIp usa el XFF de la derecha",
  rl.clientIp(new Request("http://x", { headers: { "x-forwarded-for": "1.1.1.1, 9.9.9.9" } })) === "9.9.9.9",
);

{
  const ip = "2.2.2.2";
  rl.rateLimit(ip);
  rl.rateLimit(ip);
  rl.rateLimit(ip);
  const blocked = rl.rateLimit(ip);
  await sleep(1100);
  ok("la ventana se resetea", blocked === false && rl.rateLimit(ip) === true);
}

console.log("— modo prod sin opt-in (fail-closed) —");
(process.env as Record<string, string>).NODE_ENV = "production";
process.env.RATE_LIMIT_ALLOW_LOCAL = ""; // no opt-in
rl = await fresh();

ok(
  "prod: loopback NO exento",
  rl.rateLimit("127.0.0.1") && rl.rateLimit("127.0.0.1") && rl.rateLimit("127.0.0.1") && rl.rateLimit("127.0.0.1") === false,
);
ok(
  "prod: '::1' NO exento",
  rl.rateLimit("::1") && rl.rateLimit("::1") && rl.rateLimit("::1") && rl.rateLimit("::1") === false,
);

console.log("— modo prod + RATE_LIMIT_ALLOW_LOCAL=1 (QA local) —");
process.env.RATE_LIMIT_ALLOW_LOCAL = "1";
rl = await fresh();

ok(
  "prod+ALLOW_LOCAL: loopback exento",
  rl.rateLimit("127.0.0.1") && rl.rateLimit("127.0.0.1") && rl.rateLimit("127.0.0.1") && rl.rateLimit("127.0.0.1"),
);

console.log(`\n${pass} pass / ${fail} fail`);
if (fail > 0) process.exitCode = 1;
