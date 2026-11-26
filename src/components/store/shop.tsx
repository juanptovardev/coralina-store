"use client";

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCOP, FREE_SHIPPING_CENTS } from "@/lib/constants";
import { evaluatePromos, type PromoLike } from "@/lib/domain";
import { LogoMark, BagIcon, FishIcon, StarfishIcon, WaveIcon } from "./svgs";

/* ------------------------------- Tipos de catálogo ------------------------- */

export type CatalogVariant = { id: string; size: string; stock: number; sku: string };
export type CatalogProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  compareAt: number | null;
  image: string;
  featured: boolean;
  description: string | null;
  categoryName: string;
  categorySlug: string;
  stock: number;
  variants: CatalogVariant[];
};

export type Theme = {
  primary: string;
  accent: string;
  surfaceWarm: string;
  surfaceBase: string;
};

export type CartItem = {
  variantId: string;
  productId: string;
  name: string;
  productName: string;
  categorySlug: string;
  size: string;
  sku: string;
  image: string;
  price: number;
  qty: number;
  maxStock: number;
};

type StoreCtx = {
  catalog: CatalogProduct[];
  theme: Theme | null;
  promos: PromoLike[];
  items: CartItem[];
  count: number;
  add: (i: Omit<CartItem, "qty">, qty?: number) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  subtotal: number;
  discount: number;
  total: number;
  appliedPromo: PromoLike | null;
  promoNote: string | null;
  promoCode: string;
  setPromoCode: (c: string) => void;
  drawerOpen: boolean;
  setDrawerOpen: (b: boolean) => void;
  toast: (msg: string) => void;
};

const Ctx = createContext<StoreCtx | null>(null);
export const useStore = () => useContext(Ctx)!;

/* --------------------------------- Provider -------------------------------- */

const LS_KEY = "coralina_cart_v1";

/** Cotización del motor server (/api/cart/evaluate). `ok=false` ⇒ fallback client. */
type ServerQuote = {
  sig: string;
  ok: boolean;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  applied: Array<{ id: number; label: string; amountCents: number }>;
};

/** Mapa display-only del `applied` server → PromoLike (UI solo usa `.name`). */
function promoFromQuote(a: { id: number; label: string }, fallback: PromoLike | null): PromoLike {
  if (fallback && String(fallback.id) === String(a.id)) return fallback;
  return {
    id: String(a.id),
    name: a.label,
    type: "combo",
    scope: {},
    benefit: { kind: "pct", value: 0 },
    startAt: new Date(0),
    endAt: new Date(0),
    enabled: true,
    priority: 0,
    code: null,
  };
}

