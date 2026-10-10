"use client";

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn, formatCOP } from "@/lib/constants";
import { BagIcon, FishIcon, LogoMark, StarfishIcon, WaveIcon } from "./svgs";

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

export type AppliedPromo = { id: number; label: string; amountCents: number };
export type CartTotals = {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  applied: AppliedPromo[];
};

type StoreCtx = {
  catalog: CatalogProduct[];
  theme: Theme | null;
  items: CartItem[];
  count: number;
  add: (i: Omit<CartItem, "qty">, qty?: number) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  totals: CartTotals | null;
  subtotal: number;
  discount: number;
  total: number;
  drawerOpen: boolean;
  setDrawerOpen: (b: boolean) => void;
  toast: (msg: string) => void;
};

const Ctx = createContext<StoreCtx | null>(null);
export const useStore = () => useContext(Ctx)!;

/* --------------------------------- Provider -------------------------------- */

const LS_KEY = "coralina_cart_v1";

export function StoreProvider({
  children,
  catalog,
  theme,
}: {
  children: React.ReactNode;
  catalog: CatalogProduct[];
  theme: Theme | null;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [totals, setTotals] = useState<CartTotals | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch { /* noop */ }
  }, []);

  // El motor único de promos vive en el servidor: /api/cart/evaluate.
  // Se re-evalúa cuando cambia el carrito (debounce 250ms).
  useEffect(() => {
    if (items.length === 0) {
      setTotals(null);
      return;
    }
    const t = setTimeout(() => {
      fetch("/api/cart/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ variantId: Number(i.variantId), quantity: i.qty })),
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => setTotals(json))
        .catch(() => setTotals(null));
    }, 250);
    return () => clearTimeout(t);
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
    toast(`"${i.name}" en el carrito`);
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

  const subtotal = totals?.subtotalCents ?? 0;
  const discount = totals?.discountCents ?? 0;
  const total = totals?.totalCents ?? 0;

  const value: StoreCtx = {
    catalog, theme, items,
    count: items.reduce((s, i) => s + i.qty, 0),
    add, setQty, remove, clear,
    totals, subtotal, discount, total,
    drawerOpen, setDrawerOpen, toast,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <CartDrawer />
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2">
          <div className="fade-up flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-linen shadow-xl">
            <WaveIcon className="h-4 w-4 text-amber-brand" /> {toastMsg}
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

/* --------------------------------- Header --------------------------------- */

const ANNOUNCEMENTS = [
  "Envío gratis desde $250.000 a todo Colombia",
  "Cambios de talla sin costo",
  "Hecho a mano en Colombia",
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
            <Link href="/catalogo" className="transition hover:text-terracotta">Colección</Link>
            {categories.map((c) => (
              <Link key={c.slug} href={`/catalogo?categoria=${c.slug}`} className="transition hover:text-terracotta">
                {c.name}
              </Link>
            ))}
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
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-primary)] px-1 text-[0.65rem] font-bold text-white">
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
              <Link onClick={() => setMenu(false)} href="/catalogo" className="rounded-xl px-3 py-3 hover:bg-sand/40">Toda la colección</Link>
              {categories.map((c) => (
                <Link key={c.slug} onClick={() => setMenu(false)} href={`/catalogo?categoria=${c.slug}`} className="rounded-xl px-3 py-3 hover:bg-sand/40">
                  {c.name}
                </Link>
              ))}
            </nav>
            <div className="mx-4 rounded-2xl bg-sand/50 p-4 text-xs text-ink/70">
              <StarfishIcon className="h-5 w-5 text-terracotta" />
              <p className="mt-2 font-semibold">Envío gratis desde $250.000</p>
              <p>Se aplica automáticamente en tu pedido.</p>
            </div>
            <Link onClick={() => setMenu(false)} href="/admin" className="btn-ghost mx-4 mt-auto mb-6 text-ink/70">Portal del equipo</Link>
          </aside>
        </div>
      )}
    </>
  );
}

/* ------------------------------- Cart Drawer ------------------------------- */

