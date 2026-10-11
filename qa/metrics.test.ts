// Tests unitarios del bucketing UTC de métricas. Correr: bun qa/metrics.test.ts
// No toca la base: buildByDay14/utcDayStart son puras (metrics.ts importa el
// pool perezoso, que no conecta al importar el módulo).
import { buildByDay14, utcDayStart } from "../src/lib/metrics";

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

console.log("— utcDayStart —");
const noon = Date.UTC(2026, 9, 10, 12, 30, 45, 500); // 2026-10-10 12:30:45.500 UTC
ok("mediodía UTC → medianoche UTC del mismo día", utcDayStart(noon) === Date.UTC(2026, 9, 10));
ok("medianoche exacta → se conserva", utcDayStart(Date.UTC(2026, 9, 10)) === Date.UTC(2026, 9, 10));
ok(
  "23:59:59.999 → medianoche del mismo día",
  utcDayStart(Date.UTC(2026, 9, 10, 23, 59, 59, 999)) === Date.UTC(2026, 9, 10),
);

console.log("— buildByDay14: fronteras de día en UTC —");
const now = Date.UTC(2026, 9, 10, 12, 0, 0); // "hoy" = 2026-10-10 (UTC)
const yesterday23h59 = new Date(Date.UTC(2026, 9, 9, 23, 59, 59)).toISOString();
const today00h00 = new Date(Date.UTC(2026, 9, 10, 0, 0, 0)).toISOString();
const buckets = buildByDay14(
  [
    { createdAt: yesterday23h59, totalCents: 1000 }, // ayer 23:59:59 UTC
    { createdAt: today00h00, totalCents: 2500 }, // hoy 00:00:00 UTC
    { createdAt: new Date(Date.UTC(2026, 9, 10, 14, 0, 0)).toISOString(), totalCents: 500 }, // hoy
  ],
  now,
);
ok("exactamente 14 buckets", buckets.length === 14);
ok("bucket de hoy es el último", buckets[13].date === "2026-10-10");
ok("bucket más viejo = hoy - 13 días", buckets[0].date === "2026-09-27");
ok(
  "23:59:59 UTC cae en el bucket del día anterior",
  buckets[12].date === "2026-10-09" && buckets[12].count === 1,
  JSON.stringify(buckets[12]),
);
ok(
  "00:00:00 UTC cae en el bucket de hoy",
  buckets[13].date === "2026-10-10" && buckets[13].count === 2,
  JSON.stringify(buckets[13]),
);
ok(
  "revenue por bucket suma bien",
  buckets[12].revenueCents === 1000 && buckets[13].revenueCents === 3000,
);

console.log("— buildByDay14: la TZ local no filtra (regresión DST/local) —");
// 2026-10-09T23:00:00-05:00 == 2026-10-10T04:00Z: debe caer en el bucket UTC
// del 10 aunque el reloj local (TZ -05:00) diga 9 de octubre.
const offsetTs = "2026-10-09T23:00:00-05:00";
const localBuckets = buildByDay14([{ createdAt: offsetTs, totalCents: 700 }], now);
ok(
  "offset -05:00 se agrupa por fecha UTC (no local)",
  localBuckets[13].date === "2026-10-10" && localBuckets[13].count === 1,
  JSON.stringify(localBuckets[13]),
);

console.log("— buildByDay14: fuera de ventana se descarta —");
const oldTs = new Date(Date.UTC(2026, 8, 20)).toISOString(); // 2026-09-20: 7 días antes del bucket más viejo (2026-09-27)
const withOld = buildByDay14([{ createdAt: oldTs, totalCents: 999 }], now);
ok(
  "orden fuera de los 14 días no infla ningún bucket",
  withOld.every((b) => b.count === 0 && b.revenueCents === 0),
);

console.log(`\n${pass} pass / ${fail} fail`);
if (fail > 0) process.exitCode = 1;
