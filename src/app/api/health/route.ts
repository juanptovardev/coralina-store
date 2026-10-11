import { db } from "@/db";
import { sql } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

// Versión del paquete: npm_package_version solo existe cuando el proceso lo
// lanza npm (next start directo/systemd/Docker no la setean) → fallback a
// leer package.json una vez. "" si nada está disponible.
let versionCache: string | null = null;
async function getVersion(): Promise<string> {
  if (versionCache !== null) return versionCache;
  const fromEnv = process.env.npm_package_version ?? "";
  if (fromEnv) {
    versionCache = fromEnv;
    return versionCache;
  }
  try {
    const raw = await readFile(path.join(process.cwd(), "package.json"), "utf8");
    versionCache = (JSON.parse(raw) as { version?: string }).version ?? "";
  } catch {
    versionCache = "";
  }
  return versionCache;
}

export async function GET() {
  // Campos aditivos para readiness/liveness: uptime del proceso, latencia de la
  // DB (round-trip de SELECT 1) y versión del paquete.
  const [uptimeSec, version] = [Math.floor(process.uptime()), await getVersion()];
  const started = performance.now();
  try {
    await db.execute(sql`select 1`);
    const dbLatencyMs = Math.round((performance.now() - started) * 100) / 100;
    return Response.json({ ok: true, uptimeSec, dbLatencyMs, version });
  } catch (e) {
    const name = e instanceof Error ? e.name : "Error";
    return Response.json({ ok: false, uptimeSec, version, error: name }, { status: 503 });
  }
}
