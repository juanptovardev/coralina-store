import { cache } from "react";
import Link from "next/link";
import { db } from "@/db";
import {
  categories,
  inventoryLevels,
  products,
  promotions,
  sizeCharts,
  themeTokens,
  variants,
} from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import { StoreProvider, Header, type CatalogProduct, type Theme } from "./shop";
import { LogoMark } from "./svgs";
import { formatCOP, FREE_SHIPPING_CENTS } from "@/lib/constants";
import type { PromoLike } from "@/lib/domain";

const ICON_BY_SLUG: Record<string, string> = {
  bikinis: "wave",
  enterizos: "shell",
  salidas: "star",
  panty: "wave",
  tops: "shell",
  traje: "star",
  "conjunto-arena-verano": "wave",
};

export const getCatalog = cache(async () => {
  const [prods, vars, cats, themeRows, promoRows, invRows, chartRows] = await Promise.all([
    db.select().from(products).where(eq(products.status, "published")).orderBy(asc(products.createdAt)),
    db
      .select()
      .from(variants)
      .orderBy(
        sql`case ${variants.size} when 'XS' then 1 when 'S' then 2 when 'M' then 3 when 'L' then 4 else 5 end`,
      ),
    db.select().from(categories).orderBy(asc(categories.createdAt)),
    db.select().from(themeTokens),
    db
      .select()
      .from(promotions)
      .where(eq(promotions.enabled, true))
      .orderBy(asc(promotions.priority), asc(promotions.id)),
    db.select().from(inventoryLevels),
    db.select().from(sizeCharts),
  ]);

  const stockOf = new Map<number, number>(invRows.map((r) => [r.variantId, r.stocked]));
  const catSlugById = new Map<number, string>(cats.map((c) => [c.id, c.slug]));
  const catById = new Map<number, { name: string; slug: string }>(
    cats.map((c) => [c.id, { name: c.name, slug: c.slug }]),
  );
  const token = (key: string, fallback: string) =>
    themeRows.find((t) => t.key === key)?.value ?? fallback;

  const catalog: CatalogProduct[] = prods.map((p) => {
    const vs = vars.filter((v) => v.productId === p.id && v.active !== false);
    const cat = catById.get(p.categoryId ?? -1);
    const images = Array.isArray(p.images) ? p.images : [];
    const tags = Array.isArray(p.tags) ? p.tags : [];
    return {
      id: String(p.id),
      name: p.title,
      slug: p.handle,
      price: p.priceCents,
      compareAt: p.compareAtCents == null ? null : p.compareAtCents,
      image: images[0] ?? "",
      featured: tags.includes("featured"),
      description: p.description,
      categoryName: cat?.name ?? "",
      categorySlug: cat?.slug ?? "",
      stock: vs.reduce((s, v) => s + (stockOf.get(v.id) ?? 0), 0),
      variants: vs.map((v) => ({
        id: String(v.id),
        size: v.size,
        stock: stockOf.get(v.id) ?? 0,
        sku: v.sku,
      })),
    };
  });

  const theme: Theme = {
    primary: token("color/primary", "#C9643C"),
    accent: token("color/accent", "#E8A44A"),
    surfaceWarm: token("color/surface-warm", "#F5DFA0"),
    surfaceBase: token("color/surface-base", "#FAF3E4"),
  };

  const publishedProductIds = new Set(prods.map((p) => p.id));
  const promoLikes: PromoLike[] = promoRows.flatMap((p): PromoLike[] => {
    const slugOf = (id: number) => catSlugById.get(id) ?? "";
    const cids = (Array.isArray(p.categoryIds) ? p.categoryIds : []).filter((id) =>
      catSlugById.has(id),
    );
    // server matches raw ids (promo.ts); published-only is safe because
    // cart lines can't reference unpublished products
    const pids = (Array.isArray(p.productIds) ? p.productIds : []).filter((id) =>
      publishedProductIds.has(id),
    );
    const base = {
      id: String(p.id),
      name: p.name,
      enabled: p.enabled,
      priority: p.priority,
      code: p.code || null,
      startAt: p.startsAt.toISOString(),
      endAt: p.endsAt ? p.endsAt.toISOString() : "2099-12-31T00:00:00.000Z",
    };
    switch (p.type) {
      case "category_percent":
      case "category_amount": {
        if (!cids.length) return [];
        const benefit =
          p.type === "category_amount"
            ? { kind: "fixed" as const, value: p.amountCents }
            : { kind: "pct" as const, value: p.percent };
        if (cids.length > 1) {
          // v4 combo (varias categorías): se emite type "combo" para el display
          // (PDP/sección combo) pero con elegibilidad OR sobre la unión +
          // minQty total, espejando promo.ts (no exige una de cada categoría).
          return [
            {
              ...base,
              type: "combo",
              scope: {
                requires: cids.map((id) => ({ category: slugOf(id), min: 1 })),
                minQty: p.minQty,
                union: true,
              },
              benefit,
            },
          ];
        }
        return [
          {
            ...base,
            type: "category",
            scope: { categories: cids.map((id) => slugOf(id)), minQty: p.minQty },
            benefit,
          },
        ];
      }
      case "sku_percent": {
        const benefit = { kind: "pct" as const, value: p.percent };
        if (pids.length) {
          return [{ ...base, type: "sku", scope: { productId: String(pids[0]), minQty: p.minQty }, benefit }];
        }
        if (!cids.length) return [];
        if (cids.length > 1) {
          return [
            {
              ...base,
              type: "combo",
              scope: {
                requires: cids.map((id) => ({ category: slugOf(id), min: 1 })),
                minQty: p.minQty,
                union: true,
              },
              benefit,
            },
          ];
        }
        return [
          {
            ...base,
            type: "category",
            scope: { categories: cids.map((id) => slugOf(id)), minQty: p.minQty },
            benefit,
          },
        ];
      }
      case "combo": {
        if (!cids.length) return [];
        // Combo nativo v5 (N piezas a precio fijo): se propaga el contrato
        // completo (minQty + comboPrice) para que domain.ts replique la
        // matemática de bundles de promo.ts.
        return [
          {
            ...base,
            type: "combo",
            scope: {
              requires: cids.map((id) => ({ category: slugOf(id), min: 1 })),
              minQty: p.minQty,
              comboPrice: (p.comboPriceCents ?? 0),
            },
            benefit: { kind: "pct" as const, value: p.percent },
          },
        ];
      }
      case "cart_amount":
      default:
        return [
          {
            ...base,
            type: "qty",
            scope: { minQty: p.minQty, minAmount: p.minSubtotalCents },
            benefit:
              p.amountCents > 0
                ? { kind: "fixed" as const, value: p.amountCents }
                : { kind: "pct" as const, value: p.percent },
          },
        ];
    }
  });

  const categoriesOut = cats.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    icon: ICON_BY_SLUG[c.slug] ?? "wave",
  }));

  return { catalog, categories: categoriesOut, theme, promos: promoLikes, charts: chartRows };
});

