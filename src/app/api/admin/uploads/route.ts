import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { categories, homeLayouts, products } from "@/db/schema";
import { getActor, ForbiddenError, type Actor } from "@/lib/session";
import { recordAudit } from "@/lib/audit";
import { sniffImageType, type SniffedImageType } from "@/lib/image-sniff";

/**
 * Sistema de gestión de imágenes del servidor.
 * POST   (multipart/form-data, campo "file") → guarda en public/uploads/products/ → { ok, url }
 * DELETE (?url=/uploads/products/<nombre>)   → elimina el archivo del servidor → { ok: true }
 * GET    (?orphans=1)                        → { orphans: ["/uploads/products/<nombre>"] }
 * POST   (application/json, action "purge_orphans", { urls: string[] }) → { ok, deleted: n }
 *
 * Seguridad:
 *  - Se detecta el tipo real por magic bytes (no se confía en el Content-Type del cliente).
 *  - Máx 5 MB.
 *  - Nombre siempre aleatorio (uuid) → nunca se confía en el nombre del cliente.
 *  - DELETE/purge solo aceptan rutas dentro de public/uploads/products/.
 */

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "products");
const MAX_BYTES = 5 * 1024 * 1024;

const EXT_BY_TYPE: Record<SniffedImageType, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/avif": ".avif",
};