export function StoreProvider({
  children,
  catalog,
  theme,
  promos,
}: {
  children: React.ReactNode;
  catalog: CatalogProduct[];
  theme: Theme | null;
  promos: PromoLike[];
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [quote, setQuote] = useState<ServerQuote | null>(null);

  // Reconciliación con el catálogo del servidor: descarta variantes que ya no
  // existen y refresca precio/nombre/stock antes de persistir de nuevo.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const byVariant = new Map<string, { product: CatalogProduct; variant: CatalogVariant }>();
      for (const p of catalog) for (const v of p.variants) byVariant.set(v.id, { product: p, variant: v });
      const reconciled: CartItem[] = [];
      for (const it of parsed as CartItem[]) {
        const hit = it && typeof it.variantId === "string" ? byVariant.get(it.variantId) : undefined;
        if (!hit) continue;
        let qty = Math.max(1, Math.min(Number(it.qty) || 1, 9));
        if (hit.variant.stock > 0) qty = Math.min(qty, hit.variant.stock);
        reconciled.push({
          ...it,
          name: hit.product.name,
          productName: hit.product.name,
          price: hit.product.price,
          maxStock: hit.variant.stock,
          qty,
        });
      }
      setItems(reconciled);
    } catch { /* noop */ }
  }, [catalog]);

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(items)); } catch { /* noop */ }
  }, [items]);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2400);
  }, []);

  const add = useCallback((i: Omit<CartItem, "qty">, qty = 1) => {
    setItems((prev) => {
      const found = prev.find((x) => x.variantId === i.variantId);
      if (found) {
        const next = Math.min(found.qty + qty, i.maxStock, 9);
        return prev.map((x) => (x.variantId === i.variantId ? { ...x, qty: next } : x));
      }
      return [...prev, { ...i, qty: Math.min(qty, i.maxStock, 9) }];
    });
    toast(`“${i.name}” en el carrito`);
  }, [toast]);

  const setQty = useCallback((variantId: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((x) => x.variantId !== variantId)
        : prev.map((x) => (x.variantId === variantId ? { ...x, qty: Math.min(qty, x.maxStock, 9) } : x)),
    );
  }, []);

  const remove = useCallback((variantId: string) => setItems((p) => p.filter((x) => x.variantId !== variantId)), []);
  const clear = useCallback(() => setItems([]), []);

  const local = useMemo(() => {
    const lines = items.map((i) => ({
      variantId: i.variantId, productId: i.productId, productName: i.productName,
      categorySlug: i.categorySlug, size: i.size, sku: i.sku, qty: i.qty, price: i.price,
    }));
    return evaluatePromos(lines, promos, promoCode ? promoCode.trim() : null);
  }, [items, promos, promoCode]);

  // Re-quote server: mismos items + código ⇒ fuente de verdad del total.
  const quoteSig = items.length
    ? `${items.map((i) => `${i.variantId}x${i.qty}`).join(",")}|${promoCode.trim().toLowerCase()}`
    : "";
  useEffect(() => {
    // Carrito vacío: `quoteSig` queda "" ⇒ serverOk=false y manda el motor client.
    if (!quoteSig) return;
    if (quote?.sig === quoteSig) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/cart/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: items.map((i) => ({ variantId: i.variantId, quantity: i.qty })),
            code: promoCode.trim() || undefined,
          }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (cancelled || typeof data?.totalCents !== "number") throw new Error("bad payload");
        setQuote({
          sig: quoteSig,
          ok: true,
          subtotalCents: Number(data.subtotalCents) || 0,
          discountCents: Number(data.discountCents) || 0,
          totalCents: Number(data.totalCents) || 0,
          applied: Array.isArray(data.applied) ? data.applied : [],
        });
      } catch {
        // Fallback defensivo al motor client (evaluatePromos) sin reintentos en bucle.
        if (!cancelled) setQuote({ sig: quoteSig, ok: false, subtotalCents: 0, discountCents: 0, totalCents: 0, applied: [] });
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [quoteSig, quote, items, promoCode, drawerOpen]);

  const serverOk = !!quote && quote.ok && quote.sig === quoteSig;
  const subtotal = serverOk ? quote.subtotalCents / 100 : local.subtotal;
  const discount = serverOk ? quote.discountCents / 100 : local.discount;
  const total = serverOk ? quote.totalCents / 100 : local.total;
  const appliedPromo = serverOk
    ? quote.applied[0]
      ? promoFromQuote(quote.applied[0], local.applied)
      : null
    : local.applied;
  const note = local.note;

  const value: StoreCtx = {
    catalog, theme, promos, items,
    count: items.reduce((s, i) => s + i.qty, 0),
    add, setQty, remove, clear,
    subtotal, discount, total,
    appliedPromo, promoNote: note, promoCode, setPromoCode,
    drawerOpen, setDrawerOpen, toast,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <CartDrawer />
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-linen shadow-xl fade-up">
            <WaveIcon className="w-4 h-4 text-amber-brand" /> {toastMsg}
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

/* --------------------------------- Header --------------------------------- */

const ANNOUNCEMENTS = [
  `Envío gratis desde ${formatCOP(FREE_SHIPPING_CENTS)} en Colombia`,
  "Pedido por WhatsApp",
  "Hecho en Colombia",
];

export function Header({ categories }: { categories: { name: string; slug: string }[] }) {
  const { count, setDrawerOpen, subtotal } = useStore();
  const [menu, setMenu] = useState(false);
  const [ann, setAnn] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setAnn((a) => (a + 1) % ANNOUNCEMENTS.length), 4200);
    return () => clearInterval(t);
  }, []);
  return (
    <>
      {/* Barra de anuncios rotativa */}
      <div className="relative z-50 overflow-hidden bg-ink text-linen">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-center gap-2 px-5 text-[0.7rem] font-medium tracking-[0.12em] md:text-xs">
          <WaveIcon className="h-4 w-4 shrink-0 text-amber-brand" />
          <span key={ann} className="fade-up truncate uppercase">{ANNOUNCEMENTS[ann]}</span>
        </div>
      </div>
      <header className="sticky top-0 z-50 border-b border-ink/8 bg-linen/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 md:px-8">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMenu(true)}
              className="rounded-full p-2 text-ink/75 transition hover:bg-ink/5 md:hidden"
              aria-label="Abrir menú"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-6 w-6">
                <path d="M4 7h16M4 12h11M4 17h16" />
              </svg>
            </button>
            <Link href="/" className="flex items-center gap-2.5">
              <LogoMark className="h-9 w-9" />
              <span className="font-display text-[1.45rem] italic font-semibold tracking-tight md:text-[1.55rem]">Coralina</span>
            </Link>
          </div>
          <nav className="hidden items-center gap-7 text-[0.8rem] font-medium uppercase tracking-[0.14em] text-ink/75 md:flex">
            <Link href="/coleccion" className="transition hover:text-terracotta">Colección</Link>
            {categories.map((c) => (
              <Link key={c.slug} href={`/coleccion?cat=${c.slug}`} className="transition hover:text-terracotta">
                {c.name}
              </Link>
            ))}
            <Link href="/coleccion" className="rounded-full bg-amber-brand/25 px-3 py-1 text-[0.7rem] font-bold text-terracotta-dark">
              −15% Combo
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink/65 transition hover:border-terracotta hover:text-terracotta"
              title="Portal del equipo (dashboard)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-4 w-4">
                <path d="M4 5h7v7H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 14h7v5H4z" />
              </svg>
              <span className="hidden sm:inline">Portal equipo</span>
            </Link>
            <button
              onClick={() => setDrawerOpen(true)}
              className="relative flex items-center gap-2 rounded-full border border-ink/12 bg-white/70 p-2.5 text-ink transition hover:border-terracotta hover:text-terracotta"
              aria-label="Abrir carrito"
            >
              <BagIcon className="h-5 w-5" />
              {count > 0 && <span className="hidden pr-1 text-xs font-semibold lg:inline">{formatCOP(subtotal)}</span>}
              {count > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--ct-primary)] px-1 text-[0.65rem] font-bold text-white">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Menú móvil */}
      {menu && (
        <div className="fixed inset-0 z-[80] md:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMenu(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-[82%] max-w-xs flex-col bg-linen shadow-2xl" style={{ animation: "fadeUp .25s ease both" }}>
            <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
              <span className="font-display text-xl italic">Menú</span>
              <button onClick={() => setMenu(false)} className="text-2xl leading-none text-ink/50" aria-label="Cerrar menú">×</button>
            </div>
            <nav className="flex flex-col gap-1 p-4 text-sm font-semibold uppercase tracking-[0.14em]">
              <Link onClick={() => setMenu(false)} href="/coleccion" className="rounded-xl px-3 py-3 hover:bg-sand/40">Toda la colección</Link>
              {categories.map((c) => (
                <Link key={c.slug} onClick={() => setMenu(false)} href={`/coleccion?cat=${c.slug}`} className="rounded-xl px-3 py-3 hover:bg-sand/40">
                  {c.name}
                </Link>
              ))}
            </nav>
            <Link onClick={() => setMenu(false)} href="/admin" className="btn-ghost mx-4 mt-auto mb-6 text-ink/70">Portal del equipo</Link>
          </aside>
        </div>
      )}
    </>
  );
}

