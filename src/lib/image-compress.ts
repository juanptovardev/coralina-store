/**
 * Autocompresión de imágenes en el cliente (antes de subirlas al server).
 * El server (uploads/route.ts) re-valida magic bytes y 5 MB; esto solo
 * ahorra ancho de banda y evita rechazos por tamaño.
 */

export type CompressResult = {
  file: File;
  compressed: boolean;
  originalBytes: number;
  finalBytes: number;
  width: number;
  height: number;
  note?: string;
};

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|avif|gif|bmp|heic|heif)$/i;

function extForMime(mime: string): string {
  if (mime === "image/webp") return ".webp";
  if (mime === "image/png") return ".png";
  if (mime === "image/avif") return ".avif";
  return ".jpg";
}

/** Nombre con la extensión correcta según el MIME del blob re-encodeado. */
function nombreConExtCorrecta(name: string, mime: string): string {
  const base = name.replace(/\.[^.]+$/, "") || "imagen";
  return `${base}${extForMime(mime)}`;
}

function drawScaled(source: CanvasImageSource, sw: number, sh: number, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no soporta el procesamiento de imágenes.");
  ctx.drawImage(source, 0, 0, w, h);
  return canvas;
}

/** Muestreo con stride (~2k puntos): ¿el canvas tiene transparencia? */
function hasAlphaSample(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  try {
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const step = Math.max(4, Math.floor(data.length / 4 / 2048) * 4);
    for (let i = 3; i < data.length; i += step) {
      if (data[i] < 255) return true;
    }
  } catch {
    return false;
  }
  return false;
}

/** toBlob envuelto en promesa. WebP null → fallback JPEG 0.85. */
function encodeOnce(
  canvas: HTMLCanvasElement,
  type: "image/webp" | "image/jpeg",
  quality: number,
): Promise<{ blob: Blob; type: string } | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve({ blob, type });
        return;
      }
      if (type === "image/webp") {
        canvas.toBlob((jb) => resolve(jb ? { blob: jb, type: "image/jpeg" } : null), "image/jpeg", 0.85);
        return;
      }
      resolve(null);
    }, type, quality);
  });
}

export async function compressImage(
  file: File,
  opts?: { maxDimension?: number; maxBytes?: number },
): Promise<CompressResult> {
  const maxDimension = opts?.maxDimension ?? 1600;
  const maxBytes = opts?.maxBytes ?? 400 * 1024;
  const originalBytes = file.size;

  if (!file.type.startsWith("image/") && !IMAGE_EXT_RE.test(file.name)) {
    throw new Error("El archivo no es una imagen.");
  }
  // GIF: re-encodearlo mataría la animación → se sube tal cual.
  if (file.type === "image/gif" || /\.gif$/i.test(file.name)) {
    return {
      file,
      compressed: false,
      originalBytes,
      finalBytes: file.size,
      width: 0,
      height: 0,
      note: "GIF: se sube sin comprimir",
    };
  }
  // Chicas: no vale el trabajo de re-encodear.
  if (file.size <= 150 * 1024) {
    return { file, compressed: false, originalBytes, finalBytes: file.size, width: 0, height: 0 };
  }

  let bitmap: ImageBitmap | null = null;
  let objectUrl: string | null = null;
  let note: string | undefined;

  try {
    let source: CanvasImageSource;
    let sw: number;
    let sh: number;
    try {
      // from-image corrige la orientación EXIF al decodificar (al re-encodear
      // los metadatos se pierden: la rotación debe aplicarse aquí).
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      try {
        const raw = await createImageBitmap(file, { imageOrientation: "none" });
        if (raw.width !== bitmap.width || raw.height !== bitmap.height) {
          note = "Orientación corregida";
        }
        raw.close();
      } catch {
        /* el navegador no permite el decode de comparación: seguimos sin nota */
      }
      source = bitmap;
      sw = bitmap.width;
      sh = bitmap.height;
    } catch {
      // Fallback sin corrección EXIF.
      objectUrl = URL.createObjectURL(file);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("No se pudo leer la imagen."));
        el.src = objectUrl as string;
      });
      source = img;
      sw = img.naturalWidth;
      sh = img.naturalHeight;
      note = "Decodificada sin corrección de orientación EXIF.";
    }
    if (!sw || !sh) throw new Error("La imagen está vacía o dañada.");

    const scale = Math.min(1, maxDimension / Math.max(sw, sh));
    let cw = Math.max(1, Math.round(sw * scale));
    let ch = Math.max(1, Math.round(sh * scale));
    let canvas = drawScaled(source, sw, sh, cw, ch);

    // PNG con transparencia → WebP (conserva alpha); todo lo demás → JPEG.
    const useWebP = file.type === "image/png" && hasAlphaSample(canvas);

    let best: { blob: Blob; type: string; width: number; height: number } | null = null;
    let hitTarget = false;

    // Bucle de calidad: 0.82 → 0.7 → 0.6 → 0.5; si aún excede, baja 15% las
    // dimensiones y repite (máx 3 iteraciones).
    for (let iteration = 0; iteration < 3 && !hitTarget; iteration++) {
      const qualities = [0.82, 0.7, 0.6, 0.5];
      for (const q of qualities) {
        const encoded = await encodeOnce(canvas, useWebP ? "image/webp" : "image/jpeg", q);
        if (!encoded) continue;
        if (!best || encoded.blob.size < best.blob.size) {
          best = { blob: encoded.blob, type: encoded.type, width: cw, height: ch };
        }
        if (encoded.blob.size <= maxBytes) {
          hitTarget = true;
          break;
        }
      }
      if (!hitTarget && iteration < 2) {
        cw = Math.max(1, Math.round(cw * 0.85));
        ch = Math.max(1, Math.round(ch * 0.85));
        canvas = drawScaled(source, sw, sh, cw, ch);
      }
    }

    if (!best) throw new Error("No se pudo procesar la imagen.");

    const out = new File([best.blob], nombreConExtCorrecta(file.name, best.type), { type: best.type });
    let finalNote = note;
    if (out.size > maxBytes) {
      finalNote = finalNote
        ? `${finalNote} · No se alcanzó el objetivo, se usó el mejor resultado`
        : "No se alcanzó el objetivo, se usó el mejor resultado";
    }
    return {
      file: out,
      compressed: true,
      originalBytes,
      finalBytes: out.size,
      width: best.width,
      height: best.height,
      note: finalNote,
    };
  } finally {
    bitmap?.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
