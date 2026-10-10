/**
 * Suite QA multi-vértice — Coralina v6 (:3006)
 *   node qa/suite-v6.mjs [v6BaseUrl]
 *
 * Vértices:
 *   V1 golden master (paridad con v4)   V2 flujo E2E (/api/store)
 *   V3 paridad de precios preview/cobro  V4 contrato API + hostiles
 *   V5 inventario: atomicidad/carrera    V6 persistencia SQL round-trip
 *   V7 admin round-trip                  V8 robustez / perímetro
 *   V9 navegación y consistencia         V10 humo de vecinos (solo GET)
 *   V11 checklist UX manual (impresa)
 *
 * Idempotente: pre-limpieza + limpieza final; deja orders=127 y stock base.
 */
const V6 = process.argv[2] ?? "http://localhost:3006";
const V4 = "http://localhost:3004";
const V5 = "http://localhost:3005";
const DB = "postgresql://postgres:postgres@127.0.0.1:5432/coralina_v6";

let pass = 0, fail = 0, warn = 0;
const failures = [], warnings = [];

function ok(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  else { fail++; failures.push(`${name}${detail ? ` — ${detail}` : ""}`); console.log(`  \x1b[31m✗ ${name}\x1b[0m${detail ? ` — ${detail}` : ""}`); }
}
function wa(name, detail = "") {
  warn++; warnings.push(`${name}${detail ? ` — ${detail}` : ""}`);
  console.log(`  \x1b[33m⚠ ${name}\x1b[0m${detail ? ` — ${detail}` : ""}`);
}
function section(t) { console.log(`\n\x1b[1m${t}\x1b[0m`); }

const jar = { admin: "coralina_role=admin", asesor: "coralina_role=asesor", none: undefined };

async function req(base, path, { method = "GET", body, cookie, raw = false, headers = {} } = {}) {
  const h = { "x-real-ip": "127.0.0.1", ...headers };
  if (cookie) h.cookie = cookie;
  if (body !== undefined && !raw) h["content-type"] = "application/json";
  const r = await fetch(`${base}${path}`, { method, headers: h, body: body === undefined ? undefined : raw ? body : JSON.stringify(body), redirect: "manual" });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch { /* html */ }
  return { status: r.status, json, text, headers: r.headers };
}
const g = (base, p, role = "admin") => req(base, p, { cookie: jar[role] });
const postPub = (p, body) => req(V6, p, { method: "POST", body });
const postAdmin = (p, body, role = "admin") => req(V6, p, { method: "POST", body, cookie: jar[role] });

// ---------- utilidades ----------
function tokens(html) {
  let h = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<!--[\s\S]*?-->/g, " ");
  h = h.replace(/<[^>]+>/g, " ");
  h = h.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/&aacute;/g, "á").replace(/&eacute;/g, "é").replace(/&iacute;/g, "í").replace(/&oacute;/g, "ó").replace(/&uacute;/g, "ú").replace(/&ntilde;/g, "ñ");
  return h.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
}
function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  return inter / new Set([...A, ...B]).size;
}

let pg = null, db = null, runStart = new Date();
const restore = new Map(); // variantId -> stock original
async function sql(q, params = []) { return db.query(q, params); }
async function stockOf(variantId) {
  const r = await sql("select stocked from inventory_levels where variant_id=$1", [variantId]);
  return r.rows[0]?.stocked;
}
async function trackStock(variantId) {
  if (!variantId || restore.has(variantId)) return;
  const s = await stockOf(variantId); if (s != null) restore.set(variantId, s);
}
// Repone el stock base de los 3 productos semilla antes de los vértices que
// cobran, para que los 409 no encadenen (fatiga de stock intra-corrida).
async function resetSeedStock() {
  await sql("update inventory_levels set stocked=12 where variant_id=251");
  await sql("update inventory_levels set stocked=4 where variant_id=241");
  await sql("update inventory_levels set stocked=5 where variant_id=255");
}

async function preClean() {
  section("0 · Pre-limpieza (idempotencia)");
  await sql("delete from order_items where order_id in (select id from orders where customer_id in (select id from customers where email like 'qa-v6%'))");
  await sql("delete from shipments where order_id in (select id from orders where customer_id in (select id from customers where email like 'qa-v6%'))");
  // audit ANTES de borrar orders (el subquery depende de orders); display_id ya incluye '#'.
  await sql("delete from audit_log where entity_id in (select display_id from orders where customer_id in (select id from customers where email like 'qa-v6%'))");
  await sql("delete from orders where customer_id in (select id from customers where email like 'qa-v6%')");
  await sql("delete from customers where email like 'qa-v6%'");
  await sql("delete from inventory_levels where variant_id in (select id from variants where product_id in (select id from products where handle like 'qa-%'))");
  await sql("delete from variants where product_id in (select id from products where handle like 'qa-%')");
  await sql("delete from products where handle like 'qa-%'");
  await sql("delete from promotions where name like 'QA V6%' or name like 'QA R5%'");
  // stock base de los 3 productos semilla tocados
  await sql("update inventory_levels set stocked=12 where variant_id=251");
  await sql("update inventory_levels set stocked=4 where variant_id=241");
  await sql("update inventory_levels set stocked=5 where variant_id=255");
  const o = await sql("select count(*)::int n from orders");
  ok("pre-limpieza ok (orders=127)", o.rows[0].n === 127, `orders=${o.rows[0].n}`);
}

