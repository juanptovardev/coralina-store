// Test unitario del helper de precios (src/lib/format.ts). Sin DB.
// Correr: bun qa/format.test.ts
import { formatPriceInput, parsePriceInput } from "../src/lib/format";

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

console.log("format (parsePriceInput: pesos → centavos)");

ok('"28990" → 2899000', parsePriceInput("28990") === 2899000);
ok('"28.990" → 2899000', parsePriceInput("28.990") === 2899000);
ok('"28990,50" → 2899050', parsePriceInput("28990,50") === 2899050);
ok('"28.990,50" → 2899050', parsePriceInput("28.990,50") === 2899050);
ok('"1.234.567" → 123456700 (miles múltiples)', parsePriceInput("1.234.567") === 123456700);
ok('"28990.50" → 2899050 (punto decimal tolerado)', parsePriceInput("28990.50") === 2899050);
ok('espacios y "$" se limpian', parsePriceInput("  $28.990,50 ") === 2899050);
ok('"0,50" → 50', parsePriceInput("0,50") === 50);
ok('"" → null', parsePriceInput("") === null);
ok('"   " → null', parsePriceInput("   ") === null);
ok('"abc" → null', parsePriceInput("abc") === null);
ok('"-5" → null', parsePriceInput("-5") === null);
ok('"0" → null', parsePriceInput("0") === null);
ok('"0" con miles ("0.000") → null', parsePriceInput("0.000") === null);

console.log("format (formatPriceInput: centavos → texto es-CO)");

ok('2899000 → "28.990"', formatPriceInput(2899000) === "28.990");
ok('2899050 → "28.990,50"', formatPriceInput(2899050) === "28.990,50");
ok('150000 → "1.500"', formatPriceInput(150000) === "1.500");
ok('0 → ""', formatPriceInput(0) === "");
ok('-5 → ""', formatPriceInput(-5) === "");

console.log("format (ida y vuelta)");

ok('roundtrip 2899050', parsePriceInput(formatPriceInput(2899050)) === 2899050);
ok('roundtrip 150000', parsePriceInput(formatPriceInput(150000)) === 150000);
ok('roundtrip 99999999', parsePriceInput(formatPriceInput(99999999)) === 99999999);

console.log(`\nPASS ${pass} · FAIL ${fail}`);
process.exitCode = fail > 0 ? 1 : 0;