/* ------------------------------- Cart Drawer ------------------------------- */

export function CartDrawer() {
  const { drawerOpen, setDrawerOpen, items, setQty, remove, subtotal, discount, total, promoCode, setPromoCode, appliedPromo, promoNote, toast } = useStore();
  const router = useRouter();
  if (!drawerOpen) return null;
  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={() => setDrawerOpen(false)} />
      <aside className="drawer-in absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-linen shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink/10 px-6 py-4">
          <h2 className="font-display text-xl italic">Tu carrito</h2>
          <button onClick={() => setDrawerOpen(false)} className="text-2xl leading-none text-ink/50 hover:text-ink" aria-label="Cerrar">×</button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <FishIcon className="h-12 w-12 text-terracotta/50 float-slow" />
            <p className="text-sm text-ink/60">Tu carrito está esperando la marea.</p>
            <button className="btn-primary" onClick={() => { setDrawerOpen(false); router.push("/coleccion"); }}>
              Explorar la colección
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {items.map((i) => (
                <div key={i.variantId} className="flex gap-4 border-b border-ink/8 py-4 last:border-0">
                  <img src={i.image} alt={i.name} className="h-20 w-16 rounded-lg object-cover" />
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-display text-[0.95rem] italic">{i.name}</p>
                        <p className="text-xs text-ink/55">Talla {i.size} · {i.sku}</p>
                      </div>
                      <button onClick={() => remove(i.variantId)} className="text-xs text-ink/40 underline-offset-2 hover:text-terracotta hover:underline">Quitar</button>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <div className="flex items-center rounded-full border border-ink/15">
                        <button className="px-2.5 py-1 text-sm hover:text-terracotta" onClick={() => setQty(i.variantId, i.qty - 1)}>−</button>
                        <span className="w-6 text-center text-sm font-medium">{i.qty}</span>
                        <button
                          className={cn("px-2.5 py-1 text-sm", i.qty >= i.maxStock ? "cursor-not-allowed text-ink/25" : "hover:text-terracotta")}
                          onClick={() => i.qty < i.maxStock && setQty(i.variantId, i.qty + 1)}
                        >+</button>
                      </div>
                      <p className="text-sm font-semibold">{formatCOP(i.price * i.qty)}</p>
                    </div>
                    {i.qty >= i.maxStock && <p className="mt-1 text-[0.68rem] text-terracotta">Máximo disponible por pedido</p>}
                  </div>
                </div>
              ))}

              <div className="mt-4 rounded-xl bg-white/70 p-4">
                <label className="label">¿Tienes un código?</label>
                <div className="flex gap-2">
                  <input
                    className="input uppercase placeholder:normal-case"
                    placeholder="Ej. MAREA15"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                  />
                  {promoCode && <button className="btn-quiet" onClick={() => setPromoCode("")}>×</button>}
                </div>
                {appliedPromo && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-sea">
                    <StarfishIcon className="h-3.5 w-3.5 text-amber-brand" />
                    “{appliedPromo.name}” se aplica automáticamente: −{formatCOP(discount)}
                  </p>
                )}
                {promoNote && <p className="mt-2 text-xs text-terracotta">{promoNote}</p>}
              </div>
            </div>

            <div className="border-t border-ink/10 bg-white/60 px-6 py-5">
              <FreeShippingBar total={total} />
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-ink/65"><span>Subtotal</span><span>{formatCOP(subtotal)}</span></div>
                {discount > 0 && (
                  <div className="flex justify-between font-medium text-sea"><span>Descuento ({appliedPromo?.name})</span><span>−{formatCOP(discount)}</span></div>
                )}
                <div className="flex justify-between pt-1 text-base font-bold"><span>Total</span><span>{formatCOP(total)}</span></div>
              </div>
              <button
                className="btn-primary mt-4 w-full"
                onClick={() => { setDrawerOpen(false); router.push("/checkout"); toast("Listo para el pago"); }}
              >
                Ir a pago seguro
              </button>
              <p className="mt-2 text-center text-[0.7rem] text-ink/45">Envío gratis desde $30.000 · Cambio fácil 30 días</p>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

