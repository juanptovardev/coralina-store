/**
 * Paridad de motores — lado DRAWER a través del MAPPER REAL (getCatalog).
 * Corre con bun desde la raíz de v6 (auto-carga .env; resuelve @/* del tsconfig):
 *   bun qa/parity-drawer.ts
 * Requiere el server vivo en :3006 (para comparar contra /api/cart/evaluate).
 */
import { getCatalog } from "../src/components/store/shell";
import { evaluatePromos } from "../src/lib/domain";
import pg from "pg";

const BASE = "http://localhost:3006";
const { catalog, promos } = await getCatalog();

const byslug = (s: string) => catalog.find((p) => p.slug === s)!;
const line = (slug: string, qty = 1) => {
  const p = byslug(slug);
  const v = p.variants[0];
  return { variantId: v.id, productId: p.id, productName: p.name, categorySlug: p.categorySlug, size: v.size, sku: v.sku, qty, price: p.price };
};

const TOP = line("top-marea");
const PANTY = line("panty-ola");
const TRAJE = line("traje-coral");

async function server(items: { variantId: string; qty: number }[]) {
  const r = await fetch(`${BASE}/api/cart/evaluate`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": "127.0.0.1" },
    body: JSON.stringify({ items: items.map((i) => ({ variantId: Number(i.variantId), quantity: i.qty })) }),
  });
  return r.json();
}

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean, detail = "") {
  cond ? pass++ : fail++;
  console.log(`  ${cond ? "PASS" : "FAIL"} ${name}${!cond && detail ? " — " + detail : ""}`);
}

// Casos sin código: drawer (CLP) * 100 == server (cents)
const NOCODE: Array<[string, ReturnType<typeof line>[]]> = [
  ["D-T1 1 top", [TOP]],
  ["D-T2 top+panty", [TOP, PANTY]],
  ["D-T5 3 items", [TOP, PANTY, TRAJE]],
  ["D-T7 traje solo", [TRAJE]],
  ["D-T6 2 tops (multi-cat OR)", [TOP, TOP]],
];
for (const [name, lines] of NOCODE) {
  const d = evaluatePromos(lines, promos, null);
  const s = await server(lines.map((l) => ({ variantId: l.variantId, qty: l.qty })));
  ok(
    `${name}: drawer==server`,
    Math.round(d.total * 100) === s.totalCents && Math.round(d.discount * 100) === s.discountCents,
    `drawer total=${d.total} disc=${d.discount} · server total=${s.totalCents / 100} disc=${s.discountCents / 100} (${d.applied?.name ?? "—"} vs ${s.applied[0]?.label ?? "—"})`,
  );
}

// A1: sin código, una promo con `code` (Combo Marea → MAREA15) NO se auto-aplica.
// El drawer cae a la promo sin código (Marea 10 sobre tops) — igual que el server.
const dCombo = evaluatePromos([TOP, PANTY], promos, null);
ok(
  "D-T2b top+panty sin código: no auto-aplica Combo Marea (usa Marea 10)",
  dCombo.applied?.name === "Marea 10 (Tops)" && Math.round(dCombo.discount * 100) === 189900,
  `applied=${dCombo.applied?.name} disc=${dCombo.discount}`,
);

// Casos con código (contract v4: el código restringe el pool)
// Code válido pero promo no elegible → v4 verbatim: note null, reason vive en `considered`.
const d3 = evaluatePromos([TOP], promos, "MAREA15");
ok(
  "D-T3 MAREA15 -> 0",
  d3.discount === 0 && d3.applied === null && d3.considered.length > 0,
  `disc=${d3.discount} note=${d3.note} considered=${d3.considered.map((c) => c.reason).join(" | ")}`,
);
const d3t = evaluatePromos([TOP], promos, "  marea15  ");
ok("D-T3b MAREA15 con espacios -> 0 (trim)", d3t.discount === 0, `disc=${d3t.discount}`);
const d4 = evaluatePromos([TOP], promos, "XYZ123");
ok("D-T4 codigo invalido -> 0", d4.discount === 0);

