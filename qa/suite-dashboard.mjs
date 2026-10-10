// QA del dashboard admin de Coralina v6 — página por página.
// Uso: node qa/suite-dashboard.mjs [baseUrl]   (default http://localhost:3006)
// Requiere el server :3006 arriba y Postgres (docker coralina-postgres) accesible.
// NO toca v4/v5. Los fixtures QA se crean con prefijo QA y se limpian al final.

const BASE = process.argv[2] ?? "http://localhost:3006";
const ADMIN_PASS = process.env.CORALINA_ADMIN_PASSWORD ?? "coralina";
const jar = { none: "", admin: "coralina_role=admin", asesor: "coralina_role=asesor" };

let pass = 0, fail = 0, warn = 0;
const failures = [], warnings = [];
function ok(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  \u2713 ${name}`); }
  else { fail++; failures.push(`${name}${detail ? " \u2014 " + detail : ""}`); console.log(`  \u2717 ${name}${detail ? " \u2014 " + detail : ""}`); }
}
function wa(name, detail = "") { warn++; warnings.push(`${name}${detail ? " \u2014 " + detail : ""}`); console.log(`  \u26a0 ${name}${detail ? " \u2014 " + detail : ""}`); }
function section(t) { console.log(`\n\u2014 ${t}`); }

async function req(path, { method = "GET", body, role = "none" } = {}) {
  const headers = {};
  if (role && jar[role]) headers.Cookie = jar[role];
  if (body !== undefined) headers["content-type"] = "application/json";
  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, redirect: "manual" });
  } catch (e) {
    return { status: 0, text: "", json: null, headers: new Headers(), err: e?.message };
  }
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { }
  return { status: res.status, text, json, headers: res.headers };
}
const g = (p, role = "admin") => req(p, { role });
const post = (p, body, role = "admin") => req(p, { method: "POST", body, role });
// Detector de error boundary: usamos los textos propios (error.tsx / global-error.tsx)
// en vez de buscar "digest" — el payload RSC de Next incluye `"digest":"$undefined"`
// en toda página y daría un falso positivo.
const ERROR_MARKERS = ["mala pasada", "Algo salió mal", "La consola tuvo un problema", "Application error"];
const noErrorMarker = (r) =>
  typeof r.text === "string" && !ERROR_MARKERS.some((m) => r.text.includes(m));
const http = (r, extra = "") => `HTTP ${r.status}${r.err ? ` \u00b7 ${r.err}` : ""}${extra ? ` \u00b7 ${extra}` : ""}`;

const stamp = Date.now();

async function run() {
  try {
    console.log(`\n=== QA DASHBOARD v6 \u2014 ${BASE} ===`);

    // ---------------- D0 · Auth / middleware (P0) ----------------
    section("D0 \u00b7 Auth y middleware (deny-by-default)");
    const noCookie = await post("/api/admin/orders", { action: "preview_totals", items: [] }, "none");
    ok("POST /api/admin/orders sin cookie \u2192 401", noCookie.status === 401, http(noCookie));
    const withCookie = await post("/api/admin/orders", { action: "preview_totals", items: [] }, "admin");
    ok("POST /api/admin/orders con cookie admin \u2192 pasa el gate (no 401/403)", withCookie.status !== 401 && withCookie.status !== 403, http(withCookie));
    const sesGET = await g("/api/admin/session", "none");
    ok("GET /api/admin/session exento (200)", sesGET.status === 200, http(sesGET));
    ok("GET /api/admin/session sin cookie \u2192 role:null", sesGET.json?.role === null, http(sesGET));
    const sesAdmin = await g("/api/admin/session", "admin");
    ok("GET /api/admin/session con cookie admin \u2192 role admin", sesAdmin.json?.role === "admin", http(sesAdmin));
    const sesGarbage = await fetch(BASE + "/api/admin/session", { headers: { Cookie: "coralina_role=hola" }, redirect: "manual" }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) })).catch(() => ({ status: 0, json: null }));
    ok("GET /api/admin/session cookie basura \u2192 role:null", sesGarbage.json?.role === null, `HTTP ${sesGarbage.status}`);
    const adminNoCookie = await req("/admin", { role: "none" });
    ok("GET /admin sin cookie \u2192 redirige (3xx)", adminNoCookie.status >= 300 && adminNoCookie.status < 400, http(adminNoCookie));
    const badRole = await post("/api/admin/session", { role: "bogus" }, "none");
    ok("POST /api/admin/session rol inv\u00e1lido \u2192 400", badRole.status === 400, http(badRole));
    const adminNoPass = await post("/api/admin/session", { role: "admin" }, "none");
    ok("POST /api/admin/session admin sin clave \u2192 401", adminNoPass.status === 401, http(adminNoPass));

    // Fixtures reales resueltos en runtime (no ids hard-codeados).
    const catalog = await g("/api/admin/catalog", "admin");
    const fixtureVariantId = catalog.json?.products?.[0]?.variants?.[0]?.id;
    const fixtureCategoryId = catalog.json?.categories?.[0]?.id;
    if (fixtureVariantId == null || fixtureCategoryId == null) {
      wa("no se pudieron resolver fixtures reales de cat\u00e1logo (variants/categories)", http(catalog));
    }

    // ---------------- D1 · /admin (Resumen / KPIs) ----------------
    section("D1 \u00b7 /admin (Resumen / KPIs)");
    const home = await g("/admin", "admin");
    ok("/admin con cookie \u2192 200", home.status === 200, http(home));
    ok("/admin sin error boundary (sin marcador digest)", noErrorMarker(home), "digest presente");
    const ordersRes = await g("/api/admin/orders", "admin");
    const orders = ordersRes.json?.orders ?? [];
    ok("GET /api/admin/orders \u2192 200 y lista", ordersRes.status === 200 && Array.isArray(orders), http(ordersRes));
    const metrics = ordersRes.json?.metrics;
    ok("metrics.byDay presente (14 d\u00edas)", Array.isArray(metrics?.byDay) && metrics.byDay.length === 14, `len=${metrics?.byDay?.length}`);

    // ---------------- D2 · /admin/pedidos ----------------
    section("D2 \u00b7 /admin/pedidos (Pedidos + preview)");
    const pedPage = await g("/admin/pedidos", "admin");
    ok("/admin/pedidos \u2192 200 sin digest", pedPage.status === 200 && noErrorMarker(pedPage), http(pedPage));
    if (fixtureVariantId != null) {
      const preview = await post("/api/admin/orders", { action: "preview_totals", items: [{ variantId: fixtureVariantId, quantity: 1 }] }, "admin");
      ok("preview_totals \u2192 200 con totales", preview.status === 200 && typeof preview.json?.totalCents === "number", http(preview));
    } else {
      wa("preview_totals no evaluado: sin variantId real de cat\u00e1logo");
    }
    const cancelGuard = await post("/api/admin/orders", { action: "set_tag", orderId: 0, tag: "cancelado" }, "admin");
    ok("set_tag con orderId inexistente \u2192 4xx (no 5xx)", cancelGuard.status >= 400 && cancelGuard.status < 500, http(cancelGuard));
    const badTag = await post("/api/admin/orders", { action: "set_tag", orderId: 0, tag: "no_existe" }, "admin");
    ok("set_tag con tag inv\u00e1lido \u2192 400", badTag.status === 400, http(badTag));
    const noId = await post("/api/admin/orders", { action: "set_tag", tag: "por_revisar" }, "admin");
    ok("set_tag sin orderId \u2192 400", noId.status === 400, http(noId));
    const noopOrder = orders[0];
    if (noopOrder) {
      const noopBulk = await post("/api/admin/orders", { action: "bulk_tag", orderIds: [noopOrder.id], tag: noopOrder.operationalTag }, "admin");
      ok("bulk_tag no-op \u2192 200 y changed=0", noopBulk.status === 200 && noopBulk.json?.changed === 0 && noopBulk.json?.ok === true, http(noopBulk, `changed=${noopBulk.json?.changed}`));
    } else {
      wa("sin pedidos para probar no-op de bulk_tag");
    }
    const fracBulk = await post("/api/admin/orders", { action: "bulk_tag", orderIds: [2.5], tag: "por_revisar" }, "admin");
    ok("bulk_tag con id no entero \u2192 400", fracBulk.status === 400, http(fracBulk));
    const canceledOrder = orders.find((o) => o.operationalTag === "cancelado");
    if (canceledOrder) {
      const badTrans = await post("/api/admin/orders", { action: "set_tag", orderId: canceledOrder.id, tag: "por_revisar" }, "admin");
      ok("set_tag desde cancelado \u2192 409", badTrans.status === 409, http(badTrans));
    } else {
      wa("sin pedido cancelado para probar transici\u00f3n inv\u00e1lida set_tag (409)");
    }
    // create_manual: fusiona variantes duplicadas y clampea a 9 (alias qty/quantity).
    const stockVariant = (catalog.json?.products ?? [])
      .flatMap((p) => p.variants ?? [])
      .find((v) => (v.stock ?? 0) >= 5);
    if (stockVariant) {
      const manual = await post("/api/admin/orders", {
        action: "create_manual",
        customer: { name: "QA DASH", email: `qa-dash-${stamp}@example.test`, phone: "000", city: "QA", address: "QA" },
        items: [
          { variantId: stockVariant.id, quantity: 2 },
          { variantId: stockVariant.id, qty: 3 },
        ],
        fulfillmentClass: "no_enviar",
      }, "admin");
      ok("create_manual con variantes duplicadas (2+3, alias qty/quantity) \u2192 200", manual.status === 200 && manual.json?.ok === true, http(manual));
      if (manual.json?.ok && manual.json?.orderId) {
        const after = await g("/api/admin/orders", "admin");
        const createdOrder = (after.json?.orders ?? []).find((o) => o.id === manual.json.orderId);
        ok("create_manual fusion\u00f3 2+3 en una l\u00ednea qty=5", createdOrder?.items?.length === 1 && createdOrder?.items?.[0]?.quantity === 5, `items=${createdOrder?.items?.length} qty=${createdOrder?.items?.[0]?.quantity}`);
        // Higiene: cancelar devuelve el stock (hard_delete NO lo restaura);
        // solo borrar si el cancel tuvo éxito, para no filtrar inventario.
        const cancelQa = await post("/api/admin/orders", { action: "set_tag", orderId: manual.json.orderId, tag: "cancelado" }, "admin");
        if (cancelQa.status !== 200) {
          wa("cleanup create_manual: no se pudo cancelar, orden QA retenida", http(cancelQa));
        } else {
          const delQa = await post("/api/admin/orders", { action: "hard_delete", orderId: manual.json.orderId, confirmText: manual.json.displayId, password: ADMIN_PASS }, "admin");
          if (delQa.status !== 200) wa("cleanup create_manual: hard_delete no complet\u00f3", http(delQa));
        }
      }
    } else {
      wa("create_manual no evaluado: sin variante con stock \u2265 5");
    }
    // Cap raw: 501 \u00edtems crudos \u2192 400 (se rechaza antes del merge, sin mutar BD).
    const tooMany = await post("/api/admin/orders", {
      action: "create_manual",
      customer: { name: "QA DASH", email: `qa-dash-cap-${stamp}@example.test`, phone: "0", city: "QA", address: "QA" },
      items: Array.from({ length: 501 }, () => ({ variantId: fixtureVariantId ?? 1, quantity: 1 })),
      fulfillmentClass: "no_enviar",
    }, "admin");
    ok("create_manual con 501 \u00edtems crudos \u2192 400", tooMany.status === 400, http(tooMany));

    // ---------------- D3 · /admin/envios (kanban) ----------------
    section("D3 \u00b7 /admin/envios (Kanban / shipments)");
    const envPage = await g("/admin/envios", "admin");
    ok("/admin/envios \u2192 200 sin digest", envPage.status === 200 && noErrorMarker(envPage), http(envPage));
    const ships = await g("/api/admin/shipments", "admin");
    ok("GET /api/admin/shipments \u2192 200 y lista", ships.status === 200 && Array.isArray(ships.json?.shipments), http(ships));
    const badMove = await post("/api/admin/shipments", { action: "move", shipmentId: 0, status: "reparto" }, "admin");
    ok("move con shipmentId inexistente \u2192 4xx (no 5xx)", badMove.status >= 400 && badMove.status < 500, http(badMove));
    const firstShip = ships.json?.shipments?.[0];
    if (firstShip) {
      const forbiddenMove = await post("/api/admin/shipments", { action: "move", shipmentId: firstShip.id, status: "archivado" }, "admin");
      ok("move a 'archivado' (prohibido) \u2192 409", forbiddenMove.status === 409, http(forbiddenMove));
    } else {
      wa("sin env\u00edos para probar move prohibido (409)");
    }

    // ---------------- D4 · /admin/productos + /categorias + /inventario ----------------
    section("D4 \u00b7 Cat\u00e1logo: productos / categor\u00edas / inventario");
    const prodPage = await g("/admin/productos", "admin");
    ok("/admin/productos \u2192 200 sin digest", prodPage.status === 200 && noErrorMarker(prodPage), http(prodPage));
    const catPage = await g("/admin/categorias", "admin");
    ok("/admin/categorias \u2192 200 sin digest", catPage.status === 200 && noErrorMarker(catPage), http(catPage));
    const invPage = await g("/admin/inventario", "admin");
    ok("/admin/inventario \u2192 200 sin digest", invPage.status === 200 && noErrorMarker(invPage), http(invPage));
    const cat = await g("/api/admin/catalog", "admin");
    ok("GET /api/admin/catalog \u2192 200 con products/categories", cat.status === 200 && Array.isArray(cat.json?.products) && Array.isArray(cat.json?.categories), http(cat));
    const inv = await g("/api/admin/inventory", "admin");
    ok("GET /api/admin/inventory \u2192 200 con levels", inv.status === 200 && Array.isArray(inv.json?.levels), http(inv));

    // ---------------- D5 · /admin/clientes ----------------
    section("D5 \u00b7 /admin/clientes");
    const cliPage = await g("/admin/clientes", "admin");
    ok("/admin/clientes \u2192 200 sin digest", cliPage.status === 200 && noErrorMarker(cliPage), http(cliPage));
    const cli = await g("/api/admin/customers?page=1", "admin");
    ok("GET /api/admin/customers \u2192 200 con lista", cli.status === 200 && Array.isArray(cli.json?.customers ?? cli.json?.rows ?? cli.json?.data), http(cli, `keys=${Object.keys(cli.json ?? {}).join(",")}`));

    // ---------------- D6 · /admin/promos ----------------
    section("D6 \u00b7 /admin/promos");
    const proPage = await g("/admin/promos", "admin");
    ok("/admin/promos \u2192 200 sin digest", proPage.status === 200 && noErrorMarker(proPage), http(proPage));
    const promoName = `QA DASH ${stamp}`;
    if (fixtureCategoryId != null) {
      const createPromo = await post("/api/admin/promos", { action: "create", name: promoName, type: "category_percent", categoryIds: [fixtureCategoryId], percent: 10, priority: 99 }, "admin");
      ok("crear promo v\u00e1lida \u2192 200", createPromo.status === 200, http(createPromo));
      const badPercent = await post("/api/admin/promos", { action: "create", name: `${promoName} bad`, type: "category_percent", categoryIds: [fixtureCategoryId], percent: 500 }, "admin");
      ok("crear promo percent=500 \u2192 400", badPercent.status === 400, http(badPercent));
      const listPromos = await g("/api/admin/promos", "admin");
      const created = (listPromos.json?.promotions ?? []).find((p) => p.name === promoName);
      if (created) {
        const delNoPass = await post("/api/admin/promos", { action: "delete", id: created.id }, "admin");
        ok("borrar promo sin clave \u2192 401", delNoPass.status === 401, http(delNoPass));
        const delPass = await post("/api/admin/promos", { action: "delete", id: created.id, password: ADMIN_PASS }, "admin");
        ok("borrar promo con clave \u2192 200", delPass.status === 200, http(delPass));
      } else {
        wa("no se encontr\u00f3 la promo QA creada para borrar", `name=${promoName}`);
      }
    } else {
      wa("promos no evaluadas: sin categoryId real de cat\u00e1logo");
    }
    // Promo "zombie": category_percent sin categor\u00edas \u2192 400.
    const zombie = await post("/api/admin/promos", { action: "create", name: `QA DASH zombie ${stamp}`, type: "category_percent", percent: 10, categoryIds: [] }, "admin");
    ok("crear promo por categor\u00eda sin categor\u00edas \u2192 400", zombie.status === 400, http(zombie));

    // ---------------- D7 · /admin/auditoria ----------------
    section("D7 \u00b7 /admin/auditoria");
    const audPage = await g("/admin/auditoria", "admin");
    ok("/admin/auditoria \u2192 200 sin digest", audPage.status === 200 && noErrorMarker(audPage), http(audPage));
    const aud = await g("/api/admin/audit", "admin");
    ok("GET /api/admin/audit \u2192 200 con log", aud.status === 200 && Array.isArray(aud.json?.entries), http(aud));
    const csv = await g("/api/admin/audit?format=csv", "admin");
    ok("GET /api/admin/audit?format=csv \u2192 200 text/csv", csv.status === 200 && (csv.headers.get("content-type") ?? "").includes("csv"), http(csv, `ct=${csv.headers.get("content-type")}`));
    const csvLines = (csv.text ?? "").split("\n").filter(Boolean);
    const dataQuoted = csvLines.slice(1).every((l) => l.startsWith('"') && l.endsWith('"'));
    if (csvLines.length > 1) {
      ok("CSV: todas las celdas entrecomilladas por cell()", dataQuoted, `lines=${csvLines.length}`);
    } else {
      wa("audit CSV sin filas de datos \u2014 cell() no verificable");
    }

    // ---------------- D8 · /admin/diseno (editor home, ahora funcional) ----------------
    section("D8 \u00b7 /admin/diseno (editor de home)");
    const dPage = await g("/admin/diseno", "admin");
    ok("/admin/diseno \u2192 200 sin digest", dPage.status === 200 && noErrorMarker(dPage), http(dPage));
    const design = await g("/api/admin/design", "admin");
    const layout = design.json?.layouts?.[0];
    ok("GET /api/admin/design \u2192 200 con layouts", design.status === 200 && Array.isArray(design.json?.layouts), http(design));
    ok("design entrega widgets como array (shape v5)", Array.isArray(layout?.widgets), `type=${typeof layout?.widgets}`);
    ok("design entrega banner con claves v5 (aspectRatio)", typeof layout?.banner?.aspectRatio === "number", `aspectRatio=${layout?.banner?.aspectRatio}`);
    const pub = await post("/api/admin/design", { action: "publish", id: layout?.id }, "admin");
    ok("publish del home \u2192 200 (checklist v4 ya no falla)", pub.status === 200, http(pub));

    // ---------------- D9 · RBAC (asesor) ----------------
    section("D9 \u00b7 RBAC (rol asesor)");
    const asesorCatalog = await g("/api/admin/catalog", "asesor");
    ok("asesor GET catalog \u2192 200 (lectura permitida)", asesorCatalog.status === 200, http(asesorCatalog));
    const rbacProd = catalog.json?.products?.[0];
    if (rbacProd) {
      const asesorDel = await post("/api/admin/catalog", { action: "delete_product", id: rbacProd.id, hard: true, confirmText: rbacProd.title }, "asesor");
      ok("asesor hard-delete \u2192 403", asesorDel.status === 403, http(asesorDel));
      const wrongPass = await post("/api/admin/catalog", { action: "delete_product", id: rbacProd.id, hard: true, confirmText: rbacProd.title, password: "definitely-wrong" }, "admin");
      ok("admin hard-delete con clave incorrecta \u2192 401", wrongPass.status === 401, http(wrongPass));
      const noConfirm = await post("/api/admin/catalog", { action: "delete_product", id: rbacProd.id, hard: true }, "admin");
      ok("admin hard-delete sin confirmText \u2192 400", noConfirm.status === 400, http(noConfirm));
    } else {
      wa("RBAC no evaluado: sin producto real (catalog vac\u00edo)");
    }

    // ---------------- D10 · Inferencias l\u00f3gicas (deuda ORCA) ----------------
    section("D10 \u00b7 Inferencias l\u00f3gicas (deuda conocida \u2014 documentar, no bloquear)");
    // I1: update_threshold debe respetar el lock optimista (esperadoUpdatedAt obsoleto \u2192 409).
    const invLevels = (await g("/api/admin/inventory", "admin")).json?.levels ?? [];
    if (invLevels.length === 0) {
      wa("sin niveles de inventario \u2014 inferencia I1 (update_threshold) no evaluada");
    } else if (fixtureVariantId != null) {
      // Usa un variantId de producto real (no levels[0], que puede venir de un
      // leftJoin sin fila de inventario y dar 404).
      const thr = await post("/api/admin/catalog", { action: "update_threshold", variantId: fixtureVariantId, threshold: 4, expectedUpdatedAt: "1970-01-01T00:00:00.000Z" }, "admin");
      if (thr.status === 200) wa("update_threshold ignor\u00f3 expectedUpdatedAt (sin lock optimista)", http(thr));
      else if (thr.status === 404) wa("update_threshold sin fila de inventario \u2014 inferencia I1 no evaluada", http(thr));
      else ok("update_threshold respeta expectedUpdatedAt (lock optimista)", thr.status === 409, http(thr));
    } else {
      wa("inferencia I1 no evaluada: sin variantId real de cat\u00e1logo");
    }
    // I3: /dashboard debe llevar X-Robots-Tag noindex.
    const dash = await g("/dashboard", "admin");
    ok("/dashboard responde (redirect a /admin)", dash.status >= 200 && dash.status < 400, http(dash));
    ok("/dashboard con X-Robots-Tag noindex", (dash.headers.get("x-robots-tag") ?? "").includes("noindex"), http(dash, `xrt=${dash.headers.get("x-robots-tag")}`));
    // Lock optimista POSITIVO sobre update_stock (variantId real).
    if (fixtureVariantId != null) {
      const lockStock = await post("/api/admin/catalog", { action: "update_stock", variantId: fixtureVariantId, stocked: 1, expectedUpdatedAt: "1970-01-01T00:00:00.000Z" }, "admin");
      ok("update_stock con expectedUpdatedAt obsoleto \u2192 409", lockStock.status === 409, http(lockStock));
    } else {
      wa("lock optimista update_stock no evaluado: sin variantId real de cat\u00e1logo");
    }
  } finally {
    // Higiene: borra cualquier promo QA DASH que haya quedado viva.
    try {
      const list = await g("/api/admin/promos", "admin");
      const leftovers = (list.json?.promotions ?? []).filter((p) => String(p.name ?? "").startsWith("QA DASH"));
      for (const p of leftovers) {
        await post("/api/admin/promos", { action: "delete", id: p.id, password: ADMIN_PASS }, "admin");
      }
    } catch { }

    // Red de seguridad: borra órdenes QA creadas por create_manual (email qa-dash-*).
    // Solo hard_delete si el cancel (única vía que devuelve stock) tuvo éxito.
    try {
      const all = await g("/api/admin/orders", "admin");
      const qaOrders = (all.json?.orders ?? []).filter((o) => String(o.customer?.email ?? "").startsWith("qa-dash-"));
      for (const o of qaOrders) {
        const cancel = await post("/api/admin/orders", { action: "set_tag", orderId: o.id, tag: "cancelado" }, "admin");
        if (cancel.status !== 200) {
          wa("cleanup finally: no se pudo cancelar, orden QA retenida", `#${o.displayId} ${http(cancel)}`);
          continue;
        }
        const del = await post("/api/admin/orders", { action: "hard_delete", orderId: o.id, confirmText: o.displayId, password: ADMIN_PASS }, "admin");
        if (del.status !== 200) wa("cleanup finally: no se pudo borrar la orden QA", `#${o.displayId} ${http(del)}`);
      }
    } catch { }

    // ---------------- Resumen (siempre, tras la limpieza) ----------------
    console.log(`\n=== RESUMEN: ${pass} PASS \u00b7 ${fail} FAIL \u00b7 ${warn} WARN ===`);
    if (failures.length) { console.log("FAIL:"); failures.forEach((f) => console.log("  - " + f)); }
    if (warnings.length) { console.log("WARN:"); warnings.forEach((w) => console.log("  - " + w)); }

    process.exitCode = fail > 0 ? 1 : 0;
  }
}

run().catch((e) => { console.error("\ud83d\udca5 Suite dashboard abortada:", e?.message ?? e); process.exitCode = 2; });
