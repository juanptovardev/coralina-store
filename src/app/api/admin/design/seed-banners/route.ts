import { Client } from "pg";
import { getSessionRole } from "@/lib/session-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const COPY = {
  kicker: "Hecho a mano en Colombia",
  title: "El mar te queda bien",
  subtitle: "Trajes de bano de corte limpio, colgados a mano en talleres pequenos. Envio gratis desde $250.000.",
  ctaLabel: "Comprar ahora",
  ctaLink: "/coleccion",
};

const ROWS = [1, 2, 3, 4, 5].map((n) => ({
  name: `Banner ${n}`,
  status: n === 3 ? "active" : "draft",
  banner: {
    imageUrl: `/brand/banner-${n}-desktop.webp`,
    image: `/brand/banner-${n}-desktop.webp`,
    mobileImageUrl: `/brand/banner-${n}-mobile.webp`,
    aspectRatio: 2.6,
    aspect: 2.6,
    overlayOpacity: 0.28,
    overlay: 0.28,
    fit: n === 1 || n === 2 ? "contain" : "cover",
    background: "#efe9df",
    focusMobile: n === 1 || n === 2 ? 65 : 50,
    slides: [
      {
        image: `/brand/banner-${n}-desktop.webp`,
        mobileImage: `/brand/banner-${n}-mobile.webp`,
        kicker: COPY.kicker,
        title: COPY.title,
        subtitle: COPY.subtitle,
        ctaLabel: COPY.ctaLabel,
        ctaLink: COPY.ctaLink,
      },
    ],
  },
}));

export async function POST() {
  const role = await getSessionRole();
  if (role !== "admin") {
    return Response.json({ ok: false, error: "Solo un administrador puede sembrar los banners." }, { status: 403 });
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    return Response.json({ ok: false, error: "Falta DATABASE_URL." }, { status: 500 });
  }
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    await client.query("delete from home_layouts");
    for (const row of ROWS) {
      await client.query(
        "insert into home_layouts (name, mode, status, banner, widgets, sections, version) values ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7)",
        [row.name, "preset_left", row.status, JSON.stringify(row.banner), "[]", "[]", 1],
      );
    }
    const res = await client.query("select id, name, status from home_layouts order by id");
    return Response.json({ ok: true, count: res.rows.length, rows: res.rows });
  } catch (error) {
    return Response.json({ ok: false, error: String(error) }, { status: 500 });
  } finally {
    await client.end().catch(() => undefined);
  }
}