// Combos nativos v5 (bundle): se inserta una fixture propia para garantizar
// cobertura real (el pool base no trae combos nativos).
const fx = new pg.Client({ connectionString: process.env.DATABASE_URL! });
await fx.connect();
const cleanFx = () => fx.query("delete from promotions where name like 'QA PARITY%'");
const addFx = `insert into promotions (name,type,category_ids,product_ids,percent,amount_cents,min_qty,min_subtotal_cents,combo_price_cents,priority,stackable,enabled,starts_at,ends_at,code,usage_count) values ($1,$2,$3::jsonb,$4::jsonb,$5,$6,$7,$8,$9,$10,false,true,now(),null,'',0)`;
const catRows = ((await fx.query("select id, slug from categories")).rows) as { id: number; slug: string }[];
const cid = (slug: string) => catRows.find((c) => c.slug === slug)!.id;
try {
  await cleanFx();

  const comboCatIds = JSON.stringify([cid("tops"), cid("panty")]);
  await fx.query(addFx, ["QA PARITY Combo", "combo", comboCatIds, "[]", 0, 0, 2, 0, 3000000, 1]);
  const c2 = await getCatalog();
  const bundles = c2.promos.filter((p) => p.type === "combo" && (p.scope as Record<string, unknown>).comboPrice != null);
  console.log(`  (combos nativos mapeados: ${bundles.length})`);
  ok("cobertura bundle >= 1", bundles.length >= 1, "sin combo nativo en DB: evidencia vacia");
  for (const b of bundles) {
    const scope = b.scope as Record<string, unknown>;
    const cats = (scope.requires as Array<{ category: string }>).map((r) => r.category);
    const minQty = (scope.minQty as number) || 2;
    const lines = c2.catalog
      .filter((p) => cats.includes(p.categorySlug))
      .slice(0, minQty)
      .map((p) => line(p.slug));
    const d = evaluatePromos(lines, c2.promos, null);
    const s = await server(lines.map((l) => ({ variantId: l.variantId, qty: l.qty })));
    ok(
      `bundle "${b.name}": drawer==server`,
      Math.round(d.discount * 100) === s.discountCents,
      `drawer disc=${d.discount} · server disc=${s.discountCents / 100}`,
    );
  }

  // F1: cart_amount con percent>0 y amountCents=0 (el server antes ignoraba percent)
  await cleanFx();
  await fx.query(addFx, ["QA PARITY F1", "cart_amount", "[]", "[]", 10, 0, 0, 0, 0, 1]);
  {
    const c = await getCatalog();
    const d = evaluatePromos([TOP], c.promos, null);
    const s = await server([{ variantId: TOP.variantId, qty: 1 }]);
    ok("F1 cart_amount(percent=10,amount=0) drawer==server",
      Math.round(d.discount * 100) === s.discountCents && Math.round(d.total * 100) === s.totalCents,
      `drawer disc=${d.discount} · server disc=${s.discountCents / 100}`);
  }

  // F2: category_amount FLAT (no multiplica por unidad) con qty=2
  await cleanFx();
  await fx.query(addFx, ["QA PARITY F2", "category_amount", JSON.stringify([cid("tops")]), "[]", 0, 500000, 0, 0, 0, 1]);
  {
    const c = await getCatalog();
    const d = evaluatePromos([TOP, TOP], c.promos, null);
    const s = await server([{ variantId: TOP.variantId, qty: 2 }]);
    ok("F2 category_amount flat qty=2 drawer==server",
      Math.round(d.discount * 100) === s.discountCents && Math.round(d.total * 100) === s.totalCents,
      `drawer disc=${d.discount} · server disc=${s.discountCents / 100}`);
  }
} finally {
  await cleanFx();
  await fx.end();
}

console.log(`\nparity-drawer: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
