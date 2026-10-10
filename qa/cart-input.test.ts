// Tests unitarios del boundary compartido de carrito. Correr: bun qa/cart-input.test.ts
export {};

import { normalizeCartItems } from "../src/lib/cart-input";

let pass = 0;
let fail = 0;
const ok = (name: string, cond: boolean) => {
  if (cond) {
    pass++;
    console.log(`  ok - ${name}`);
  } else {
    fail++;
    console.log(`  FAIL - ${name}`);
  }
};

const a = normalizeCartItems(
  [
    { variantId: 1, quantity: "abc" }, // clamp → 1
    { variantId: 1, quantity: 3 }, // suma → 4
    { variantId: 2, quantity: 20 }, // cap → 9
    { variantId: "x", quantity: 1 }, // variantId inválido → ignorado
    { variantId: 0, quantity: 5 }, // id <= 0 → ignorado
  ],
  "quantity",
);
ok("qty no-numérica se clampea a 1 y suma dedupe (1+3=4)", a.ok && a.items.find((i) => i.variantId === 1)?.quantity === 4);
ok("cap por variante = 9", a.ok && a.items.find((i) => i.variantId === 2)?.quantity === 9);
ok("ignora variantId inválido", a.ok && a.items.length === 2 && a.items.every((i) => Number.isInteger(i.variantId) && i.variantId > 0));

{
  const r = normalizeCartItems([], "quantity");
  ok("array vacío → empty", !r.ok && r.reason === "empty");
}
{
  const r = normalizeCartItems(
    Array.from({ length: 501 }, () => ({ variantId: 1, quantity: 1 })),
    "quantity",
  );
  ok("raw > 500 → too_big", !r.ok && r.reason === "too_big");
}
{
  const r = normalizeCartItems(
    Array.from({ length: 51 }, (_, i) => ({ variantId: i + 1, quantity: 1 })),
    "quantity",
  );
  ok("> 50 variantes distintas → too_big", !r.ok && r.reason === "too_big");
}
{
  const r = normalizeCartItems([{ variantId: 7, qty: 2 }], "qty");
  ok('acepta el field name "qty"', r.ok && r.items[0].variantId === 7 && r.items[0].quantity === 2);
}

console.log(`\n${pass} pass / ${fail} fail`);
if (fail > 0) process.exitCode = 1;
