"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCOP, FREE_SHIPPING_CENTS } from "@/lib/constants";
import { useStore, SizeChartModal, ProductCard, type CatalogProduct } from "./shop";
import { WaveIcon, StarfishIcon, ShellIcon, BubblesPattern } from "./svgs";

type Chart = { unit: string; columns: { key: string; label: string }[]; rows: Record<string, unknown>[] } | null;

export function PDP({
  product,
  chart,
  crossSell,
  related,
  comboPct,
}: {
  product: CatalogProduct;
  chart: Chart;
  crossSell: CatalogProduct[];
  related: CatalogProduct[];
  comboPct: number | null;
}) {
  const { add, toast } = useStore();
  const firstInStock = product.variants.find((v) => v.stock > 0);
  const [size, setSize] = useState<string | null>(firstInStock?.size ?? null);
  const [qty, setQty] = useState(1);
  const [modal, setModal] = useState(false);
  const [openAcc, setOpenAcc] = useState<string | null>("desc");

  const variant = product.variants.find((v) => v.size === size) ?? null;
  const off = product.compareAt ? Math.round((1 - product.price / product.compareAt) * 100) : 0;

  const stockHint = useMemo(() => {
    if (!variant) return null;
    if (variant.stock === 0) return "Agotada en esta talla";
    if (variant.stock <= 5) return `Quedan solo ${variant.stock} en esta talla`;
    return "En stock, listo para enviar";
  }, [variant]);

  const addClick = () => {
    if (!variant || variant.stock === 0) {
      toast("Elige una talla disponible");
      return;
    }
    add({
      variantId: variant.id, productId: product.id, name: product.name, productName: product.name,
      categorySlug: product.categorySlug, size: variant.size, sku: variant.sku, image: product.image,
      price: product.price, maxStock: variant.stock,
    }, qty);
  };

  const accordions = [
    { key: "desc", label: "Descripción", body: product.description || "Diseño de la colección Verano 26." },
    { key: "envio", label: "Envíos y cambios", body: `Despacho de 24 a 48 horas hábiles a toda Colombia. Envío gratis desde ${formatCOP(FREE_SHIPPING_CENTS)}.` },
    { key: "tejido", label: "Tejido y cuidado", body: "Lavar a mano en agua fría y secar a la sombra. Evita el cloro y la secadora para que el color dure." },
  ];

  return (
    <div>
      <div className="mx-auto max-w-7xl px-5 pt-6 md:px-8">
        <nav className="flex items-center gap-2 text-xs text-ink/50">
          <Link href="/" className="hover:text-terracotta">Inicio</Link>
          <span>/</span>
          <Link href="/coleccion" className="hover:text-terracotta">Colección</Link>
          <span>/</span>
          <span className="text-ink/75">{product.name}</span>
        </nav>

        <div className="mt-5 grid gap-10 lg:grid-cols-2">
          {/* Imagen */}
          <div className="relative overflow-hidden rounded-3xl bg-sand/40">
            <img src={product.image} alt={product.name} className="aspect-[4/5] w-full object-cover" />
            <div className="absolute left-4 top-4 flex flex-col gap-1.5">
              {off > 0 && <span className="rounded-full bg-amber-brand px-3 py-1 text-xs font-bold text-ink">Ahorra {off}%</span>}
              {product.featured && <span className="rounded-full bg-[var(--ct-primary)] px-3 py-1 text-xs font-bold text-white">Nueva</span>}
            </div>
          </div>

          {/* Info */}
          <div className="flex flex-col">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-terracotta">{product.categoryName}</p>
            <h1 className="mt-2 font-display text-4xl italic leading-tight md:text-5xl">{product.name}</h1>
            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-2xl font-bold">{formatCOP(product.price)}</span>
              {product.compareAt && <span className="text-base text-ink/40 line-through">{formatCOP(product.compareAt)}</span>}
            </div>

            {comboPct && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-terracotta/40 bg-sand/30 px-4 py-3 text-xs font-medium text-ink/75">
                <StarfishIcon className="h-4 w-4 shrink-0 text-terracotta" />
                Completa el look con {product.categorySlug === "tops" ? "un panty" : product.categorySlug === "panty" ? "un top" : "un básico"} y llévate −{comboPct}% automático en el carrito.
              </div>
            )}

            {/* Tallas desde el SizeChart de la categoría */}
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <p className="label mb-0">Talla {variant && <span className="normal-case text-ink/40">· {variant.size}</span>}</p>
                <button onClick={() => setModal(true)} className="flex items-center gap-1.5 text-xs font-semibold text-terracotta underline-offset-2 hover:underline">
                  <ShellIcon className="h-4 w-4" /> Guía de tallas
                </button>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    disabled={v.stock === 0}
                    onClick={() => { setSize(v.size); setQty(1); }}
                    className={cn(
                      "min-w-14 rounded-xl border px-4 py-2.5 text-sm font-semibold transition",
                      v.stock === 0
                        ? "cursor-not-allowed border-ink/10 text-ink/25 line-through"
                        : size === v.size
                          ? "border-terracotta bg-terracotta text-white shadow-md shadow-terracotta/20"
                          : "border-ink/15 text-ink/70 hover:border-terracotta hover:text-terracotta",
                    )}
                  >
                    {v.size}
                  </button>
                ))}
              </div>
              {stockHint && (
                <p className={cn("mt-2 text-xs font-medium", variant && variant.stock > 0 ? (variant.stock <= 5 ? "text-terracotta" : "text-sea") : "text-ink/40")}>
                  {stockHint}
                </p>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-full border border-ink/15 bg-white/60">
                <button className="px-4 py-3 text-lg hover:text-terracotta" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
                <span className="w-8 text-center font-semibold">{qty}</span>
                <button
                  className={cn("px-4 py-3 text-lg", variant && qty >= variant.stock ? "cursor-not-allowed text-ink/25" : "hover:text-terracotta")}
                  onClick={() => variant && qty < variant.stock && setQty(qty + 1)}
                >+</button>
              </div>
              <button onClick={addClick} disabled={!variant || variant.stock === 0} className="btn-primary flex-1">
                Agregar al carrito · {formatCOP(product.price * qty)}
              </button>
            </div>

            {/* Beneficios */}
            <ul className="mt-7 space-y-2.5 border-t border-ink/10 pt-5 text-[0.82rem] text-ink/70">
              <li className="flex items-center gap-2.5"><WaveIcon className="h-4 w-4 text-terracotta" /> Envío gratis desde {formatCOP(FREE_SHIPPING_CENTS)} · despacho de 24 a 48 h</li>
              <li className="flex items-center gap-2.5"><StarfishIcon className="h-4 w-4 text-terracotta" /> Guía de tallas por categoría para elegir bien</li>
              <li className="flex items-center gap-2.5"><ShellIcon className="h-4 w-4 text-terracotta" /> Pedido por WhatsApp · sin pasarela de pago</li>
            </ul>

            {/* Acordeones */}
            <div className="mt-6 divide-y divide-ink/10 border-y border-ink/10">
              {accordions.map((a) => (
                <div key={a.key}>
                  <button
                    onClick={() => setOpenAcc(openAcc === a.key ? null : a.key)}
                    className="flex w-full items-center justify-between py-3.5 text-sm font-semibold"
                  >
                    {a.label}
                    <span className={cn("transition-transform", openAcc === a.key && "rotate-45")}>+</span>
                  </button>
                  {openAcc === a.key && <p className="pb-4 text-sm font-light leading-relaxed text-ink/65">{a.body}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cross-sell de combo */}
        {crossSell.length > 0 && (
          <section className="relative mt-14 overflow-hidden rounded-3xl py-10" style={{ background: "var(--ct-surface-warm)" }}>
            <BubblesPattern className="text-terracotta" />
            <div className="relative mx-auto max-w-7xl px-5 md:px-8">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-terracotta">Completa la marea {comboPct ? `· −${comboPct}% automático` : ""}</p>
                  <h2 className="mt-1 font-display text-2xl italic md:text-3xl">Le queda perfecto con</h2>
                </div>
                <Link href="/coleccion" className="flex items-center gap-2 text-sm font-semibold text-terracotta hover:gap-3 transition-all">
                  Ver toda la colección
                </Link>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-4">
                {crossSell.map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Relacionados */}
        {related.length > 0 && (
          <section className="mx-auto max-w-7xl px-5 py-14 md:px-8">
            <h2 className="font-display text-2xl italic md:text-3xl">También te puede gustar</h2>
            <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-4">
              {related.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          </section>
        )}
      </div>

      <SizeChartModal chart={chart} open={modal} onClose={() => setModal(false)} />
    </div>
  );
}
