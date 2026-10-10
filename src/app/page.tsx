import { StorefrontShell, getCatalog } from "@/components/store/shell";
import { HomeView } from "@/components/store/home-view";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview } = await searchParams;
  const { catalog, categories, promos } = await getCatalog();
  const now = Date.now();
  const active = promos.filter(
    (p) => p.enabled && new Date(p.startAt).getTime() <= now && new Date(p.endAt).getTime() >= now,
  );
  const combo = active.find((p) => p.type === "combo") ?? null;
  return (
    <StorefrontShell>
      <HomeView
        catalog={catalog}
        categories={categories}
        previewId={preview}
        comboPromo={
          combo
            ? {
                name: combo.name,
                benefit: combo.benefit,
                code: combo.code,
                endAt: new Date(combo.endAt).toISOString(),
                comboPrice: typeof combo.scope.comboPrice === "number" ? combo.scope.comboPrice : undefined,
              }
            : null
        }
      />
    </StorefrontShell>
  );
}
