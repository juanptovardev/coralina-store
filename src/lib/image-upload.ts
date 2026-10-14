import { compressImage, type CompressResult } from "./image-compress";

/** Límite del server (uploads re-valida 5 MB): dejamos margen. */
const FINAL_LIMIT_BYTES = 4.5 * 1024 * 1024;

export type UploadImageResult =
  | { ok: true; url: string; info?: CompressResult }
  | { ok: false; error: string };

/** Comprime (si aplica) y sube a /api/admin/uploads. Nunca lanza. */
export async function uploadProductImage(
  file: File,
  hooks?: { onPhase?: (phase: "compressing" | "uploading") => void },
): Promise<UploadImageResult> {
  hooks?.onPhase?.("compressing");
  let compressed: CompressResult;
  try {
    compressed = await compressImage(file);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo procesar la imagen." };
  }

  if (compressed.file.size > FINAL_LIMIT_BYTES) {
    return { ok: false, error: "La imagen sigue pesando más de 4,5 MB incluso comprimida." };
  }

  hooks?.onPhase?.("uploading");
  const fd = new FormData();
  fd.append("file", compressed.file);
  let res: Response;
  try {
    res = await fetch("/api/admin/uploads", { method: "POST", body: fd });
  } catch {
    return { ok: false, error: "Error de red al subir la imagen." };
  }
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
  if (json.ok && json.url) {
    return { ok: true, url: json.url, info: compressed };
  }
  return { ok: false, error: String(json.error ?? `No se pudo subir la imagen (HTTP ${res.status}).`) };
}