export const FREE_SHIPPING = FREE_SHIPPING_CENTS;

export function FreeShippingBar({ total }: { total: number }) {
  const pct = Math.min(100, (total / FREE_SHIPPING) * 100);
  const missing = FREE_SHIPPING - total;
  return (
    <div className="mb-4">
      <p className="text-xs font-medium text-ink/70">
        {missing > 0 ? (
          <>Te faltan <strong className="text-terracotta">{formatCOP(missing)}</strong> para el <strong>envío gratis</strong></>
        ) : (
          <span className="font-semibold text-sea">¡Tienes envío gratis! 🌊</span>
        )}
      </p>
      <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-ink/8">
        <div className="h-full rounded-full bg-gradient-to-r from-amber-brand to-[var(--ct-primary)] transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ------------------------------- Product Card ------------------------------ */

export function ProductCard({ product, index = 0 }: { product: CatalogProduct; index?: number }) {
  const { add, toast } = useStore();
  const off = product.compareAt ? Math.round((1 - product.price / product.compareAt) * 100) : 0;
  return (
    <Link href={`/producto/${product.slug}`} className="group block fade-up" style={{ animationDelay: `${index * 70}ms` }}>
      <div className="relative overflow-hidden rounded-2xl bg-sand/40">
        <img
          src={product.image}
          alt={product.name}
          className="aspect-[4/5] w-full object-cover transition duration-700 group-hover:scale-[1.045]"
        />
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {off > 0 && <span className="rounded-full bg-amber-brand px-2.5 py-1 text-[0.65rem] font-bold text-ink">−{off}%</span>}
          {product.featured && <span className="rounded-full bg-[var(--ct-primary)] px-2.5 py-1 text-[0.65rem] font-bold text-white">Nueva</span>}
          {product.stock === 0 && <span className="rounded-full bg-ink/70 px-2.5 py-1 text-[0.65rem] font-bold text-linen">Agotado</span>}
        </div>
        {product.stock > 0 && product.stock <= 8 && (
          <span className="absolute bottom-3 left-3 rounded-full bg-linen/90 px-2.5 py-1 text-[0.65rem] font-semibold text-terracotta">
            Últimas {product.stock} unidades
          </span>
        )}
      </div>
      <div className="mt-3 flex items-start justify-between gap-2 px-1">
        <div>
          <h3 className="font-display text-[1.05rem] italic leading-tight">{product.name}</h3>
          <p className="mt-0.5 flex items-baseline gap-2 text-sm">
            <span className="font-semibold">{formatCOP(product.price)}</span>
            {product.compareAt && <span className="text-xs text-ink/40 line-through">{formatCOP(product.compareAt)}</span>}
          </p>
        </div>
      </div>
      <div className="mt-2 flex gap-1.5 px-1">
        {product.variants.map((v) => (
          <button
            key={v.id}
            disabled={v.stock === 0}
            onClick={(e) => {
              e.preventDefault();
              add({
                variantId: v.id, productId: product.id, name: product.name, productName: product.name,
                categorySlug: product.categorySlug, size: v.size, sku: v.sku, image: product.image, price: product.price, maxStock: v.stock,
              });
            }}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition",
              v.stock === 0
                ? "cursor-not-allowed border-ink/10 text-ink/25 line-through"
                : "border-ink/15 text-ink/70 hover:border-terracotta hover:bg-terracotta hover:text-white",
            )}
            title={v.stock === 0 ? `Talla ${v.size} agotada` : `Agregar talla ${v.size}`}
          >
            {v.size}
          </button>
        ))}
      </div>
    </Link>
  );
}