// GC de huérfanas (F5): se escanea TODO lo que puede referenciar imágenes —
// products.images (jsonb), categories.imageUrl y homeLayouts (banner/widgets/
// sections, con URLs anidadas en props) — serializando a texto y extrayendo
// cada /uploads/products/<nombre>. Nada queda por fuera del diff.
const UPLOAD_URL_RE = /\/uploads\/products\/([^"'\s\\/]+)/g;

function collectReferenced(value: unknown, into: Set<string>) {
  if (typeof value === "string") {
    for (const m of value.matchAll(UPLOAD_URL_RE)) {
      into.add(decodeURIComponent(m[1]));
    }
  } else if (Array.isArray(value)) {
    for (const v of value) collectReferenced(v, into);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectReferenced(v, into);
  }
}

/** GET ?orphans=1 → archivos en UPLOAD_DIR que ninguna referencia usa. */
export async function GET(req: Request) {
  let actor: Actor;
  try {
    actor = await getActor();
  } catch (e) {
    if (!(e instanceof ForbiddenError)) throw e;
    return NextResponse.json({ ok: false, error: "Sesión requerida." }, { status: 401 });
  }
  void actor;

  const { searchParams } = new URL(req.url);
  if (searchParams.get("orphans") !== "1") {
    return NextResponse.json({ ok: false, error: "Parámetro no soportado." }, { status: 400 });
  }

  let files: string[] = [];
  try {
    files = await fs.readdir(UPLOAD_DIR);
  } catch (e) {
    // Carpeta inexistente (aún no hay uploads): no hay huérfanas que buscar.
    if ((e as NodeJS.ErrnoException)?.code !== "ENOENT") throw e;
  }

  const referenced = new Set<string>();
  const prodRows = await db.select({ images: products.images }).from(products);
  for (const r of prodRows) collectReferenced(r.images, referenced);
  const catRows = await db.select({ imageUrl: categories.imageUrl }).from(categories);
  for (const r of catRows) collectReferenced(r.imageUrl, referenced);
  const layoutRows = await db
    .select({ banner: homeLayouts.banner, widgets: homeLayouts.widgets, sections: homeLayouts.sections })
    .from(homeLayouts);
  for (const l of layoutRows) {
    collectReferenced(l.banner, referenced);
    collectReferenced(l.widgets, referenced);
    collectReferenced(l.sections, referenced);
  }

  const orphans = files
    .filter((f) => !f.startsWith(".") && !referenced.has(f))
    .map((f) => `/uploads/products/${f}`);
  return NextResponse.json({ orphans });
}

/** Rama JSON del POST: purge de huérfanas en lote (una sola auditoría por batch). */
async function purgeOrphans(req: Request): Promise<NextResponse> {
  let actor: Actor;
  try {
    actor = await getActor();
  } catch (e) {
    if (!(e instanceof ForbiddenError)) throw e;
    return NextResponse.json({ ok: false, error: "Sesión requerida." }, { status: 401 });
  }

  let body: { urls?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Se esperaba application/json." }, { status: 400 });
  }
  const rawUrls = Array.isArray(body.urls) ? body.urls : [];
  if (rawUrls.length === 0) {
    return NextResponse.json({ ok: false, error: "Sin URLs para eliminar." }, { status: 400 });
  }

  // Validación de TODAS las urls antes de borrar nada (fail-closed: si una es
  // inválida no se elimina ninguna). path.basename confina el path a UPLOAD_DIR.
  const targets: string[] = [];
  for (const raw of rawUrls) {
    const url = String(raw).trim();
    if (!url.startsWith("/uploads/products/")) {
      return NextResponse.json(
        { ok: false, error: `Ruta fuera de la carpeta de productos: ${url}` },
        { status: 400 },
      );
    }
    const base = path.basename(url);
    if (!base || base === "." || base === "..") {
      return NextResponse.json({ ok: false, error: "Ruta inválida." }, { status: 400 });
    }
    targets.push(base);
  }

  let deleted = 0;
  for (const base of targets) {
    try {
      await fs.unlink(path.join(UPLOAD_DIR, base));
      deleted += 1;
    } catch (e) {
      // ENOENT = ya no existe (idempotente, no cuenta); otros fallos re-lanzan.
      if ((e as NodeJS.ErrnoException)?.code !== "ENOENT") throw e;
    }
  }

  // Una sola auditoría por batch (mismo criterio best-effort del upload/delete).
  try {
    await recordAudit({
      actor,
      module: "uploads",
      entityType: "image",
      action: "purge_orphans",
      newValue: { requested: targets.length, deleted },
      summary: `${actor.name} purgó ${deleted} imagen(es) huérfana(s) de /uploads/products/.`,
    });
  } catch (e) {
    console.error("[uploads] auditoría de purge_orphans falló:", e);
  }
  return NextResponse.json({ ok: true, deleted });
}

export async function POST(req: Request) {
  // Rama JSON: purge de huérfanas. El resto sigue siendo multipart (upload).
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return purgeOrphans(req);
  }

  // getActor() es fail-closed (lanza ForbiddenError sin sesión válida); el 401
  // se responde acá para no filtrar como 500. Otros errores re-lanzan (no se
  // enmascaran como 401).
  let actor: Actor;
  try {
    actor = await getActor();
  } catch (e) {
    if (!(e instanceof ForbiddenError)) throw e;
    return NextResponse.json({ ok: false, error: "Sesión requerida." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Se esperaba multipart/form-data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Falta el campo 'file'." }, { status: 400 });
  }
  // Nota (límite conocido): el chequeo ocurre después de que formData() bufferiza
  // el body completo — el App Router no impone límite propio. En Vercel el límite
  // de plataforma (~4.5 MB) protege; self-hosted: acotar en el reverse proxy
  // (o guardar por Content-Length antes de parsear) — follow-up documentado.
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "La imagen supera 5 MB." }, { status: 413 });
  }

  // El Content-Type del cliente no es confiable: se sniffa el contenido real.
  const buffer = Buffer.from(await file.arrayBuffer());
  const type = sniffImageType(buffer);
  if (!type) {
    return NextResponse.json(
      { ok: false, error: "El archivo no es una imagen válida (JPG, PNG, WEBP, AVIF o GIF). Revisa el formato e inténtalo de nuevo." },
      { status: 400 },
    );
  }

  const ext = EXT_BY_TYPE[type];
  const name = `${randomUUID()}${ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), buffer);
  // Auditoría best-effort: el archivo ya está guardado; un fallo de DB de
  // auditoría no debe convertir el upload en 500 (dejaría un huérfano + retry).
  try {
    await recordAudit({
      actor,
      module: "uploads",
      entityType: "image",
      entityId: name,
      action: "create",
      summary: `${actor.name} subió la imagen ${name}.`,
    });
  } catch (e) {
    console.error("[uploads] auditoría de upload falló:", e);
  }

  return NextResponse.json({ ok: true, url: `/uploads/products/${name}` });
}

export async function DELETE(req: Request) {
  // Mismo trato que POST: sin sesión válida → 401 (getActor lanza ForbiddenError);
  // errores inesperados re-lanzan.
  let actor: Actor;
  try {
    actor = await getActor();
  } catch (e) {
    if (!(e instanceof ForbiddenError)) throw e;
    return NextResponse.json({ ok: false, error: "Sesión requerida." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const url = (searchParams.get("url") ?? "").trim();
  if (!url.startsWith("/uploads/products/")) {
    return NextResponse.json({ ok: false, error: "Ruta fuera de la carpeta de productos." }, { status: 400 });
  }

  // path.basename stripa separadores y confina el path a UPLOAD_DIR, pero puede
  // devolver "." / ".." (unlink sobre directorio fallaría con error impreciso)
  // → se rechazan explícitamente.
  const base = path.basename(url);
  if (!base || base === "." || base === "..") {
    return NextResponse.json({ ok: false, error: "Ruta inválida." }, { status: 400 });
  }
  const target = path.join(UPLOAD_DIR, base);

  try {
    await fs.unlink(target);
  } catch (e) {
    // Solo ENOENT es "no existe": otros fallos (EACCES, EISDIR...) re-lanzan
    // para no reportar un 404 engañoso de algo que sí existe.
    if ((e as NodeJS.ErrnoException)?.code !== "ENOENT") throw e;
    return NextResponse.json({ ok: false, error: "El archivo no existe." }, { status: 404 });
  }
  // Auditoría best-effort: el unlink ya exitoso no se enmascara como 404 si la
  // DB de auditoría falla (mismo criterio que session route).
  try {
    await recordAudit({
      actor,
      module: "uploads",
      entityType: "image",
      entityId: base,
      action: "delete_hard",
      summary: `${actor.name} eliminó la imagen ${base}.`,
    });
  } catch (e) {
    console.error("[uploads] auditoría de delete falló:", e);
  }
  return NextResponse.json({ ok: true });
}
