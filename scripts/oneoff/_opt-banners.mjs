import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const SRC = "src/assets";
const OUT = "public/brand";
fs.mkdirSync(OUT, { recursive: true });

const rows = [];
for (let i = 1; i <= 5; i++) {
  const input = path.join(SRC, `banner_${i}.jpg`);
  const meta = await sharp(input).metadata();
  for (const [suffix, width] of [["desktop", 2200], ["mobile", 1200]]) {
    const target = path.join(OUT, `banner-${i}-${suffix}.webp`);
    await sharp(input)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 78, effort: 5 })
      .toFile(target);
    rows.push([`banner-${i}-${suffix}.webp`, meta.width, meta.height, fs.statSync(input).size, fs.statSync(target).size]);
  }
}

console.log("archivo | origen_px | bytes_jpg | bytes_webp | ahorro");
for (const [name, w, h, before, after] of rows) {
  const pct = (100 - (after / before) * 100).toFixed(1);
  console.log(`${name} | ${w}x${h} | ${before} | ${after} | ${pct}%`);
}
