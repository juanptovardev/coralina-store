import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Sirve imágenes subidas a public/uploads/products/ en runtime.
 * `next start` no sirve archivos añadidos a public/ después del build
 * (el manifiesto estático se congela al compilar), así que esta ruta los
 * lee del disco en cada petición. next.config reescribe /uploads/products/:name aquí.
 */

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "products");

const TYPES = new Map([
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".avif", "image/avif"],
  [".gif", "image/gif"],
]);

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const base = path.basename(name);
  const target = path.join(UPLOAD_DIR, base);
  if (!target.startsWith(UPLOAD_DIR)) return new NextResponse("Not found", { status: 404 });

  const type = TYPES.get(path.extname(base).toLowerCase());
  if (!type) return new NextResponse("Not found", { status: 404 });

  try {
    const data = await fs.readFile(target);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "content-type": type,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
