"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/lib/constants";
import { useStore, ProductCard, type CatalogProduct } from "./shop";
import { ArrowIcon, StarfishIcon, BubblesPattern } from "./svgs";

/* ------------------------- Top ventas con tabs --------------------------- */

export function BestSellers({ catalog }: { catalog: CatalogProduct[] }) {
  const cats = useMemo(() => {
    const seen = new Map<string, string>();
    catalog.forEach((p) => seen.set(p.categorySlug, p.categoryName));
    return [...seen.entries()];
  }, [catalog]);
  const [tab, setTab] = useState("");
  // Orden: destacados primero, luego mayor descuento, luego con stock
  const sorted = useMemo(
    () =>
      [...catalog].sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        const da = a.compareAt ? a.compareAt - a.price : 0;
        const db = b.compareAt ? b.compareAt - b.price : 0;
        if (da !== db) return db - da;
        return b.stock - a.stock;
      }),
    [catalog],
  );
  const list = (tab ? sorted.filter((p) => p.categorySlug === tab) : sorted).slice(0, 8);
  if (!catalog.length) return null;

  return (
    <section className="py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-terracotta">Los favoritos de la orilla</p>
            <h2 className="mt-2 font-display text-3xl italic md:text-[2.6rem]">Top ventas de la temporada</h2>
          </div>
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[["", "Todo"], ...cats].map(([slug, name]) => (
              <button
                key={slug || "all"}
                onClick={() => setTab(slug)}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition",
                  tab === slug ? "border-ink bg-ink text-linen" : "border-ink/15 text-ink/60 hover:border-terracotta hover:text-terracotta",
                )}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-4 md:gap-x-5">
          {list.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
        <div className="mt-10 flex justify-center">
          <Link href={tab ? `/coleccion?cat=${tab}` : "/coleccion"} className="btn-ghost text-terracotta">
            Ver {tab ? cats.find(([s]) => s === tab)?.[1] : "toda la colección"} <ArrowIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ Countdown -------------------------------- */

function useCountdown(end: string | null) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!end || now == null) return null;
  const diff = Math.max(0, new Date(end).getTime() - now);
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff / 3600000) % 24),
    m: Math.floor((diff / 60000) % 60),
    s: Math.floor((diff / 1000) % 60),
  };
}

/* --------------------------- Combo builder ------------------------------- */

