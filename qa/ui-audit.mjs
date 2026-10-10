// Auditoría de UI: textos, botones y enlaces del dashboard + web.
// Uso: node qa/ui-audit.mjs [baseUrl]   (default http://localhost:3006)
const BASE = process.argv[2] ?? "http://localhost:3006";
const ADMIN = "coralina_role=admin";

const cache = new Map();
async function get(path, cookie) {
  const key = (cookie ?? "") + "|" + path;
  if (cache.has(key)) return cache.get(key);
  let out;
  try {
    // Con cookie admin NO seguimos redirects: un 3xx significa que el acceso
    // falló (cookie ausente/inválida). Con "follow" devolvía 200 desde "/" y
    // la página parecía sana.
    const r = await fetch(BASE + path, {
      headers: cookie ? { Cookie: cookie } : {},
      redirect: cookie ? "manual" : "follow",
    });
    out = { status: r.status, text: await r.text() };
  } catch {
    out = { status: 0, text: "" };
  }
  cache.set(key, out);
  return out;
}
const ADMIN_PAGES = [
  "/admin", "/admin/pedidos", "/admin/envios", "/admin/productos", "/admin/categorias",
  "/admin/inventario", "/admin/clientes", "/admin/promos", "/admin/auditoria", "/admin/diseno", "/dashboard",
];
const PUB_PAGES = ["/", "/coleccion", "/producto/panty-duna", "/checkout"];

const btnRe = /<button[^>]*>([\s\S]*?)<\/button>/g;
const aRe = /<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
const strip = (s) => s.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

function buttons(html) { const out = []; let m; while ((m = btnRe.exec(html))) { const t = strip(m[1]); if (t) out.push(t); } return out; }
function anchors(html) { const out = []; let m; while ((m = aRe.exec(html))) out.push({ href: m[1], label: strip(m[2]) }); return out; }

const PLACEHOLDER = /\b(TODO|FIXME|lorem|undefined|NaN|placeholder)\b/;
const isRedirect = (st) => st >= 300 && st < 400;
const isDead = (st) => st === 0 || st >= 300;
const httpLabel = (st) => (st === 0 ? "(sin respuesta)" : `(HTTP ${st})`);

// Un único caché (el de get(), clave cookie|URL). Se consulta el estado
// directamente desde ahí: no hay un segundo Map de estados por enlace.
async function check(link, cookie) {
  if (!link.startsWith("/") || link.startsWith("//")) return null;
  if (link.startsWith("/api/")) return null;
  // Solo se corta el fragmento: el query se conserva al fetchear
  // (/coleccion?cat=x debe probarse CON su query, no como /coleccion).
  const clean = link.split("#")[0];
  if (!clean) return null;
  const r = await get(clean, cookie);
  return r.status;
}

const problems = [];
console.log(`\n=== AUDITORÍA UI v6 — ${BASE} ===\n`);

for (const p of ADMIN_PAGES) {
  const r = await get(p, ADMIN);
  console.log(`${p}  HTTP ${r.status}  len=${r.text.length}`);
  if (r.status === 200 && r.text.includes("digest")) problems.push(`[error-boundary] ${p} muestra el error boundary (marcador digest)`);
  const aliasRedirect = p === "/dashboard" && isRedirect(r.status); // /dashboard → /admin es intencional
  if (isRedirect(r.status) && !aliasRedirect) problems.push(`[page] ${p} redirige ${httpLabel(r.status)} — la cookie admin no dio acceso`);
  else if (r.status !== 200 && !aliasRedirect) problems.push(`[page] ${p} → HTTP ${r.status}`);
}
console.log("");

for (const p of PUB_PAGES) {
  const r = await get(p, null);
  console.log(`${p}  HTTP ${r.status}  len=${r.text.length}`);
  if (r.status !== 200) problems.push(`[page] ${p} → HTTP ${r.status}`);
}
console.log("\n--- Botones (labels) ---");
for (const p of [...ADMIN_PAGES, ...PUB_PAGES]) {
  const r = await get(p, ADMIN_PAGES.includes(p) ? ADMIN : null);
  const bs = [...new Set(buttons(r.text))];
  if (bs.length) console.log(`${p}: ${bs.join(" | ")}`);
}

console.log("\n--- Enlaces internos y su estado ---");
const seen = new Set();
for (const p of [...ADMIN_PAGES, ...PUB_PAGES]) {
  const cookie = ADMIN_PAGES.includes(p) ? ADMIN : null;
  const r = await get(p, cookie);
  for (const a of anchors(r.text)) {
    if (!a.href.startsWith("/")) continue;
    // La clave de dedupe incluye el contexto de cookie: un enlace visto en una
    // página admin (con cookie) debe validarse TAMBIÉN sin cookie en las
    // páginas públicas.
    const seenKey = `${cookie ?? "pub"}|${a.href}`;
    if (seen.has(seenKey)) continue;
    seen.add(seenKey);
    const st = await check(a.href, cookie);
    const dead = st === null ? false : isDead(st);
    const flag = st === null ? "" : dead ? "  ✗ MUERTO" : "  ✓";
    if (dead) problems.push(`[link] "${a.label}" → ${a.href} ${httpLabel(st)}`);
    console.log(`  ${a.href}${flag}${a.label ? `   («${a.label}»)` : ""}`);
  }
}

console.log("\n--- Textos sospechosos (placeholder/coherencia) ---");
for (const p of ADMIN_PAGES) {
  const r = await get(p, ADMIN);
  const txt = strip(r.text);
  const m = txt.match(PLACEHOLDER);
  if (m) problems.push(`[texto] ${p} contiene "${m[0]}"`);
}

console.log("\n=== INCOHERENCIAS / PROBLEMAS ===");
if (!problems.length) console.log("  (ninguna detectada)");
else problems.forEach((x) => console.log("  • " + x));
console.log(`\nTotal problemas: ${problems.length}\n`);
process.exitCode = problems.length ? 1 : 0;
