import { StorefrontShell, getCatalog } from "@/components/store/shell";
import { Collection } from "@/components/store/collection";

export const dynamic = "force-dynamic";

export default async function ColeccionPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { cat } = await searchParams;
  const { catalog } = await getCatalog();
  return (
    <StorefrontShell>
      <Collection catalog={catalog} initialCat={cat || ""} />
    </StorefrontShell>
  );
}
