// Test unitario del escape CSV compartido (src/lib/csv.ts).
// Correr: bun qa/csv.test.ts
import { csvCell, toCsv } from "../src/lib/csv";

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

console.log("csv (escape anti-inyección)");

ok("celda simple queda entrecomillada", csvCell("hola") === '"hola"');
ok("número se serializa entrecomillado", csvCell(1500) === '"1500"');
ok("comillas internas se duplican", csvCell('a"b') === '"a""b"');
ok("prefijo = recibe guardia", csvCell("=SUM(A1)") === `"'=SUM(A1)"`);
ok("prefijo + recibe guardia", csvCell("+573001112233") === `"'+573001112233"`);
ok("prefijo - recibe guardia", csvCell("-5") === `"'-5"`);
ok("prefijo @ recibe guardia", csvCell("@import") === `"'@import"`);
ok("texto normal sin guardia", csvCell("María José") === '"María José"');

console.log("csv (toCsv)");

ok("header + filas unidas con coma y LF", toCsv(["a", "b"], [[1, 2], ["x", "y"]]) === '"a","b"\n"1","2"\n"x","y"');
ok("celda con coma no rompe columnas", toCsv(["n"], [["p, q"]]).split("\n")[1] === '"p, q"');
ok("celda maliciosa queda neutralizada", toCsv(["n"], [["=cmd|' /C calc'!A0"]]).split("\n")[1] === `"'=cmd|' /C calc'!A0"`);

console.log(`\nPASS ${pass} · FAIL ${fail}`);
process.exitCode = fail > 0 ? 1 : 0;
