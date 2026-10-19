// Tests unitarios del bucketing de métricas en hora de Bogotá (UTC-5).
// Correr: bun qa/metrics.test.ts
// No toca la base: bogotaDayStart/bogotaMonthStart/buildByDay14 son puras
// (metrics.ts importa el pool perezoso, que no conecta al importar el módulo).
import { bogotaDayStart, bogotaMonthStart, buildByDay14 } from "../src/lib/metrics";

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

console.log("— bogotaDayStart —");
const noon = Date.UTC(2026, 9, 10, 12, 30, 45, 500); // 2026-10-10 12:30 UTC = 07:30 Bogotá
ok("mediodía UTC → medianoche de Bogotá del mismo día", bogotaDayStart(noon) === Date.UTC(2026, 9, 10, 5));
ok("medianoche de Bogotá exacta → se conserva", bogotaDayStart(Date.UTC(2026, 9, 10, 5)) === Date.UTC(2026, 9, 10, 5));
ok(
  "23:59:59.999 de Bogotá (04:59:59Z) → medianoche del mismo día local",
  bogotaDayStart(Date.UTC(2026, 9, 10, 4, 59, 59, 999)) === Date.UTC(2026, 9, 9, 5),
);
ok(
  "00:00:00 de Bogotá (05:00Z) → medianoche de ese día",
  bogotaDayStart(Date.UTC(2026, 9, 10, 5)) === Date.UTC(2026, 9, 10, 5),
);

console.log("— bogotaMonthStart —");
ok(
  "primer día del mes a las 00:00 de Bogotá",
  bogotaMonthStart(noon) === Date.UTC(2026, 9, 1, 5),
  new Date(bogotaMonthStart(noon)).toISOString(),
);

console.log("— buildByDay14: fronteras de día en Bogotá —");
const now = Date.UTC(2026, 9, 10, 12, 0, 0); // "hoy" en Bogotá = 2026-10-10
const ayerBogota = new Date(Date.UTC(2026, 9, 10, 4, 59, 59)).toISOString(); // 23:59:59 del 9
const hoyBogota = new Date(Date.UTC(2026, 9, 10, 5, 0, 0)).toISOString(); // 00:00:00 del 10
const buckets = buildByDay14(
  [
    { createdAt: ayerBogota, totalCents: 1000 },
    { createdAt: hoyBogota, totalCents: 2500 },
    { createdAt: new Date(Date.UTC(2026, 9, 10, 14, 0, 0)).toISOString(), totalCents: 500 },
  ],
  now,
);
ok("exactamente 14 buckets", buckets.length === 14);
ok("bucket de hoy es el último", buckets[13].date === "2026-10-10");
ok("bucket más viejo = hoy - 13 días", buckets[0].date === "2026-09-27");
ok(
  "23:59:59 de Bogotá cae en el bucket del día anterior",
  buckets[12].date === "2026-10-09" && buckets[12].count === 1,
  JSON.stringify(buckets[12]),
);
ok(
  "00:00:00 de Bogotá cae en el bucket de hoy",
  buckets[13].date === "2026-10-10" && buckets[13].count === 2,
  JSON.stringify(buckets[13]),
);
ok(
  "revenue por bucket suma bien",
  buckets[12].revenueCents === 1000 && buckets[13].revenueCents === 3000,
);

console.log("— buildByDay14: la TZ del servidor no filtra —");
// 2026-10-09T23:00:00-05:00 = 2026-10-10T04:00Z = 23:00 del 9 en Bogotá:
// debe caer en el bucket del 9 aunque en UTC ya sea el 10.
const offsetTs = "2026-10-09T23:00:00-05:00";
const localBuckets = buildByDay14([{ createdAt: offsetTs, totalCents: 700 }], now);
ok(
  "offset -05:00 se agrupa por fecha de Bogotá",
  localBuckets[12].date === "2026-10-09" && localBuckets[12].count === 1,
  JSON.stringify(localBuckets[12]),
);

console.log("— buildByDay14: fuera de ventana se descarta —");
const oldTs = new Date(Date.UTC(2026, 8, 20)).toISOString(); // 2026-09-20: 7 días antes del bucket más viejo
const withOld = buildByDay14([{ createdAt: oldTs, totalCents: 999 }], now);
ok(
  "orden fuera de los 14 días no infla ningún bucket",
  withOld.every((b) => b.count === 0 && b.revenueCents === 0),
);

console.log(`\n${pass} pass / ${fail} fail`);
if (fail > 0) process.exitCode = 1;
