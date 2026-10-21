// Comprueba que ningún destino por defecto apunte a /catalogo (ruta que no existe)
// y que resolveHref traduzca los destinos del editor a rutas reales.
// Correr: bun qa/design-links.test.ts
import { defaultWidgets, LAYOUT_PLANE } from "../src/lib/constants";
import { normalizeWidgets, publishChecklist } from "../src/lib/design";
import { isKnown, resolveHref } from "../src/lib/utils";
import { join } from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

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

console.log("— defaultWidgets: ningún botón apunta a /catalogo —");
for (const mode of Object.keys(LAYOUT_PLANE)) {
  const widgets = defaultWidgets(mode as keyof typeof LAYOUT_PLANE);
  const links = widgets
    .map((w) => String((w.props as Record<string, unknown>)?.link ?? ""))
    .filter(Boolean);
  ok(
    `modo ${mode} sin /catalogo`,
    !links.some((l) => l.includes("/catalogo")),
    `links=${links.join(",")}`,
  );
  ok(
    `modo ${mode} solo usa destinos conocidos`,
    links.every((l) => isKnown(resolveHref(l))),
    `links=${links.join(",")}`,
  );
}

console.log("— normalizeWidgets: el fallback del editor no inventa rutas —");
const w1 = normalizeWidgets({}, {}) as Array<{ type: string; props: Record<string, unknown> }>;
const cta1 = w1.find((w) => w.type === "cta_primary");
const cta2 = w1.find((w) => w.type === "cta_secondary");
ok("cta_primary sin link va a la colección", cta1?.props?.link === "url:/coleccion", String(cta1?.props?.link));
ok("cta_secondary sin link va a la colección", cta2?.props?.link === "url:/coleccion", String(cta2?.props?.link));

const w2 = normalizeWidgets({}, { ctaLink: "coleccion", cta2Link: "" }) as Array<{
  type: string;
  props: Record<string, unknown>;
}>;
ok("link sin prefijo se normaliza", w2.find((w) => w.type === "cta_primary")?.props?.link === "url:/coleccion");
ok("link vacío se normaliza", w2.find((w) => w.type === "cta_secondary")?.props?.link === "url:/coleccion");
ok(
  "ningún widget normalizado apunta a /catalogo",
  !JSON.stringify(w1).includes("/catalogo") && !JSON.stringify(w2).includes("/catalogo"),
);

console.log("— resolveHref: los destinos del editor son rutas reales —");
ok("url:/coleccion → /coleccion", resolveHref("url:/coleccion") === "/coleccion");
ok("collection → /coleccion", resolveHref("collection") === "/coleccion");
ok("vacío → /coleccion", resolveHref("") === "/coleccion");
ok("category:bikinis → /coleccion?cat=bikinis", resolveHref("category:bikinis") === "/coleccion?cat=bikinis");
ok("product:abc → /producto/abc", resolveHref("product:abc") === "/producto/abc");
ok("url:/checkout → /checkout", resolveHref("url:/checkout") === "/checkout");
ok(
  "una ruta muerta no pasa la guarda de destinos",
  !isKnown(resolveHref("url:/catalogo")) && !isKnown(resolveHref("url:/ofertas")),
  `catalogo=${resolveHref("url:/catalogo")}`,
);
ok("una dirección externa es válida", isKnown("https://instagram.com/coralina"));
ok("un producto sin slug no es un destino", !isKnown("/producto/"));
ok("una colección filtrada es un destino", isKnown("/coleccion?cat=bikinis"));

console.log("— el checklist de publicación bloquea destinos inexistentes —");
const linksItem = (link: string) =>
  publishChecklist({
    banner: { imageUrl: "hero.jpg", aspectRatio: 2.6, overlayOpacity: 0.3 },
    widgets: [{ id: "w1", type: "cta_primary", enabled: true, props: { link } }],
  } as unknown as Parameters<typeof publishChecklist>[0]).find((c) => c.id === "links");
ok("destino inexistente: el checklist lo marca", linksItem("url:/catalogo")?.ok === false);
ok("destino real: el checklist lo aprueba", linksItem("url:/coleccion")?.ok === true);
ok("producto con slug: el checklist lo aprueba", linksItem("product:bikini-verde")?.ok === true);
ok("producto sin slug: el checklist lo rechaza", linksItem("product:")?.ok === false);
ok("destino externo: el checklist lo aprueba", linksItem("url:https://instagram.com/coralina")?.ok === true);

console.log("— guard: ninguna ruta muerta en el código —");
const SRC = fileURLToPath(new URL("../src", import.meta.url));
async function sourceFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await sourceFiles(p)));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}
const dead: string[] = [];
for (const f of await sourceFiles(SRC)) {
  if ((await readFile(f, "utf8")).includes("/catalogo")) dead.push(f.replace(SRC, "src"));
}
ok("src sin /catalogo", dead.length === 0, dead.join(", "));

const preview = await readFile(join(SRC, "components/storefront/HomeRenderer.tsx"), "utf8");
ok(
  "el preview del diseño usa resolveHref de lib/utils",
  preview.includes('from "@/lib/utils"') && !/function resolveLink/.test(preview),
);

const coleccionPage = await readFile(join(SRC, "app/coleccion/page.tsx"), "utf8");
const catParam =
  new URL(resolveHref("category:bikinis"), "https://coralina-store.vercel.app").searchParams.keys().next().value ?? "";
const pageParam =
  coleccionPage.match(/searchParams:\s*Promise<\{([^}]*)\}/)?.[1]?.match(/(\w+)\s*\??\s*:/)?.[1] ?? "";
ok(
  "la página de colección lee el mismo parámetro que genera resolveHref",
  catParam.length > 0 && pageParam === catParam,
  `pagina=${pageParam} resolveHref=${catParam}`,
);

console.log(`\n${pass} pass / ${fail} fail`);
if (fail > 0) process.exit(1);
