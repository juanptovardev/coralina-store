import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getActor, ForbiddenError, type Actor } from "@/lib/session";
import { recordAudit } from "@/lib/audit";
import { sniffImageType, type SniffedImageType } from "@/lib/image-sniff";

/**
 * Sistema de gestión de imágenes del servidor.
 * POST   (multipart/form-data, campo "file") → guarda en public/uploads/products/ → { ok, url }
 * DELETE (?url=/uploads/products/<nombre>)   → elimina el archivo del servidor → { ok: true }
 *
 * Seguridad:
 *  - Se detecta el tipo real por magic bytes (no se confía en el Content-Type del cliente).
 *  - Máx 5 MB.
 *  - Nombre siempre aleatorio (uuid) → nunca se confía en el nombre del cliente.
 *  - DELETE solo acepta rutas dentro de public/uploads/products/.
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

export async function POST(req: Request) {
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
