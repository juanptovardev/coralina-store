"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { formatCOP, FREE_SHIPPING_CENTS } from "@/lib/constants";
import { ProductCard, type CatalogProduct } from "./shop";
import { WaveIcon, StarfishIcon, ShellIcon, CoralIcon, BubblesPattern } from "./svgs";

export function Collection({
  catalog,
  initialCat,
}: {
  catalog: CatalogProduct[];
  initialCat: string;
}) {
  const [cat, setCat] = useState(initialCat);
  const cats = useMemo(
    () => [...new Set(catalog.map((p) => p.categorySlug))].map((s) => catalog.find((p) => p.categorySlug === s)!),
    [catalog],
  );
  const list = cat ? catalog.filter((p) => p.categorySlug === cat) : catalog;
  return (
    <div>
      <section className="relative overflow-hidden border-b border-ink/8 bg-sand/40">
        <BubblesPattern className="text-terracotta/60" />
        <div className="relative mx-auto max-w-7xl px-5 py-10 md:px-8 md:py-14">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-terracotta">
            <WaveIcon className="h-4 w-4" /> Colección Verano 26
          </p>
          <h1 className="mt-2 font-display text-4xl italic md:text-5xl">
            {cat ? cats.find((c) => c.categorySlug === cat)?.categoryName : "Toda la colección"}
          </h1>
          <p className="mt-2 max-w-md text-sm font-light text-ink/65">
            {list.length} piezas en terracota y ámbar. Corte limpio, tela de secado rápido, tallas fieles.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={!cat} onClick={() => setCat("")}>Todas</Chip>
          {cats.map((c) => (
            <Chip key={c.categorySlug} active={cat === c.categorySlug} onClick={() => setCat(c.categorySlug)}>
              {c.categoryName}
            </Chip>
          ))}
          <span className="ml-auto hidden items-center gap-1.5 text-xs text-ink/45 sm:flex">
            <StarfishIcon className="h-3.5 w-3.5 text-amber-brand" /> Envío gratis desde {formatCOP(FREE_SHIPPING_CENTS)}
          </span>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 pb-16 md:grid-cols-3 lg:grid-cols-4">
          {list.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition",
        active
          ? "border-terracotta bg-terracotta text-white"
          : "border-ink/15 bg-white/50 text-ink/60 hover:border-terracotta hover:text-terracotta",
      )}
    >
      {children}
    </button>
  );
}