export function CartDrawer() {
  const { drawerOpen, setDrawerOpen, items, setQty, remove, totals, subtotal, discount, total, toast } = useStore();
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
            <FishIcon className="float-slow h-12 w-12 text-terracotta/50" />
            <p className="text-sm text-ink/60">Tu carrito está esperando la marea.</p>
            <button className="btn-primary" onClick={() => { setDrawerOpen(false); router.push("/catalogo"); }}>
              Explorar la colección
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {items.map((i) => (
                <div key={i.variantId} className="flex gap-4 border-b border-ink/8 py-4 last:border-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
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

              {discount > 0 && totals && totals.applied.length > 0 && (
                <div className="mt-4 rounded-xl bg-white/70 p-4">
                  <p className="label">Descuentos aplicados</p>
                  {totals.applied.map((p) => (
                    <p key={p.id} className="mt-2 flex items-center gap-1.5 text-xs font-medium text-sea">
                      <StarfishIcon className="h-3.5 w-3.5 text-amber-brand" />
                      {p.label}: −{formatCOP(p.amountCents)}
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-ink/10 bg-white/60 px-6 py-5">
              <FreeShippingBar total={total} />
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-ink/65"><span>Subtotal</span><span>{formatCOP(subtotal)}</span></div>
                {discount > 0 && (
                  <div className="flex justify-between font-medium text-sea"><span>Descuento</span><span>−{formatCOP(discount)}</span></div>
                )}
                <div className="flex justify-between pt-1 text-base font-bold"><span>Total</span><span>{formatCOP(total)}</span></div>
              </div>
              <button
                className="btn-primary mt-4 w-full"
                onClick={() => { setDrawerOpen(false); router.push("/checkout"); toast("Listo para el pago"); }}
              >
                Ir a pago seguro
              </button>
              <p className="mt-2 text-center text-[0.7rem] text-ink/45">Envío gratis desde $250.000 · Cambio fácil 30 días</p>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

export const FREE_SHIPPING = 250000;

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
        <div className="h-full rounded-full bg-gradient-to-r from-amber-brand to-[var(--color-primary)] transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ------------------------------- Product Card ------------------------------ */

export function ProductCard({ product, index = 0 }: { product: CatalogProduct; index?: number }) {
  const { add } = useStore();
  const off = product.compareAt ? Math.round((1 - product.price / product.compareAt) * 100) : 0;
  return (
    <Link href={`/producto/${product.slug}`} className="group fade-up block" style={{ animationDelay: `${(index % 8) * 70}ms` }}>
      <div className="relative overflow-hidden rounded-2xl bg-sand/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.image}
          alt={product.name}
          className={`aspect-[4/5] w-full object-cover transition duration-700 group-hover:scale-[1.045] ${product.stock === 0 ? "opacity-70 grayscale-[35%]" : ""}`}
        />
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {off > 0 && product.stock > 0 && <span className="rounded-full bg-amber-brand px-2.5 py-1 text-[0.65rem] font-bold text-ink">−{off}%</span>}
          {product.featured && <span className="rounded-full bg-[var(--color-primary)] px-2.5 py-1 text-[0.65rem] font-bold text-white">Nueva</span>}
          {product.stock === 0 && <span className="rounded-full bg-ink/70 px-2.5 py-1 text-[0.65rem] font-bold text-linen">Agotado</span>}
        </div>
        {product.stock > 0 && product.stock <= 6 && (
          <span className="absolute bottom-3 left-3 rounded-full bg-linen/90 px-2.5 py-1 text-[0.65rem] font-semibold text-terracotta">
            Últimas {product.stock} unidades
          </span>
        )}
      </div>
      <div className="mt-3 px-1">
        <p className="text-[0.62rem] uppercase tracking-[0.2em] text-ink/45">{product.categoryName}</p>
        <h3 className="font-display mt-1 text-[1.05rem] italic leading-snug transition group-hover:text-[var(--color-primary)]">{product.name}</h3>
        <p className="mt-1 flex items-baseline gap-2 text-sm">
          <span className="font-semibold">{formatCOP(product.price)}</span>
          {product.compareAt && <span className="text-xs text-ink/40 line-through">{formatCOP(product.compareAt)}</span>}
        </p>
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
          <button onClick={onClose} className="text-2xl leading-none text-ink/50 hover:text-ink" aria-label="Cerrar">×</button>
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
              {(chart.rows as Record<string, unknown>[]).filter((r) => r.active !== false).map((r, i) => (
                <tr key={i} className="border-t border-ink/8">
                  {chart.columns.map((c) => (
                    <td key={c.key} className={cn("px-4 py-2.5", c.key === "size" && "font-semibold")}>
                      {c.key === "size" ? String(r[c.key] ?? "") : String(convert(r[c.key]))}
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
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  return done ? (
    <div className="fade-up flex items-center justify-center gap-2 text-sm font-medium text-sea">
      <WaveIcon className="h-5 w-5" /> ¡Lista! Tu 10% OFF va en camino a {email}.
    </div>
  ) : (
    <form
      className="mx-auto flex w-full max-w-md flex-col gap-3 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (email.includes("@")) setDone(true);
      }}
    >
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="tu@correo.com"
        className="input flex-1 rounded-full bg-white/80 px-5"
      />
      <button type="submit" className="btn-primary whitespace-nowrap">Quiero mi 10% OFF</button>
    </form>
  );
}
