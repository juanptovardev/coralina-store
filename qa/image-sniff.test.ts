// Test unitario del sniffing de imágenes por magic bytes.
// Correr: bun qa/image-sniff.test.ts
import { sniffImageType } from "../src/lib/image-sniff";

export {};

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log("  ✓ " + name);
  } else {
    fail++;
    console.log("  ✗ " + name);
  }
}

const fill = (head: (number | string)[], total = 12) => {
  const bytes = head.flatMap((h) => (typeof h === "number" ? [h] : [...Buffer.from(h, "latin1")]));
  return Buffer.from([...bytes, ...Array(Math.max(0, total - bytes.length)).fill(0)]);
};

console.log("image-sniff (magic bytes)");

ok("JPEG (FF D8 FF) → image/jpeg", sniffImageType(fill([0xff, 0xd8, 0xff, 0xe0])) === "image/jpeg");
ok(
  "PNG firma completa (89 50 4E 47 0D 0A 1A 0A) → image/png",
  sniffImageType(fill([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) === "image/png",
);
ok("PNG sin la cola \\r\\n\\x1a\\n → null", sniffImageType(fill([0x89, 0x50, 0x4e, 0x47])) === null);
ok("GIF89a → image/gif", sniffImageType(Buffer.from("GIF89a" + "\x00".repeat(6), "latin1")) === "image/gif");
ok("GIF87a → image/gif", sniffImageType(Buffer.from("GIF87a" + "\x00".repeat(6), "latin1")) === "image/gif");
ok("prefijo GIF con versión inválida ('GIFxx') → null", sniffImageType(Buffer.from("GIFxxxx" + "\x00".repeat(5), "latin1")) === null);
ok(
  "WEBP ('RIFF'....'WEBP') → image/webp",
  sniffImageType(Buffer.from("RIFF\x00\x00\x00\x00WEBP", "latin1")) === "image/webp",
);
ok("AVIF (ftyp avif) → image/avif", sniffImageType(fill([0, 0, 0, 0x1c, "ftyp", "avif"])) === "image/avif");
ok("AVIF sequence (ftyp avis) → image/avif", sniffImageType(fill([0, 0, 0, 0x20, "ftyp", "avis"])) === "image/avif");
// libheif/HEIF: major_brand "mif1" con "avif" solo en compatible_brands (offset 16+).
ok(
  "AVIF con major 'mif1' y 'avif' en compatibles → image/avif",
  sniffImageType(fill([0, 0, 0, 0x14, "ftyp", "mif1", "\0\0\0\0", "avif"], 20)) === "image/avif",
);
ok("ftyp 'mif1' sin 'avif' en ningún brand → null", sniffImageType(fill([0, 0, 0, 0x14, "ftyp", "mif1", 0, 0, 0, 0], 20)) === null);
ok("ftyp truncado (<16 bytes, sin compatibles) → null", sniffImageType(fill([0, 0, 0, 0x14, "ftyp", "mif1"])) === null);
ok("ftyp con brand ajeno (isom) → null", sniffImageType(fill([0, 0, 0, 0x18, "ftyp", "isom"])) === null);
ok(
  "RIFF sin 'WEBP' en el offset 8 (ej. WAVE) → null",
  sniffImageType(Buffer.from("RIFF\x00\x00\x00\x00WAVE", "latin1")) === null,
);
ok("buffer < 12 bytes → null", sniffImageType(Buffer.from([0xff, 0xd8, 0xff])) === null);
ok("buffer vacío → null", sniffImageType(Buffer.alloc(0)) === null);
ok("basura aleatoria → null", sniffImageType(Buffer.from("texto cualquiera sin formato", "latin1")) === null);
ok("GIF truncado a 11 bytes → null", sniffImageType(Buffer.from("GIF89a" + "\x00".repeat(5), "latin1")) === null);

console.log(`\nPASS ${pass} · FAIL ${fail}`);
process.exitCode = fail > 0 ? 1 : 0;