async function finalClean() {
  section("C · Limpieza final");
  await sql("delete from order_items where order_id in (select id from orders where customer_id in (select id from customers where email like 'qa-v6%'))");
  await sql("delete from shipments where order_id in (select id from orders where customer_id in (select id from customers where email like 'qa-v6%'))");
  await sql("delete from orders where customer_id in (select id from customers where email like 'qa-v6%')");
  await sql("delete from customers where email like 'qa-v6%'");
  await sql("delete from audit_log where created_at >= $1", [runStart.toISOString()]);
  await sql("delete from inventory_levels where variant_id in (select id from variants where product_id in (select id from products where handle like 'qa-%'))");
  await sql("delete from variants where product_id in (select id from products where handle like 'qa-%')");
  await sql("delete from products where handle like 'qa-%'");
  await sql("delete from promotions where name like 'QA V6%' or name like 'QA R5%'");
  for (const [vid, s] of restore) await sql("update inventory_levels set stocked=$1 where variant_id=$2", [s, vid]);
  await sql("update inventory_levels set stocked=12 where variant_id=251");
  await sql("update inventory_levels set stocked=4 where variant_id=241");
  await sql("update inventory_levels set stocked=5 where variant_id=255");
  const o = await sql("select count(*)::int n from orders");
  const orph = await sql("select count(*)::int n from order_items oi left join orders o on o.id=oi.order_id where o.id is null");
  ok(`orders base restaurado (=127)`, o.rows[0].n === 127, `orders=${o.rows[0].n}`);
  ok(`sin order_items huérfanos`, orph.rows[0].n === 0, `orphans=${orph.rows[0].n}`);
  const pqa = await sql("select count(*)::int n from promotions where name like 'QA V6%'");
  ok(`sin fixtures de promos`, pqa.rows[0].n === 0, `promos_qa=${pqa.rows[0].n}`);
}

