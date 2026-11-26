// Contrato de unidades del storefront y del checkout por WhatsApp.
// La BD y formatCOP trabajan en céntimos; /api/store responde el total en pesos.
import { readFileSync } from "node:fs";

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

const shell = readFileSync("src/components/store/shell.tsx", "utf8");
const shop = readFileSync("src/components/store/shop.tsx", "utf8");
const checkout = readFileSync("src/components/store/checkout.tsx", "utf8");
const panel = readFileSync("src/app/mi-cuenta/panel.tsx", "utf8");
const api = readFileSync("src/app/api/store/route.ts", "utf8");

console.log("— catálogo y carrito en céntimos —");
ok("el catálogo conserva priceCents", shell.includes("price: p.priceCents,"));
ok("compareAt conserva céntimos", shell.includes("compareAt: p.compareAtCents == null ? null : p.compareAtCents,"));
ok("las promos no se dividen por 100", !/amountCents\s*\/\s*100|comboPriceCents\s*\?\?\s*0\)\s*\/\s*100|minSubtotalCents\s*\/\s*100/.test(shell));
ok("la cotización server conserva céntimos", !/quote\.(subtotalCents|discountCents|totalCents)\s*\/\s*100/.test(shop));
ok("repetir pedido conserva céntimos", panel.includes("price: cur.priceCents,") && !panel.includes("price: cur.priceCents / 100"));

console.log("— contrato de checkout y WhatsApp —");
ok("el éxito depende del código del pedido", checkout.includes("if (!response.ok || !data?.code)"));
ok("la API responde total en pesos", api.includes("total: (order?.totalCents ?? 0) / 100"));
ok("checkout convierte la respuesta a céntimos", checkout.includes("const totalCents = Math.round(Number(data.total ?? total / 100) * 100)"));
ok("el mensaje usa el total convertido", checkout.includes('"Total: " + formatCOP(totalCents)'));
ok("el correo es obligatorio", checkout.includes("!form.email.trim()"));
ok("el destino es el WhatsApp confirmado", checkout.includes('WHATSAPP_NUMBER = "573150000855"'));
ok("el método queda como whatsapp", checkout.includes('payment: { method: "whatsapp", ref: "cliente-envia" }'));
ok("la idempotencia sigue activa", checkout.includes("idempotencyKey: idempotencyKeyRef.current"));

console.log(`\nPASS ${pass} · FAIL ${fail}`);
if (fail > 0) process.exit(1);
