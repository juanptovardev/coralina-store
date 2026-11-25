import fs from "node:fs";
import pg from "pg";

const env = fs.readFileSync(".env.local", "utf8");
const line = env.split(/\r?\n/).find((l) => /^\s*DATABASE_URL\s*=/.test(l)) || "";
const url = line.replace(/^\s*DATABASE_URL\s*=\s*/, "").trim().replace(/^"|"$/g, "");

const b = (nAdjusted) => ({
  imageUrl: `/brand/banner-${nAdjusted}-desktop.webp`,
  image: `/brand/banner-${nAdjusted}-desktop.webp`,
  mobileImageUrl: `/brand/banner-${nAdjusted}-mobile.webp`,
  aspectRatio: 2.6,
  aspect: 2.6,
  overlayOpacity: 0.28,
  overlay: 0.28,
  fit: nAdjusted <= 2 ? "contain" : "cover",
  background: "#efe9df",
  focusMobile: nAdjusted <= 2 ? "65% center" : "50% center",
  slides: [
    {
      image: `/brand/banner-${nAdjusted}-mobile.webp`,
      kicker: "Hecho a mano en Colombia",
      title: "El mar te queda bien",
      subtitle: "Swimwear de corte limpio, cosido a mano.",
      ctaLabel: "Comprar ahora",
      ctaLink: "/coleccion",
    },
  ],
});

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query("delete from home_layouts");
for (let i = 1; i <= 5; i++) {
  const status = i === 3 ? "active" : "draft";
  await client.query(
    "insert into home_layouts (name, mode, status, banner, widgets, sections, version, published_at, updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,now())",
    [`Banner ${i}`, "preset_left", status, JSON.stringify(b(i)), JSON.stringify([]), JSON.stringify([]), 1, status === "active" ? new Date() : null],
  );
  console.log(`ok banner ${i} ${status}`);
}
const r = await client.query("select id, name, status from home_layouts order by id");
console.log(JSON.stringify(r.rows));
await client.end();