/* ----------------------------- Size Chart Modal ---------------------------- */

export function SizeChartModal({
  chart,
  open,
  onClose,
}: {
  chart: { unit: string; columns: { key: string; label: string }[]; rows: Record<string, unknown>[] } | null;
  open: boolean;
  onClose: () => void;
}) {
  const [unit, setUnit] = useState<"cm" | "in">(chart?.unit === "in" ? "in" : "cm");
  if (!open || !chart) return null;
  const convert = (v: unknown) => {
    const n = Number(v);
    if (Number.isNaN(n)) return v;
    if (unit === chart.unit) return n;
    return Math.round((unit === "in" ? n / 2.54 : n * 2.54) * 10) / 10;
  };
  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} />
      <div className="fade-up relative w-full max-w-lg rounded-2xl bg-linen p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-display text-2xl italic">Guía de tallas</h3>
            <p className="mt-1 text-xs text-ink/55">Mide sobre ropa ajustada y compara con la tabla de tu categoría.</p>
          </div>
          <button onClick={onClose} className="text-2xl leading-none text-ink/50 hover:text-ink">×</button>
        </div>
        <div className="mt-4 inline-flex rounded-full border border-ink/15 p-0.5 text-xs font-semibold">
          {(["cm", "in"] as const).map((u) => (
            <button key={u} onClick={() => setUnit(u)} className={cn("rounded-full px-4 py-1.5 transition", unit === u ? "bg-terracotta text-white" : "text-ink/55 hover:text-ink")}>
              {u}
            </button>
          ))}
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-ink/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sand/50 text-left text-xs uppercase tracking-wider text-ink/60">
                {chart.columns.map((c) => (
                  <th key={c.key} className="px-4 py-2.5 font-semibold">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(chart.rows as any[]).filter((r) => r.active !== false).map((r) => (
                <tr key={String(r.size)} className="border-t border-ink/8">
                  {chart.columns.map((c) => (
                    <td key={c.key} className={cn("px-4 py-2.5", c.key === "size" && "font-semibold")}>
                      {c.key === "size" ? r[c.key] : convert(r[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[0.7rem] text-ink/45">
          ¿Entre dos tallas? Te recomendamos la menor: el tejido de Coralina tiene recuperación de 40%.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------- Newsletter -------------------------------- */

export function NewsletterForm() {
  return (
    <p className="max-w-md text-sm font-light leading-relaxed text-ink/70">
      Todavía no enviamos un boletín. Cuando abramos la lista de correo, el formulario aparecerá aquí.
    </p>
  );
}
