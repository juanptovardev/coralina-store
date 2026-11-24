// Corre todos los tests bun de qa/ (descubre los archivos, no hay lista a mano).
// Uso: node scripts/test-all.mjs
import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const isWin = process.platform === "win32";
const qaDir = path.join(process.cwd(), "qa");
const files = (await readdir(qaDir)).filter((f) => f.endsWith(".test.ts")).sort();

if (files.length === 0) {
  console.error("[test-all] no hay archivos qa/*.test.ts");
  process.exit(1);
}

const failed = [];
for (const file of files) {
  const started = Date.now();
  const res = spawnSync("bun", [path.join("qa", file)], { stdio: "inherit", shell: isWin });
  const ms = Date.now() - started;
  const ok = res.status === 0;
  console.log(`[test-all] ${ok ? "ok" : "FALLA"} ${file} (${ms} ms)`);
  if (!ok) failed.push(file);
}

console.log(`\n[test-all] ${files.length - failed.length}/${files.length} archivos verdes`);
if (failed.length > 0) {
  console.log("[test-all] fallan: " + failed.join(", "));
  process.exit(1);
}
