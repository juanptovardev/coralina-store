// Test unitario del scanner de referencias de uploads (GC de huérfanas, F5).
// Correr: bun qa/upload-scan.test.ts
import { collectUploadNames } from "../src/lib/upload-scan";

export {};

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log("  ✓ " + name);
  } else {
    fail++;
    console.log("  ✗ " + name);
  }
}

console.log("upload-scan (referencias de imágenes)");

const set = new Set<string>();
collectUploadNames(
  {
    images: ["/uploads/products/a.jpg", "/uploads/products/b.jpg?v=2"],
    nested: { deep: [{ url: "/uploads/products/c.png#frag" }] },
    weird: "/uploads/products/pro-50%.jpg",
    encoded: "/uploads/products/ok%2Fslash.jpg",
    external: "https://cdn.example.com/x.jpg",
    empty: "",
    list: [],
  },
  set,
);

ok("token simple capturado", set.has("a.jpg"));
ok("token con ?query → archivo base sigue referenced", set.has("b.jpg"));
ok("token con #frag → archivo base sigue referenced", set.has("c.png"));
ok("% malformado no lanza y conserva el token crudo", set.has("pro-50%.jpg"));
ok("%2F decodificado a /", set.has("ok/slash.jpg"));
ok("URLs externas ignoradas", !set.has("x.jpg"));
ok("sin capturas espurias", set.size === 5);

// Strings vacíos/arrays vacíos no rompen nada (cobertura del else-if).
const vacio = new Set<string>();
let sinLanzar = true;
try {
  collectUploadNames({ a: "", b: [], c: { d: null } }, vacio);
} catch {
  sinLanzar = false;
}
ok("estructura vacía: no lanza y no captura", sinLanzar && vacio.size === 0);

console.log(`\nPASS ${pass} · FAIL ${fail}`);
process.exitCode = fail > 0 ? 1 : 0;