export function ComboBuilder({
  catalog,
  pct,
  comboPrice,
  endAt,
  data,
}: {
  catalog: CatalogProduct[];
  pct: number;
  comboPrice?: number;
  endAt: string | null;
  data: { title?: string; text?: string };
}) {
  const { add, setDrawerOpen, toast } = useStore();
  const tops = catalog.filter((p) => p.categorySlug === "tops" && p.stock > 0);
  const panties = catalog.filter((p) => p.categorySlug === "panty" && p.stock > 0);
  const [topId, setTopId] = useState(tops[0]?.id ?? "");
  const [pantyId, setPantyId] = useState(panties[0]?.id ?? "");
  const [size, setSize] = useState("S");
  const cd = useCountdown(endAt);

  const top = tops.find((p) => p.id === topId);
  const panty = panties.find((p) => p.id === pantyId);
  if (!top || !panty) return null;

  const sizes = [...new Set([...top.variants, ...panty.variants].map((v) => v.size))];
  const vTop = top.variants.find((v) => v.size === size);
  const vPanty = panty.variants.find((v) => v.size === size);
  const available = !!vTop && !!vPanty && vTop.stock > 0 && vPanty.stock > 0;
  const full = top.price + panty.price;
  // Combos nativos cobran scope.comboPrice (CLP fijo); si no hay, % sobre full.
  const price =
    typeof comboPrice === "number" && comboPrice > 0
      ? Math.round(comboPrice)
      : Math.round(full * (1 - pct / 100));

  const addCombo = () => {
    if (!available || !vTop || !vPanty) return toast("Esa talla no está disponible en ambas piezas");
    for (const [p, v] of [[top, vTop], [panty, vPanty]] as const) {
      add({
        variantId: v.id, productId: p.id, name: p.name, productName: p.name, categorySlug: p.categorySlug,
        size: v.size, sku: v.sku, image: p.image, price: p.price, maxStock: v.stock,
      });
    }
    setDrawerOpen(true);
  };

  const Picker = ({ items, value, onChange, label }: { items: CatalogProduct[]; value: string; onChange: (id: string) => void; label: string }) => (
    <div>
      <p className="label">{label}</p>
      <div className="flex gap-2">
        {items.map((p) => (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            className={cn("overflow-hidden rounded-xl border-2 transition", value === p.id ? "border-terracotta shadow-md" : "border-transparent opacity-60 hover:opacity-100")}
            title={p.name}
          >
            <img src={p.image} alt={p.name} className="h-16 w-14 object-cover md:h-20 md:w-16" />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <section className="relative overflow-hidden py-14 md:py-20" style={{ background: "var(--ct-surface-warm)" }}>
      <BubblesPattern className="text-ink" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 md:px-8 lg:grid-cols-2">
        {/* Visual del set */}
        <div className="relative mx-auto flex w-full max-w-md items-center justify-center gap-3">
          <img src={top.image} alt={top.name} className="aspect-[4/5] w-[46%] -rotate-3 rounded-2xl object-cover shadow-xl" />
          <span className="absolute left-1/2 top-1/2 z-10 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--ct-primary)] text-2xl font-light text-white shadow-lg">+</span>
          <img src={panty.image} alt={panty.name} className="aspect-[4/5] w-[46%] rotate-3 rounded-2xl object-cover shadow-xl" />
          <span className="absolute -right-2 -top-3 rotate-6 rounded-full bg-ink px-4 py-2 text-sm font-bold text-amber-brand shadow-lg">−{pct}%</span>
        </div>

        {/* Constructor */}
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-terracotta">
            <StarfishIcon className="h-4 w-4" /> Arma tu set · se aplica solo
          </p>
          <h2 className="mt-2 font-display text-3xl italic md:text-[2.6rem]">{data.title || "Completa la marea"}</h2>
          <p className="mt-2 max-w-lg text-sm font-light leading-relaxed text-ink/70">
            {data.text || "Elige un top y un panty: el descuento aparece automáticamente en tu carrito."}
          </p>

          {cd && (
            <div className="mt-5 flex items-center gap-2">
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-ink/55">Termina en</span>
              {[["d", cd.d], ["h", cd.h], ["m", cd.m], ["s", cd.s]].map(([k, v]) => (
                <span key={k as string} className="min-w-11 rounded-lg bg-ink px-2 py-1.5 text-center font-mono text-sm font-bold text-linen">
                  {String(v).padStart(2, "0")}<span className="ml-0.5 text-[0.6rem] font-normal text-linen/60">{k}</span>
                </span>
              ))}
            </div>
          )}

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Picker items={tops} value={topId} onChange={setTopId} label={`Top · ${top.name}`} />
            <Picker items={panties} value={pantyId} onChange={setPantyId} label={`Panty · ${panty.name}`} />
          </div>

          <div className="mt-5">
            <p className="label">Talla del set</p>
            <div className="flex flex-wrap gap-2">
              {sizes.map((s) => {
                const ok = !!top.variants.find((v) => v.size === s && v.stock > 0) && !!panty.variants.find((v) => v.size === s && v.stock > 0);
                return (
                  <button
                    key={s}
                    disabled={!ok}
                    onClick={() => setSize(s)}
                    className={cn(
                      "min-w-12 rounded-xl border px-3 py-2 text-sm font-semibold transition",
                      !ok ? "cursor-not-allowed border-ink/10 text-ink/25 line-through" : size === s ? "border-ink bg-ink text-linen" : "border-ink/20 bg-white/50 hover:border-terracotta",
                    )}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4 rounded-2xl bg-linen/80 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs text-ink/55">Precio del set</p>
              <p className="flex items-baseline gap-2">
                <span className="font-display text-3xl italic">{formatCOP(price)}</span>
                <span className="text-sm text-ink/40 line-through">{formatCOP(full)}</span>
              </p>
              <p className="text-xs font-semibold text-sea">Ahorras {formatCOP(full - price)} frente a comprar las piezas por separado</p>
            </div>
            <button onClick={addCombo} disabled={!available} className="btn-primary !py-3.5">
              Agregar set al carrito <ArrowIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
