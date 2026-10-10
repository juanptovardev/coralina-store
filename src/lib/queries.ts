import { db } from "@/db";
import {
  categories,
  homeLayouts,
  inventoryLevels,
  products,
  sizeCharts,
  themeTokens,
  variants,
} from "@/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import { DEFAULT_TOKENS } from "./constants";
import { ensureSeeded } from "./seed";

export type StoreVariant = { id: number; size: string; sku: string; stock: number };
export type StoreProduct = {
  id: number;
  title: string;
  handle: string;
  description: string;
  categoryId: number;
  categoryName: string;
  categorySlug: string;
  priceCents: number;
  compareAtCents: number | null;
  images: string[];
  tags: string[];
  status: string;
  variants: StoreVariant[];
  totalStock: number;
};

export async function getTokens(): Promise<Record<string, string>> {
  await ensureSeeded();
  const rows = await db.select().from(themeTokens);
  const map: Record<string, string> = { ...DEFAULT_TOKENS };
  for (const r of rows) map[r.key] = r.value;
  return map;
}

export async function getActiveLayout() {
  await ensureSeeded();
  const [active] = await db
    .select()
    .from(homeLayouts)
    .where(eq(homeLayouts.status, "active"))
    .limit(1);
  if (active) return active;
  const [first] = await db.select().from(homeLayouts).orderBy(asc(homeLayouts.id)).limit(1);
  return first;
}

export async function getCategories() {
  await ensureSeeded();
  return db.select().from(categories).orderBy(asc(categories.sortOrder));
}

export async function getSizeChart(categoryId: number) {
  const [row] = await db
    .select()
    .from(sizeCharts)
    .where(eq(sizeCharts.categoryId, categoryId))
    .limit(1);
  return row ?? null;
}

export async function listProducts(opts?: {
  onlyPublished?: boolean;
  categorySlug?: string;
  tag?: string;
}): Promise<StoreProduct[]> {
  await ensureSeeded();
  const rows = await db
    .select({
      p: products,
      cName: categories.name,
      cSlug: categories.slug,
    })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .orderBy(asc(products.id));

  const variantRows = await db
    .select({
      id: variants.id,
      productId: variants.productId,
      size: variants.size,
      sku: variants.sku,
      active: variants.active,
      stock: inventoryLevels.stocked,
    })
    .from(variants)
    .leftJoin(inventoryLevels, eq(inventoryLevels.variantId, variants.id));

  let list: StoreProduct[] = rows.map(({ p, cName, cSlug }) => {
    const vs = variantRows
      .filter((v) => v.productId === p.id && v.active !== false)
      .map((v) => ({ id: v.id, size: v.size, sku: v.sku, stock: v.stock ?? 0 }));
    return {
      id: p.id,
      title: p.title,
      handle: p.handle,
      description: p.description,
      categoryId: p.categoryId,
      categoryName: cName,
      categorySlug: cSlug,
      priceCents: p.priceCents,
      compareAtCents: p.compareAtCents,
      images: p.images,
      tags: p.tags,
      status: p.status,
      variants: vs,
      totalStock: vs.reduce((a, v) => a + v.stock, 0),
    };
  });

  if (opts?.onlyPublished) list = list.filter((p) => p.status === "published");
  if (opts?.categorySlug) list = list.filter((p) => p.categorySlug === opts.categorySlug);
  if (opts?.tag) list = list.filter((p) => p.tags.includes(opts.tag!));
  return list;
}

export async function getProductByHandle(handle: string): Promise<StoreProduct | null> {
  const all = await listProducts();
  return all.find((p) => p.handle === handle) ?? null;
}

export async function categoryStockSummary() {
  await ensureSeeded();
  const rows = await db
    .select({
      categoryId: categories.id,
      name: categories.name,
      slug: categories.slug,
      imageUrl: categories.imageUrl,
      stocked: sql<number>`coalesce(sum(${inventoryLevels.stocked}),0)::int`,
      lowCount: sql<number>`coalesce(sum(case when ${inventoryLevels.stocked} <= ${inventoryLevels.threshold} then 1 else 0 end),0)::int`,
      variantCount: sql<number>`count(${variants.id})::int`,
    })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .leftJoin(variants, and(eq(variants.productId, products.id), eq(variants.active, true)))
    .leftJoin(inventoryLevels, eq(inventoryLevels.variantId, variants.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder));
  return rows.map((r) => ({
    ...r,
    level: r.stocked === 0 ? "out" : r.lowCount > 0 ? "low" : r.stocked < 40 ? "med" : "high",
  }));
}
