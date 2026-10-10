/**
 * Paridad de motores — lado SERVER (evaluateCart via /api/cart/evaluate).
 * Sin efectos secundarios: NO crea pedidos.
 *   node qa/parity-engine.mjs [baseUrl]     (default :3006)
 */
const BASE = process.argv[2] ?? "http://localhost:3006";
let pass = 0;
let fail = 0;
const ok = (name, cond, detail = "") => {
  cond ? pass++ : fail++;
  console.log(`  ${cond ? "PASS" : "FAIL"} ${name}${!cond && detail ? " — " + detail : ""}`);
};

async function evaluate(items, code) {
  const body = { items };
  if (code !== undefined) body.code = code;
  const r = await fetch(`${BASE}/api/cart/evaluate`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": "127.0.0.1" },
    body: JSON.stringify(body),
  });
  return r.json();
}

// variant ids v6: top-marea XS=251, panty-ola XS=241, traje-coral XS=255
const TOP = { variantId: 251, quantity: 1 };
const PANTY = { variantId: 241, quantity: 1 };
const TRAJE = { variantId: 255, quantity: 1 };

// [nombre, items, subtotalCents, discountCents, label esperado]
const CASES = [
  ["S-T1 1 top", [TOP], 1899000, 189900, "Marea 10 (Tops)"],
  ["S-T2 top+panty", [TOP, PANTY], 3898000, 584700, "Combo Marea"],
  ["S-T5 3 items", [TOP, PANTY, TRAJE], 7397000, 584700, "Combo Marea"],
  ["S-T6 2 tops", [{ ...TOP, quantity: 2 }], 3798000, 569700, "Combo Marea"],
  ["S-T7 traje solo", [TRAJE], 3499000, 0, null],
];

for (const [name, items, sub, disc, label] of CASES) {
  const t = await evaluate(items);
  ok(
    name,
    t.subtotalCents === sub && t.discountCents === disc && (t.applied[0]?.label ?? null) === label,
    `esperado sub=${sub} disc=${disc} lbl=${label} · got sub=${t.subtotalCents} disc=${t.discountCents} lbl=${t.applied[0]?.label}`,
  );
}

// Guard admin: sku_percent con 0 o >1 productos -> 400 (contrato del storefront)
for (const pids of [[], [251, 241]]) {
  const r = await fetch(`${BASE}/api/admin/promos`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "coralina_role=admin" },
    body: JSON.stringify({ action: "create", name: "QA V6 guard sku", type: "sku_percent", percent: 10, productIds: pids }),
  });
  ok(`sku_percent pids=${pids.length} -> 400`, r.status === 400, `status=${r.status}`);
}

// Casos con code (contract v4: el code restringe el pool) via /api/cart/evaluate
const CODECASES = [
  ["S-T3 1 top + MAREA15", [TOP], "MAREA15", 0],
  ["S-T3b MAREA15 con espacios", [TOP], "  marea15  ", 0],
  ["S-T4 codigo invalido", [TOP], "XYZ123", 0],
];
for (const [name, items, code, disc] of CODECASES) {
  const t = await evaluate(items, code);
  ok(name, t.discountCents === disc, `esperado disc=${disc} · got disc=${t.discountCents} lbl=${t.applied[0]?.label}`);
}

// Guard admin (F7): whitelist de type y montos obligatorios -> 400
const GUARDS = [
  ["tipo invalido", { type: "nope", percent: 10 }],
  ["combo sin precio", { type: "combo", percent: 10, comboPriceCents: 0 }],
  ["category_amount sin monto", { type: "category_amount", percent: 10, amountCents: 0 }],
  ["cart_amount sin monto ni percent", { type: "cart_amount", amountCents: 0, percent: 0 }],
  ["percent 500", { type: "category_percent", percent: 500, categoryIds: [12] }],
  ["percent 0", { type: "category_percent", percent: 0, categoryIds: [12] }],
  ["percent NaN", { type: "category_percent", percent: "abc", categoryIds: [12] }],
  ["amount NaN", { type: "category_amount", amountCents: "abc", categoryIds: [12] }],
  ["endsAt invalida", { type: "category_percent", percent: 10, categoryIds: [12], endsAt: "no-es-fecha" }],
];
for (const [name, extra] of GUARDS) {
  const r = await fetch(`${BASE}/api/admin/promos`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "coralina_role=admin" },
    body: JSON.stringify({ action: "create", name: "QA V6 guard " + name, ...extra }),
  });
  ok(`guard ${name} -> 400`, r.status === 400, `status=${r.status}`);
}

console.log(`\nparity-engine: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
