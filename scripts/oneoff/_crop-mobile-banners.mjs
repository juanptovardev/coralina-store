import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const SRC = "src/assets";
const OUT = "public/brand";
const TARGET = [4, 5];
const POS = { 1: 0.65, 2: 0.65, 3: 0.5, 4: 0.5, 5: 0.5 };

for (let i = 1; i <= 5; i++) {
  const input = path.join(SRC, `banner_${i}.jpg`);
  const { width, height } = await sharp(input).metadata();
  const cw = Math.min(width, Math.round((height * TARGET[0]) / TARGET[1]));
  const left = Math.max(0, Math.min(width - cw, Math.round((width - cw) * POS[i])));
  const buf = await sharp(input).extract({ left, top: 0, width: cw, height }).toBuffer();
  const target = path.join(OUT, `banner-${i}-mobile.webp`);
  await sharp(buf).resize({ width: 1000 }).webp({ quality: 78, effort: 5 }).toFile(target);
  console.log(`banner-${i}-mobile.webp ${cw}x${height} left=${left} ${fs.statSync(target).size}b`);
}