// =====================================================================
async function run() {
  const { default: pkg } = await import("pg");
  pg = pkg;
  db = new pg.Client({ connectionString: DB });
  await db.connect();

  console.log(`\n🌊 QA Coralina v6 — ${V6}  (vecinos ${V4}, ${V5})\n`);
  try {
  await preClean();

  // catálogo base (resolver ids/stock reales)
  const cat = (await g(V6, "/api/admin/catalog")).json ?? {};
  const allVars = (cat.products ?? []).flatMap((p) => (p.variants ?? []).map((v) => ({ ...v, handle: p.handle, catSlug: p.categorySlug })));
  const vTop = allVars.find((v) => v.handle === "top-marea" && v.size === "XS");
  const vPanty = allVars.find((v) => v.handle === "panty-ola" && v.size === "XS");
  const vTraje = allVars.find((v) => v.handle === "traje-coral" && v.size === "XS");
  const vOut = allVars.find((v) => v.stock === 0);
  if (!vTop || !vPanty || !vTraje) throw new Error("catálogo base incompleto (falta top-marea/panty-ola/traje-coral XS)");

  /* ================= V1 — Golden Master ================= */
  section("V1 · Golden Master (paridad con v4)");
  let v4Up = true;
  try { v4Up = (await g(V4, "/", "none")).status === 200; } catch { v4Up = false; }
  if (!v4Up) {
    wa("v4 (:3004) apagado → se omite la paridad Golden Master (modo solo-v6)", "V1 skip");
  } else {
    for (const p of ["/", "/coleccion", "/producto/panty-duna", "/producto/traje-coral", "/checkout"]) {
      const [a, b] = await Promise.all([g(V4, p, "none"), g(V6, p, "none")]);
      const j = jaccard(tokens(a.text), tokens(b.text));
      ok(`texto v6 == v4 en ${p} (Jaccard=1.0)`, j === 1, `jac=${j.toFixed(3)} v4=${tokens(a.text).length} v6=${tokens(b.text).length}`);
    }
  }
  const home = await g(V6, "/", "none");
  for (const m of ["Hecho en Chile", "Secado rápido", "Tallas fieles", "UV50+", "Pacífico Sur", "Pinterest", "4,9"]) {
    ok(`home contiene marcador v4 “${m}”`, home.text.includes(m));
  }
  const dead1 = await g(V6, "/catalogo", "none");
  const dead2 = await g(V6, "/carrito", "none");
  ok("ruta v5 muerta /catalogo → 404", dead1.status === 404, `HTTP ${dead1.status}`);
  ok("ruta v5 muerta /carrito → 404", dead2.status === 404, `HTTP ${dead2.status}`);

  /* ================= V2 — Flujo E2E ================= */
  section("V2 · Flujo de compra E2E (POST /api/store)");
  const cust = (n) => ({ customer: { name: n, email: `qa-v6+${n.toLowerCase().replace(/\W/g, "")}@qa.test`, city: "Santiago", address: "Cll 1" } });
  await trackStock(vTop?.id); await trackStock(vPanty?.id); await trackStock(vTraje?.id);

  const t1 = await postPub("/api/store", { ...cust("T1"), items: [{ variantId: vTop.id, qty: 1 }] });
  ok("happy 1 item → 200", t1.status === 200, `HTTP ${t1.status} ${t1.json?.error ?? ""}`);
  ok("respuesta trae code CR-n", /^CR-\d+$/.test(t1.json?.code ?? ""), t1.json?.code);
  ok("respuesta trae total numérico", typeof t1.json?.total === "number", `${t1.json?.total}`);

  const t2 = await postPub("/api/store", { ...cust("T2"), items: [{ variantId: vTop.id, qty: 1 }, { variantId: vPanty.id, qty: 1 }] });
  ok("multi-item → 200", t2.status === 200, `HTTP ${t2.status}`);

  if (vOut) {
    const sold = await postPub("/api/store", { ...cust("Sold"), items: [{ variantId: vOut.id, qty: 1 }] });
    ok("talla agotada → 409", sold.status === 409, `HTTP ${sold.status} variant ${vOut.handle}/${vOut.size}`);
  } else wa("no hay variante con stock 0 para probar 409", "se omite");

  const qBig = await postPub("/api/store", { ...cust("Qbig"), items: [{ variantId: vTop.id, qty: 10 }] });
  ok("qty 10 no rompe (clamp ≤9) → 200", qBig.status === 200, `HTTP ${qBig.status}`);
  const qZero = await postPub("/api/store", { ...cust("Qzero"), items: [{ variantId: vTop.id, qty: 0 }] });
  ok("qty 0 no rompe → 200", qZero.status === 200, `HTTP ${qZero.status}`);

  // Secuencia de display_id: si se degrada, ensureSeeded la re-sincroniza al
  // máximo existente → el checkout no colisiona (regresión clon fresco).
  await resetSeedStock();
  await sql("select setval('orders_display_seq', 5, false)");
  const seqRes = await postPub("/api/store", { ...cust("Seq"), items: [{ variantId: vTop.id, qty: 1 }] });
  ok("checkout tras degradar la secuencia → 200 (re-sync)", seqRes.status === 200, `HTTP ${seqRes.status}`);
  const seqCode = Number(String(seqRes.json?.code ?? "").replace(/\D/g, ""));
  ok("display_id del checkout > 1045 (sin colisión con semilla)", seqCode > 1045, `code=${seqRes.json?.code}`);

  /* ================= V4 — Contrato API + hostiles ================= */
  section("V4 · Contrato POST /api/store + payloads hostiles");
  const empty = await postPub("/api/store", { ...cust("Empty"), items: [] });
  ok("items vacíos → 400", empty.status === 400, `HTTP ${empty.status}`);
  const noEmail = await postPub("/api/store", { customer: { name: "X", email: "" }, items: [{ variantId: vTop.id, qty: 1 }] });
  ok("email vacío → 400", noEmail.status === 400, `HTTP ${noEmail.status}`);
  const noName = await postPub("/api/store", { customer: { name: "", email: "qa-v6+nn@qa.test" }, items: [{ variantId: vTop.id, qty: 1 }] });
  ok("name vacío → 400", noName.status === 400, `HTTP ${noName.status}`);
  const badVar = await postPub("/api/store", { ...cust("Badvar"), items: [{ variantId: "abc", qty: 1 }] });
  ok("variantId 'abc' → 4xx (no 5xx)", badVar.status >= 400 && badVar.status < 500, `HTTP ${badVar.status}`);
  const missing = await postPub("/api/store", { ...cust("Missing"), items: [{ variantId: 99999999, qty: 1 }] });
  ok("variantId inexistente → 4xx (no 5xx)", missing.status >= 400 && missing.status < 500, `HTTP ${missing.status}`);
  const nullItems = await postPub("/api/store", { ...cust("Nulli"), items: null });
  ok("items null → 4xx (no 5xx)", nullItems.status >= 400 && nullItems.status < 500, `HTTP ${nullItems.status}`);
  const floatQty = await postPub("/api/store", { ...cust("Float"), items: [{ variantId: vTop.id, qty: 1.7 }] });
  ok("qty float no produce 5xx", floatQty.status < 500, `HTTP ${floatQty.status}`);
  const hostile = await postPub("/api/store", "not-json-at-all");
  ok("body no-JSON no produce 5xx", hostile.status < 500, `HTTP ${hostile.status}`);

  // hostiles sobre /api/cart/evaluate (endpoint público) — nunca 5xx
  const evHostiles = [
    ["no-JSON", "not-json-at-all"],
    ["items string", { items: "x" }],
    ["variantId abc", { items: [{ variantId: "abc", quantity: 1 }] }],
    ["qty -1", { items: [{ variantId: vTop.id, quantity: -1 }] }],
    ["qty 1.7", { items: [{ variantId: vTop.id, quantity: 1.7 }] }],
    ["qty x", { items: [{ variantId: vTop.id, quantity: "x" }] }],
  ];
  for (const [nm, payload] of evHostiles) {
    const r = await postPub("/api/cart/evaluate", payload);
    ok(`evaluate hostil (${nm}) no 5xx`, r.status < 500, `HTTP ${r.status}`);
  }
  // payload gigante (1000 ítems): dedupe+cap evita el límite de parámetros de PG
  const huge = { items: Array.from({ length: 1000 }, () => ({ variantId: vTop.id, quantity: 1 })) };
  const hugeRes = await postPub("/api/cart/evaluate", huge);
  ok("evaluate payload gigante (1000 ítems) no 5xx", hugeRes.status < 500, `HTTP ${hugeRes.status}`);
  // 51 variantes distintas → fail-fast 400 (no corte silencioso)
  const many = { items: Array.from({ length: 51 }, (_, i) => ({ variantId: 900000 + i, quantity: 1 })) };
  const manyRes = await postPub("/api/cart/evaluate", many);
  ok("evaluate 51 variantes distintas → 400", manyRes.status === 400, `HTTP ${manyRes.status}`);
  // checkout con payload gigante → 400 (mismo cap que evaluate)
  const hugeStore = await postPub("/api/store", { ...cust("Huge"), items: Array.from({ length: 1000 }, () => ({ variantId: vTop.id, qty: 1 })) });
  ok("store payload gigante (1000 ítems) → 400", hugeStore.status === 400, `HTTP ${hugeStore.status}`);

  /* ================= V3 — Paridad de precios ================= */
  section("V3 · Paridad de precios preview/cobro (regla de oro)");
  await resetSeedStock();
  // Sin código: /api/cart/evaluate (motor server, sin crear pedido). Código: /api/store.
  const ev = async (items) => (await postPub("/api/cart/evaluate", { items })).json ?? {};
  const eTop = await ev([{ variantId: vTop.id, quantity: 1 }]);
  ok("1 top: descuento Marea 10 = 1899", eTop.discountCents === 189900 && (eTop.applied?.[0]?.label ?? "").includes("Marea 10"), `${eTop.discountCents} ${eTop.applied?.[0]?.label}`);
  const eCombo = await ev([{ variantId: vTop.id, quantity: 1 }, { variantId: vPanty.id, quantity: 1 }]);
  ok("top+panty sin código: Combo NO auto-aplica (cae a Marea 10 = 1899)", eCombo.discountCents === 189900 && (eCombo.applied?.[0]?.label ?? "").includes("Marea 10"), `${eCombo.discountCents} ${eCombo.applied?.[0]?.label}`);
  const e3 = await ev([{ variantId: vTop.id, quantity: 1 }, { variantId: vPanty.id, quantity: 1 }, { variantId: vTraje.id, quantity: 1 }]);
  ok("top+panty+traje sin código: descuento solo de tops = 1899 (≠ −15% de todo)", e3.discountCents === 189900, `${e3.discountCents}`);
  ok("total con ítem fuera de categoría = 7207100", e3.totalCents === 7207100, `${e3.totalCents}`);
  const eTraje = await ev([{ variantId: vTraje.id, quantity: 1 }]);
  ok("traje solo: sin promo = 0", eTraje.discountCents === 0, `${eTraje.discountCents}`);
  const e2tops = await ev([{ variantId: vTop.id, quantity: 2 }]);
  ok("2 tops sin código: Marea 10 sobre tops = 3798 (drawer==server)", e2tops.discountCents === 379800 && e2tops.totalCents === 3418200, `desc=${e2tops.discountCents} total=${e2tops.totalCents}`);

  const chTop = await postPub("/api/store", { ...cust("CodeTop"), items: [{ variantId: vTop.id, qty: 1 }], promoCode: "MAREA15" });
  ok("1 top + MAREA15 → cobra full (0 desc), promo null", chTop.json?.total === 18990 && chTop.json?.discount === 0 && !chTop.json?.promo, `total=${chTop.json?.total} disc=${chTop.json?.discount} promo=${chTop.json?.promo}`);
  const chBad = await postPub("/api/store", { ...cust("CodeBad"), items: [{ variantId: vTop.id, qty: 1 }], promoCode: "XYZ123" });
  ok("código inválido → 0 descuento", chBad.json?.discount === 0, `disc=${chBad.json?.discount}`);
  const chSp = await postPub("/api/store", { ...cust("CodeSp"), items: [{ variantId: vTop.id, qty: 1 }], promoCode: "  marea15  " });
  ok("código con espacios ' marea15 ' → 0 (trim simétrico)", chSp.json?.discount === 0, `disc=${chSp.json?.discount}`);
  const chBlank = await postPub("/api/store", { ...cust("CodeBlank"), items: [{ variantId: vTop.id, qty: 1 }], promoCode: "   " });
  ok("código en blanco '   ' → se trata como sin código (aplica Marea 10, drawer==server)", chBlank.json?.discount === 1899, `disc=${chBlank.json?.discount}`);
  const chCombo = await postPub("/api/store", { ...cust("CodeCombo"), items: [{ variantId: vTop.id, qty: 1 }, { variantId: vPanty.id, qty: 1 }], promoCode: "MAREA15" });
  ok("top+panty + MAREA15 → Combo 5847", chCombo.json?.discount === 5847, `disc=${chCombo.json?.discount}`);

  /* ================= V5 — Inventario: atomicidad y carrera ================= */
  section("V5 · Inventario: atomicidad y concurrencia");
  const cats = (await g(V6, "/api/admin/catalog")).json?.categories ?? [];
  const cid0 = cats[0]?.id;
  const mk = await postAdmin("/api/admin/catalog", {
    action: "create_product", title: `QA V6 Race ${Date.now()}`, categoryId: cid0, priceCents: 1000000,
    images: ["https://images.pexels.com/photos/9162885/pexels-photo-9162885.jpeg?auto=compress&cs=tinysrgb&w=600"],
    sizes: [{ size: "S", stock: 1 }], status: "published",
  });
  ok("crear producto QA con stock=1", mk.json?.ok === true, mk.json?.error);
  const qaProd = ((await g(V6, "/api/admin/catalog")).json?.products ?? []).find((p) => p.handle?.startsWith("qa-v6-race") || p.title?.startsWith("QA V6 Race"));
  const qaVar = qaProd?.variants?.[0];
  await trackStock(qaVar?.id);
  if (qaVar) {
    const before = await stockOf(qaVar.id);
    const res = await Promise.all(Array.from({ length: 10 }).map((_, i) =>
      postPub("/api/store", { customer: { name: `Race${i}`, email: `qa-v6+race${i}-${Date.now()}@qa.test` }, items: [{ variantId: qaVar.id, qty: 1 }] })));
    const succ = res.filter((r) => r.status === 200).length;
    const conflict = res.filter((r) => r.status === 409).length;
    const after = await stockOf(qaVar.id);
    ok("carrera stock=1: exactamente 1 éxito", succ === 1, `éxitos=${succ}`);
    ok("carrera: 9 rechazos 409", conflict === 9, `409=${conflict}`);
    ok("stock final = 0 (nunca negativo)", after === 0, `antes=${before} después=${after}`);
    ok("ninguna respuesta 5xx", res.every((r) => r.status < 500), res.map((r) => r.status).join(","));
  } else ok("variante QA de carrera creada", false, "no se encontró");

  /* ================= V6 — Persistencia SQL ================= */
  section("V6 · Persistencia round-trip (SQL)");
  await resetSeedStock();
  const emailDedup = `qa-v6+dedup${Date.now()}@qa.test`;
  const o1 = await postPub("/api/store", { customer: { name: "QA V6 Dedup", email: emailDedup }, items: [{ variantId: vTop.id, qty: 1 }] });
  const o2 = await postPub("/api/store", { customer: { name: "QA V6 Dedup", email: emailDedup }, items: [{ variantId: vTop.id, qty: 1 }] });
  ok("dos compras del mismo email → 2 códigos distintos", o1.json?.code !== o2.json?.code, `${o1.json?.code}/${o2.json?.code}`);
  const q = await sql("select o.id,o.display_id,o.source,o.fulfillment_class,o.total_cents,o.discount_cents,c.email,s.status from orders o join customers c on c.id=o.customer_id join shipments s on s.order_id=o.id where o.display_id=$1", [`#${o1.json?.code}`]);
  const row = q.rows[0];
  ok("orden persistida con display_id #CR-n", !!row && /^#CR-\d+$/.test(row.display_id), row?.display_id);
  ok("source=web y fulfillment_class=enviar", row?.source === "web" && row?.fulfillment_class === "enviar", `${row?.source}/${row?.fulfillment_class}`);
  ok("shipment nace en revision", row?.status === "revision", row?.status);
  const items = await sql("select count(*)::int n from order_items where order_id=(select id from orders where display_id=$1)", [`#${o1.json?.code}`]);
  ok("order_items persistidos (1)", items.rows[0].n === 1, `${items.rows[0].n}`);
  const cdup = await sql("select count(*)::int n from customers where email=$1", [emailDedup]);
  ok("customer deduplicado por email (1 fila)", cdup.rows[0].n === 1, `${cdup.rows[0].n}`);
  // refresh de contacto: mismo email con dirección nueva → customers.address actualizada
  const addrEmail = `qa-v6+addr${Date.now()}@qa.test`;
  await postPub("/api/store", { customer: { name: "QA V6 Addr", email: addrEmail, address: "Calle Vieja 1" }, items: [{ variantId: vTop.id, qty: 1 }] });
  await postPub("/api/store", { customer: { name: "QA V6 Addr", email: addrEmail, address: "Calle Nueva 2" }, items: [{ variantId: vTop.id, qty: 1 }] });
  const addrRow = await sql("select address from customers where email=$1", [addrEmail]);
  ok("cliente recurrente actualiza dirección", addrRow.rows[0]?.address === "Calle Nueva 2", addrRow.rows[0]?.address);
  // mismo email SIN dirección → conserva la previa (no la borra con vacío)
  await postPub("/api/store", { customer: { name: "QA V6 Addr", email: addrEmail }, items: [{ variantId: vTop.id, qty: 1 }] });
  const addrRow3 = await sql("select address from customers where email=$1", [addrEmail]);
  ok("cliente sin dirección nueva conserva la previa", addrRow3.rows[0]?.address === "Calle Nueva 2", addrRow3.rows[0]?.address);
  // concurrencia: 2 POST simultáneos del mismo email → 1 sola fila (upsert atómico)
  const emailConc = `qa-v6+conc${Date.now()}@qa.test`;
  const [c1, c2] = await Promise.all([
    postPub("/api/store", { customer: { name: "QA V6 Conc", email: emailConc }, items: [{ variantId: vTop.id, qty: 1 }] }),
    postPub("/api/store", { customer: { name: "QA V6 Conc", email: emailConc }, items: [{ variantId: vTop.id, qty: 1 }] }),
  ]);
  ok("2 POST concurrentes mismo email → ambos 200", c1.status === 200 && c2.status === 200, `${c1.status}/${c2.status}`);
  const concRows = await sql("select count(*)::int n from customers where email=$1", [emailConc]);
  ok("concurrencia no duplica cliente (1 fila)", concRows.rows[0].n === 1, `n=${concRows.rows[0].n}`);
  const aud = await sql("select count(*)::int n from audit_log where entity_id=$1 and actor_role='system'", [`#${o1.json?.code}`]);
  ok("audit_log registra la creación (actor system)", aud.rows[0].n >= 1, `n=${aud.rows[0].n}`);

  /* ================= V7 — Admin round-trip ================= */
  section("V7 · Admin round-trip (cerebro ↔ tienda)");
  await resetSeedStock();
  // producto web → visible en admin
  const adminOrders = (await g(V6, "/api/admin/orders")).json?.orders ?? [];
  ok("pedido web visible en /api/admin/orders", adminOrders.some((o) => o.displayId === `#${o1.json?.code}`));
  const board = (await g(V6, "/api/admin/shipments")).json?.shipments ?? [];
  ok("pedido web aparece en el kanban (revision)", board.some((s) => s.displayId === `#${o1.json?.code}` && s.status === "revision"));

  // admin crea producto published → aparece en tienda; archiva → desaparece
  const hQA = `qa-v6-store-${Date.now()}`;
  const mkPub = await postAdmin("/api/admin/catalog", {
    action: "create_product", title: `QA V6 Store ${Date.now()}`, categoryId: cid0, priceCents: 7770000,
    images: ["https://images.pexels.com/photos/9162885/pexels-photo-9162885.jpeg?auto=compress&cs=tinysrgb&w=600"],
    sizes: [{ size: "S", stock: 2 }], status: "published",
  });
  ok("admin crea producto published", mkPub.json?.ok === true, mkPub.json?.error);
  const coleccion = await g(V6, "/coleccion", "none");
  const newProd = ((await g(V6, "/api/admin/catalog")).json?.products ?? []).find((p) => p.title?.startsWith("QA V6 Store"));
  const newHandle = newProd?.handle;
  ok("producto nuevo aparece en /coleccion (tienda)", !!newHandle && coleccion.text.includes(newHandle), newHandle);
  if (newProd) await postAdmin("/api/admin/catalog", { action: "delete_product", id: newProd.id, hard: true, confirmText: newProd.title, password: "coralina" });
  const coleccion2 = await g(V6, "/coleccion", "none");
  ok("producto archivado/borrado desaparece de la tienda", !!newHandle && !coleccion2.text.includes(newHandle), newHandle);

  // admin crea promo category_percent 1 cat → el motor server la aplica
  const cidTraje = cats.find((c) => c.slug === "traje")?.id;
  const mkPromo = await postAdmin("/api/admin/promos", { action: "create", name: `QA V6 Promo ${Date.now()}`, type: "category_percent", categoryIds: [cidTraje], percent: 50, priority: 1 });
  ok("admin crea promo category_percent", mkPromo.json?.ok === true || mkPromo.json?.id != null, mkPromo.json?.error);
  const eTraje2 = await ev([{ variantId: vTraje.id, quantity: 1 }]);
  ok("promo nueva aplicada por el motor (traje −50%)", eTraje2.discountCents === Math.round(3499000 * 0.5), `${eTraje2.discountCents}`);
  const promos = (await g(V6, "/api/admin/promos")).json?.promotions ?? [];
  const pNew = promos.find((p) => p.name?.startsWith("QA V6 Promo"));
  if (pNew) await postAdmin("/api/admin/promos", { action: "delete", id: pNew.id });

  // guard sku_percent: 400 con != 1 pid
  const skuBad = await postAdmin("/api/admin/promos", { action: "create", name: `QA V6 Sku ${Date.now()}`, type: "sku_percent", productIds: [], percent: 5, priority: 90 });
  ok("sku_percent sin productos → 400", skuBad.status === 400, `HTTP ${skuBad.status}`);
  const sku2 = await postAdmin("/api/admin/promos", { action: "create", name: `QA V6 Sku2 ${Date.now()}`, type: "sku_percent", productIds: [vTop.id, vPanty.id], percent: 5, priority: 90 });
  ok("sku_percent con 2 productos → 400", sku2.status === 400, `HTTP ${sku2.status}`);

  // El editor de diseño (v5) usa /api/admin/design, que normaliza v4→v5 en GET
  // (widgets objeto→array, banner con claves v5). Smoke: responde 200 y entrega widgets como array.
  const designRes = await g(V6, "/api/admin/design", "admin");
  const designLayout = designRes.json?.layouts?.[0];
  ok("design API responde 200 (editor de diseño)", designRes.status === 200, `HTTP ${designRes.status}`);
  ok("design API entrega widgets como array (shape v5 para el editor)", Array.isArray(designLayout?.widgets), `type=${typeof designLayout?.widgets}`);
  ok("home sigue sirviendo directo de la DB", (await g(V6, "/", "none")).status === 200, "");

  /* ================= V8 — Robustez ================= */
  section("V8 · Robustez / perímetro público");
  await resetSeedStock();
  const xss = await postPub("/api/store", { customer: { name: "<script>alert(1)</script>", email: `qa-v6+xss${Date.now()}@qa.test`, address: "<img src=x onerror=alert(1)>" }, items: [{ variantId: vTop.id, qty: 1 }] });
  ok("XSS en name/address → sin 5xx", xss.status === 200 || xss.status === 400, `HTTP ${xss.status}`);
  const sqli = await postPub("/api/store", { customer: { name: "Robert'); DROP TABLE orders;--", email: `qa-v6+sqli${Date.now()}@qa.test` }, items: [{ variantId: vTop.id, qty: 1 }] });
  ok("SQLi básico en name → sin 5xx", sqli.status < 500, `HTTP ${sqli.status}`);
  const ordersStill = (await sql("select count(*)::int n from orders")).rows[0].n;
  ok("tabla orders intacta tras SQLi", ordersStill > 0, `orders=${ordersStill}`);
  const homeH = (await g(V6, "/", "none")).headers;
  ok("header CSP presente en respuestas públicas", (homeH.get("content-security-policy") ?? "").length > 0, homeH.get("content-security-policy")?.slice(0, 40));
  const adminH = (await g(V6, "/admin")).headers;
  ok("admin envía X-Robots-Tag noindex", /noindex/i.test(adminH.get("x-robots-tag") ?? ""), adminH.get("x-robots-tag"));
  const trav = await g(V6, "/api/uploads/..%2f..%2f..%2fetc%2fpasswd", "none");
  ok("uploads path traversal rechazado (404/400)", trav.status === 404 || trav.status === 400, `HTTP ${trav.status}`);
  // fuzzing ligero
  const fz = [];
  for (let i = 0; i < 50; i++) {
    const r = await Promise.all([
      postPub("/api/store", { customer: { name: `F${i}`, email: `qa-v6+fz${i}@qa.test` }, items: i % 2 ? [] : [{ variantId: vTop.id, qty: (i % 3) }] }),
      g(V6, ["/", "/coleccion", "/producto/top-marea", "/admin", "/api/health"][i % 5], i % 2 ? "admin" : "none"),
    ]);
    fz.push(...r.map((x) => x.status));
  }
  ok("fuzzing 50 iteraciones: 0 respuestas 5xx", fz.every((s) => s < 500), `max=${Math.max(...fz)}`);

  /* ================= V9 — Navegación ================= */
  section("V9 · Navegación y consistencia");
  const hh = await g(V6, "/", "none");
  const hrefs = [...new Set([...hh.text.matchAll(/href="(\/[^"#]*)"/g)].map((m) => m[1]))].filter((h) => !h.startsWith("/admin") && !h.startsWith("/api")).slice(0, 30);
  let linkFails = 0; const linkDetail = [];
  for (const href of hrefs) { const r = await g(V6, href, "none"); if (r.status >= 400) { linkFails++; linkDetail.push(`${href}:${r.status}`); } }
  ok(`crawl de ${hrefs.length} links internos → todos 200`, linkFails === 0, linkDetail.join(" "));
  const missingProd = await g(V6, "/producto/no-existe-jamas", "none");
  ok("/producto/inexistente → 404", missingProd.status === 404, `HTTP ${missingProd.status}`);
  const catBad = await g(V6, "/coleccion?cat=basura", "none");
  ok("/coleccion?cat=basura → 200 graceful", catBad.status === 200, `HTTP ${catBad.status}`);
  const clpOk = /\$\s?\d{1,3}(\.\d{3})+/.test(hh.text);
  ok("precios formateados CLP ($ 1.234.567) en home", clpOk, "");
  const realCats = (await sql("select name,slug from categories order by created_at asc limit 3")).rows;
  ok("footer == 3 primeras categorías reales", realCats.every((c) => hh.text.includes(`/coleccion?cat=${c.slug}`) && hh.text.includes(c.name)), realCats.map((c) => `${c.name}:${c.slug}`).join(","));

  /* ================= V10 — Humo vecinos ================= */
  section("V10 · Humo de vecinos (solo GET)");
  const safeGet = async (base, p) => { try { return await g(base, p, "none"); } catch { return { status: 0 }; } };
  const v4h = await safeGet(V4, "/");
  ok(":3004 v4 / → 200 (o apagado → skip)", v4h.status === 200 || v4h.status === 0, `HTTP ${v4h.status}`);
  const v5r = await Promise.all([safeGet(V5, "/"), safeGet(V5, "/catalogo"), safeGet(V5, "/admin"), safeGet(V5, "/checkout")]);
  ok(":3005 v5 / → 200 (o apagado → skip)", v5r[0].status === 200 || v5r[0].status === 0, `HTTP ${v5r[0].status}`);
  ok(":3005 v5 /catalogo → 200 (o apagado)", v5r[1].status === 200 || v5r[1].status === 0, `HTTP ${v5r[1].status}`);
  ok(":3005 v5 /admin → 200 (o apagado)", v5r[2].status === 200 || v5r[2].status === 0, `HTTP ${v5r[2].status}`);
  ok(":3005 v5 /checkout → 404 (o apagado)", v5r[3].status === 404 || v5r[3].status === 0, `HTTP ${v5r[3].status}`);

  /* ================= V11 — Checklist manual ================= */
  section("V11 · Checklist UX manual (humano, Playwright)");
  console.log("  □ Carrusel hero auto 6.5 s + dots verticales + pausa en hover");
  console.log("  □ Drawer carrito + FreeShippingBar ($30.000) + input promo + notas");
  console.log("  □ ComboBuilder: picker top+panty + countdown + WaveDivider");
  console.log("  □ PDP: pills de talla con stock/agotado + SizeChartModal");
  console.log("  □ Checkout: pantalla de éxito “¡Pedido en el agua!” con estados");

  } finally {
    await finalClean();
    await db.end();
  }

  console.log(`\n${"=".repeat(52)}`);
  console.log(`  PASS ${pass}  ·  FAIL ${fail}  ·  WARN ${warn}`);
  if (warnings.length) { console.log(`\n  \x1b[33mWARN:\x1b[0m`); warnings.forEach((w) => console.log(`    ⚠ ${w}`)); }
  if (failures.length) { console.log(`\n  \x1b[31mFAIL:\x1b[0m`); failures.forEach((f) => console.log(`    ✗ ${f}`)); }
  console.log(`${"=".repeat(52)}\n`);
  process.exitCode = fail > 0 ? 1 : 0;
}

run().catch((e) => { console.error("\n💥 Suite abortada:", e?.message ?? e); process.exitCode = 2; });
