import { NextResponse } from "next/server";
import { db } from "@/db";
import { categories, inventoryLevels, products, variants } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { categoryStockSummary } from "@/lib/queries";
import { ensureSeeded } from "@/lib/seed";

export async function GET() {
  await ensureSeeded();
  const summary = await categoryStockSummary();
  const rows = await db
    .select({
      variantId: variants.id,
      size: variants.size,
      sku: variants.sku,
      active: variants.active,
      productId: products.id,
      productTitle: products.title,
      productStatus: products.status,
      image: products.images,
      categoryId: categories.id,
      categoryName: categories.name,
      stocked: inventoryLevels.stocked,
      threshold: inventoryLevels.threshold,
      updatedAt: inventoryLevels.updatedAt,
    })
    .from(variants)
    .innerJoin(products, eq(products.id, variants.productId))
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(inventoryLevels, eq(inventoryLevels.variantId, variants.id))
    .orderBy(asc(categories.sortOrder), asc(products.title), asc(variants.id));

  return NextResponse.json({
    summary,
    levels: rows.map((r) => ({
      ...r,
      image: Array.isArray(r.image) ? r.image[0] ?? "" : "",
      stocked: r.stocked ?? 0,
      threshold: r.threshold ?? 4,
    })),
  });
}