export function ThemeVars({ theme }: { theme: Theme }) {
  return (
    <style>{`
      :root {
        --ct-primary: ${theme.primary};
        --ct-accent: ${theme.accent};
        --ct-surface-warm: ${theme.surfaceWarm};
        --ct-surface-base: ${theme.surfaceBase};
      }
      body { background: ${theme.surfaceBase}; }
    `}</style>
  );
}

function Footer({ categories }: { categories: { name: string; slug: string }[] }) {
  return (
    <footer className="relative mt-0 bg-ink text-linen">
      <div className="pointer-events-none absolute inset-x-0 bottom-full h-12 overflow-hidden md:h-16">
        <svg
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
          aria-hidden
          className="wave-slow absolute inset-0 h-full w-[200%] text-ink"
        >
          <path d="M0 36c60 12 120 12 180 0s120-12 180 0 120 12 180 0 120-12 180 0 120 12 180 0 120-12 180 0 120 12 180 0 120-12 180 0v44H0Z" fill="currentColor" opacity="0.45" />
        </svg>
        <svg
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
          aria-hidden
          className="wave-fast absolute inset-0 h-full w-[200%] text-ink"
        >
          <path d="M0 44c40-16 80-16 120 0s80 16 120 0 80-16 120 0 80 16 120 0 80-16 120 0 80 16 120 0 80-16 120 0 80 16 120 0 80-16 120 0 80 16 120 0 80-16 120 0 80 16 120 0v36H0Z" fill="currentColor" />
        </svg>
      </div>
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-10 md:grid-cols-4 md:px-8">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-9 w-9" />
            <span className="font-display text-2xl italic font-semibold">Coralina</span>
          </div>
          <p className="mt-3 max-w-sm text-sm font-light leading-relaxed text-linen/70">
            Swimwear de corte limpio y colores de atardecer. Diseñado y confeccionado en Colombia.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-brand">Tienda</p>
          <ul className="mt-3 space-y-2 text-sm font-light text-linen/75">
            <li><Link className="hover:text-linen" href="/coleccion">Toda la colección</Link></li>
            {categories.slice(0, 3).map((c) => (
              <li key={c.slug}>
                <Link className="hover:text-linen" href={`/coleccion?cat=${c.slug}`}>{c.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-brand">Ayuda</p>
          <ul className="mt-3 space-y-2 text-sm font-light text-linen/75">
            <li>Despacho de 24 a 48 h hábiles en Colombia</li>
            <li>Envío gratis desde {formatCOP(FREE_SHIPPING_CENTS)}</li>
            <li><Link className="hover:text-linen" href="/admin">Portal del equipo</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-linen/10 py-5 text-center text-xs font-light text-linen/40">
        © 2026 Coralina · Hecho en Colombia · Precios incluyen IVA
      </div>
    </footer>
  );
}

export async function StorefrontShell({ children }: { children: React.ReactNode }) {
  const { catalog, categories, theme, promos } = await getCatalog();
  return (
    <StoreProvider catalog={catalog} theme={theme} promos={promos}>
      <ThemeVars theme={theme} />
      <div className="flex min-h-screen flex-col">
        <Header categories={categories} />
        <main className="flex-1">{children}</main>
        <Footer categories={categories} />
      </div>
    </StoreProvider>
  );
}
