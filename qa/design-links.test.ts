// Comprueba que ningún destino por defecto apunte a /catalogo (ruta que no existe)
// y que resolveHref traduzca los destinos del editor a rutas reales.
// Correr: bun qa/design-links.test.ts
import { defaultWidgets, LAYOUT_PLANE } from "../src/lib/constants";
import { normalizeWidgets } from "../src/lib/design";
import { resolveHref } from "../src/lib/utils";

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
    `modo ${mode} apunta a la colección`,
    links.every((l) => l === "url:/coleccion"),
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

console.log(`\n${pass} pass / ${fail} fail`);
if (fail > 0) process.exit(1);
