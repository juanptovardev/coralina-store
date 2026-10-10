import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getActor } from "@/lib/session";
import { recordAudit } from "@/lib/audit";

/**
 * Sistema de gestión de imágenes del servidor.
 * POST   (multipart/form-data, campo "file") → guarda en public/uploads/products/ → { ok, url }
 * DELETE (?url=/uploads/products/<nombre>)   → elimina el archivo del servidor → { ok: true }
 *
 * Seguridad:
 *  - Solo image/* (jpeg, png, webp, avif, gif).
 *  - Máx 5 MB.
 *  - Nombre siempre aleatorio (uuid) → nunca se confía en el nombre del cliente.
 *  - DELETE solo acepta rutas dentro de public/uploads/products/.
 */

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "products");
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/avif", ".avif"],
  ["image/gif", ".gif"],
]);

export async function POST(req: Request) {
  const actor = await getActor();
  if (actor.role !== "admin" && actor.role !== "asesor") {
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
  const ext = ALLOWED.get(file.type);
  if (!ext) {
    return NextResponse.json(
      { ok: false, error: `Tipo no permitido (${file.type || "desconocido"}). Usa JPG, PNG, WEBP, AVIF o GIF.` },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "La imagen supera 5 MB." }, { status: 413 });
  }

  const name = `${randomUUID()}${ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOAD_DIR, name), buffer);
  await recordAudit({
    actor,
    module: "uploads",
    entityType: "image",
    entityId: name,
    action: "create",
    summary: `${actor.name} subió la imagen ${name}.`,
  });

  return NextResponse.json({ ok: true, url: `/uploads/products/${name}` });
}

export async function DELETE(req: Request) {
  const actor = await getActor();
  if (actor.role !== "admin" && actor.role !== "asesor") {
    return NextResponse.json({ ok: false, error: "Sesión requerida." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const url = (searchParams.get("url") ?? "").trim();
  if (!url.startsWith("/uploads/products/")) {
    return NextResponse.json({ ok: false, error: "Ruta fuera de la carpeta de productos." }, { status: 400 });
  }

  const base = path.basename(url);
  const target = path.join(UPLOAD_DIR, base);
  if (!target.startsWith(UPLOAD_DIR)) {
    return NextResponse.json({ ok: false, error: "Ruta inválida." }, { status: 400 });
  }

  try {
    await fs.unlink(target);
    await recordAudit({
      actor,
      module: "uploads",
      entityType: "image",
      entityId: base,
      action: "delete_hard",
      summary: `${actor.name} eliminó la imagen ${base}.`,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "El archivo no existe." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
