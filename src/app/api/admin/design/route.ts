import { NextResponse } from "next/server";
import { db } from "@/db";
import { homeLayouts, themeTokens } from "@/db/schema";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { recordAudit } from "@/lib/audit";
import { getActor } from "@/lib/session";
import { getTokens } from "@/lib/queries";
import { BANNER_RATIO_MAX, BANNER_RATIO_MIN, DEFAULT_TOKENS } from "@/lib/constants";
import { publishChecklist, normalizeLayout, denormalizeWidgets, denormalizeSections, applyWidgetsToSlide } from "@/lib/design";
import { ensureSeeded } from "@/lib/seed";

export async function GET() {
  await ensureSeeded();
  const layouts = await db.select().from(homeLayouts).orderBy(asc(homeLayouts.id));
  const tokens = await getTokens();
  return NextResponse.json({
    layouts: layouts.map((l) => {
      const normalized = normalizeLayout(l);
      return { ...normalized, checklist: publishChecklist(normalized) };
    }),
    tokens,
    defaults: DEFAULT_TOKENS,
  });
}

export async function POST(req: Request) {
  const actor = await getActor();
  const body = (await req.json().catch(() => null)) as Record<string, any> | null;
  if (!body) return NextResponse.json({ ok: false, error: "Body inválido." }, { status: 400 });
  const action = body.action as string;

  if (action === "save_layout") {
    const id = Number(body.id);
    const [layout] = await db.select().from(homeLayouts).where(eq(homeLayouts.id, id)).limit(1);
    if (!layout) return NextResponse.json({ ok: false, error: "Layout no encontrado." }, { status: 404 });

    const banner = { ...(body.banner ?? {}) } as any;
    const r = Number(banner.aspectRatio ?? banner.aspect ?? NaN);
    banner.aspectRatio = Number.isFinite(r) ? Math.min(BANNER_RATIO_MAX, Math.max(BANNER_RATIO_MIN, r)) : 2.6;
    const o = Number(banner.overlayOpacity ?? banner.overlay ?? NaN);
    banner.overlayOpacity = Number.isFinite(o) ? Math.min(0.4, Math.max(0, o)) : 0.28;
    banner.aspect = banner.aspectRatio;
    banner.overlay = banner.overlayOpacity;
    if (banner.imageUrl && Array.isArray(banner.slides) && banner.slides[0]) banner.slides[0].image = banner.imageUrl;
    const finalBanner = Array.isArray(body.widgets) ? applyWidgetsToSlide(banner, body.widgets) : banner;

    await db
      .update(homeLayouts)
      .set({
        name: String(body.name ?? layout.name),
        banner: finalBanner,
        widgets: Array.isArray(body.widgets) ? denormalizeWidgets(body.widgets) : (layout.widgets as any),
        sections: Array.isArray(body.sections) ? denormalizeSections(body.sections) : (layout.sections as any),
        updatedAt: new Date(),
      })
      .where(eq(homeLayouts.id, id));

    await recordAudit({
      actor,
      module: "diseno",
      entityType: "home_layout",
      entityId: id,
      action: "update",
      summary: `${actor.name} editó el layout «${layout.name}».`,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "publish") {
    const id = Number(body.id);
    const [layout] = await db.select().from(homeLayouts).where(eq(homeLayouts.id, id)).limit(1);
    if (!layout) return NextResponse.json({ ok: false, error: "Layout no encontrado." }, { status: 404 });

    const checklist = publishChecklist(normalizeLayout(layout));
    const failed = checklist.filter((c) => !c.ok);
    if (failed.length > 0) {
      return NextResponse.json(
        { ok: false, error: `No se puede publicar: ${failed.map((f) => f.label).join(" · ")}`, checklist },
        { status: 409 },
      );
    }

    await db.transaction(async (tx) => {
      await tx
        .update(homeLayouts)
        .set({ status: "archived" })
        .where(and(eq(homeLayouts.status, "active"), ne(homeLayouts.id, id)));
      await tx
        .update(homeLayouts)
        .set({
          status: "active",
          version: sql`${homeLayouts.version} + 1`,
          publishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(homeLayouts.id, id));
    });

    await recordAudit({
      actor,
      module: "diseno",
      entityType: "home_layout",
      entityId: id,
      action: "publish",
      newValue: { version: layout.version + 1 },
      summary: `${actor.name} publicó «${layout.name}» como home activo (versión ${layout.version + 1}).`,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "save_tokens") {
    const tokens = body.tokens as Record<string, string>;
    for (const [key, value] of Object.entries(tokens)) {
      if (!/^#[0-9a-fA-F]{6}$/.test(value)) continue;
      await db
        .insert(themeTokens)
        .values({ key, value })
        .onConflictDoUpdate({ target: themeTokens.key, set: { value } });
    }
    await recordAudit({
      actor,
      module: "diseno",
      entityType: "theme_tokens",
      action: "update",
      newValue: tokens,
      summary: `${actor.name} actualizó los colores de marca.`,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "reset_tokens") {
    for (const [key, value] of Object.entries(DEFAULT_TOKENS)) {
      await db
        .insert(themeTokens)
        .values({ key, value })
        .onConflictDoUpdate({ target: themeTokens.key, set: { value } });
    }
    await recordAudit({
      actor,
      module: "diseno",
      entityType: "theme_tokens",
      action: "update",
      summary: `${actor.name} restableció los colores originales de la marca.`,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: `Acción desconocida: ${action}` }, { status: 400 });
}
