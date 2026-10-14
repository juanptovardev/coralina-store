// Login REAL vía Playwright (mismo motor que el MCP @playwright/mcp):
// abre el portal en Edge headless, hace login con rol+clave y entrega la
// cookie de sesión + verifica que esa cookie pasa la API admin.
// Uso:  node scripts/qa-login.mjs [baseUrl]   (default http://localhost:3006)
// Env:  QA_PASSWORD (default "coralina"), QA_ROLE (default "admin")
//       El default "coralina" es SOLO para QA local; en prod Vercel las
//       credenciales vienen de env vars y no se usan estos defaults.
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:3006";
const PASSWORD = process.env.QA_PASSWORD ?? "coralina";
const ROLE = process.env.QA_ROLE ?? "admin";

const browser = await chromium.launch({ channel: "msedge", headless: true });
let exitCode = 1;
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 30000 });
  if (ROLE !== "admin") await page.selectOption("#login-role", ROLE);
  await page.fill("#login-pw", PASSWORD);
  await Promise.all([
    page.waitForURL("**/admin**", { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  const cookies = await context.cookies(BASE);
  const c = cookies.find((x) => x.name === "coralina_role");
  if (!c) {
    console.log("QA-LOGIN-FAIL: llegó a /admin pero sin cookie coralina_role. url=" + page.url());
    process.exit(1);
  }
  console.log("QA-LOGIN-OK url=" + page.url());
  console.log("COOKIE=" + c.value);
  const r = await fetch(BASE + "/api/admin/catalog", {
    headers: { cookie: `coralina_role=${c.value}` },
  });
  console.log("CATALOG-CON-COOKIE=" + r.status);
  exitCode = r.status === 200 ? 0 : 1;
} catch (e) {
  console.log("QA-LOGIN-ERROR: " + (e?.message ?? e));
} finally {
  await browser.close();
}
process.exit(exitCode);
