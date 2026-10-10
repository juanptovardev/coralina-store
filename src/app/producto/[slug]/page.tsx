import { notFound } from "next/navigation";
import { StorefrontShell, getCatalog } from "@/components/store/shell";
import { PDP } from "@/components/store/pdp";

export const dynamic = "force-dynamic";

export default async function ProductoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { catalog, charts, categories, promos } = await getCatalog();
  const product = catalog.find((p) => p.slug === slug);
  if (!product) notFound();

  const catId = categories.find((c) => c.slug === product.categorySlug)?.id;
  const chartRow = charts.find((c) => c.categoryId === catId) ?? null;
  const chart = chartRow
    ? { unit: chartRow.unit, columns: chartRow.columns, rows: chartRow.rows }
    : null;

  const now = Date.now();
  const combo = promos.find(
    (p) => p.type === "combo" && p.enabled && new Date(p.startAt).getTime() <= now && new Date(p.endAt).getTime() >= now,
  );

  const crossTarget =
    product.categorySlug === "tops" ? "panty" : product.categorySlug === "panty" ? "tops" : null;
  const crossSell = crossTarget
    ? catalog.filter((p) => p.categorySlug === crossTarget).slice(0, 4)
    : catalog.filter((p) => p.categorySlug !== product.categorySlug).slice(0, 4);
  const related = catalog
    .filter((p) => p.id !== product.id && p.categorySlug === product.categorySlug)
    .concat(catalog.filter((p) => p.id !== product.id && p.categorySlug !== product.categorySlug))
    .slice(0, 4);

  return (
    <StorefrontShell>
      <PDP
        product={product}
        chart={chart}
        crossSell={crossSell}
        related={related}
        comboPct={combo ? combo.benefit.value : null}
      />
    </StorefrontShell>
  );
}
