// Detección del tipo real de una imagen por magic bytes. Es la única defensa
// del upload contra un Content-Type falsificado por el cliente (el header
// declarado nunca se confía). null = formato no reconocido.

export type SniffedImageType =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp"
  | "image/avif";

export function sniffImageType(buf: Buffer): SniffedImageType | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  // PNG: firma completa de 8 bytes (89 50 4E 47 0D 0A 1A 0A)
  if (buf.toString("latin1", 0, 8) === "\x89PNG\r\n\x1a\n") return "image/png";
  // GIF: el spec exige la versión completa ("GIF87a" | "GIF89a"), no solo "GIF"
  // — gratis porque el buffer ya se exige ≥12 bytes.
  const gifVersion = buf.toString("latin1", 0, 6);
  if (gifVersion === "GIF87a" || gifVersion === "GIF89a") return "image/gif";
  // WEBP: "RIFF"...."WEBP"
  if (buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") {
    return "image/webp";
  }
  // AVIF: ISO-BMFF (no RIFF). El box ftyp lleva major_brand en offset 8 y
  // compatible_brands desde el 16: muxers tipo libheif/HEIF emiten
  // major_brand="mif1" con "avif" solo en la lista de compatibles → se escanea
  // todo el box (acotado por su tamaño declarado; 0 significa "hasta EOF").
  if (buf.toString("latin1", 4, 8) === "ftyp") {
    const declared = buf.readUInt32BE(0);
    const boxEnd = Math.min(buf.length, declared === 0 ? buf.length : declared);
    for (let o = 8; o + 4 <= boxEnd; o += 4) {
      const brand = buf.toString("latin1", o, o + 4);
      if (brand === "avif" || brand === "avis") return "image/avif";
    }
  }
  return null;
}
