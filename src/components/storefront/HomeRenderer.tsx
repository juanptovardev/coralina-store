"use client";

import Link from "next/link";
import type { BannerConfig, SectionInstance, WidgetInstance } from "@/db/schema";
import { LAYOUT_PLANE, formatCOP, type LayoutMode } from "@/lib/constants";
import { readBanner } from "@/lib/design";
import { resolveHref } from "@/lib/utils";
import {
  BENEFIT_ICONS,
  CoralFan,
  CoralIcon,
  ScrollCue,
  SeaBackdrop,
  ShellIcon,
  StarfishIcon,
  WaveBadge,
  WaveDivider,
  WaveLine,
  WaveStrip,
} from "@/components/sea";

export type HomeProduct = {
  id: number;
  title: string;
  handle: string;
  priceCents: number;
  compareAtCents: number | null;
  images: string[];
  categoryName: string;
  totalStock: number;
};

export type HomeCategory = {
  id: number;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
};

export type HomeLayoutData = {
  mode: LayoutMode;
  banner: BannerConfig;
  widgets: WidgetInstance[];
  sections: SectionInstance[];
};

function colStyle(w: WidgetInstance, compact: boolean) {
  if (compact) return { gridColumn: "1 / span 12", textAlign: w.grid.align } as React.CSSProperties;
  return {
    gridColumn: `${w.grid.colStart} / span ${Math.min(w.grid.colSpan, 13 - w.grid.colStart)}`,
    textAlign: w.grid.align,
  } as React.CSSProperties;
}

export function HomeRenderer({
  layout,
  categories,
  products,
  device = "desktop",
}: {
  layout: HomeLayoutData;
  categories: HomeCategory[];
  products: HomeProduct[];
  device?: "desktop" | "tablet" | "mobile";
}) {
  const plane = LAYOUT_PLANE[layout.mode] ?? LAYOUT_PLANE.preset_left;
  const widgets = Array.isArray(layout.widgets) ? layout.widgets : [];
  const enabled = (t: WidgetInstance["type"]) => widgets.find((w) => w.type === t && w.enabled);
  const { image: bImage, aspect: bAspect, overlay: bOverlay } = readBanner(layout.banner);
  const compact = device === "mobile";
  const align = plane.align;

  const kicker = enabled("kicker");
  const title = enabled("title");
  const subtitle = enabled("subtitle");
  const cta1 = enabled("cta_primary");
  const cta2 = enabled("cta_secondary");
  const benefits = enabled("benefits");
  const dots = enabled("slider_dots");

  const titleSize = (title?.props?.size as string) ?? "L";
  const titleClass = compact
    ? "text-[2.1rem]"
    : titleSize === "S"
      ? "text-4xl lg:text-5xl"
      : titleSize === "M"
        ? "text-5xl lg:text-6xl"
        : "text-5xl lg:text-7xl";

  const alignItems = align === "center" ? "items-center" : align === "right" ? "items-end" : "items-start";
  const justify = align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start";
  const overlayDir = align === "left" ? "to right" : align === "right" ? "to left" : "to top";

  const sections = (Array.isArray(layout.sections) ? layout.sections : []).filter((s) => s.enabled).sort((a, b) => a.order - b.order);
  const featured = products.slice(0, 4);

  return (
    <div className="w-full overflow-hidden">
      {/* ======================= BANNER ======================= */}
      <section
        className="relative w-full overflow-hidden bg-[#1d1310]"
        style={{
          aspectRatio: `${compact ? Math.max(0.95, bAspect - 1.6) : device === "tablet" ? Math.max(1.5, bAspect - 0.7) : bAspect}`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bImage}
          alt="Banner Coralina"
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* overlay direccional sobre la zona de CONTENIDO */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(${overlayDir}, rgba(18,10,7,${Math.min(0.92, bOverlay + 0.42)}) 0%, rgba(18,10,7,${Math.min(0.75, bOverlay + 0.16)}) ${align === "center" ? "62%" : "44%"}, rgba(18,10,7,0) ${align === "center" ? "100%" : "78%"})`,
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-1/3"
          style={{ background: "linear-gradient(to top, rgba(18,10,7,.55), transparent)" }}
        />
        <SeaBackdrop className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 w-full text-white/25" />
        <CoralFan
          className={`floaty pointer-events-none absolute ${align === "right" ? "left-6" : "right-6"} top-8 hidden h-40 w-40 text-white/12 lg:block`}
        />

        <div className={`absolute inset-0 px-5 pb-16 pt-8 md:px-10 ${benefits ? "md:pb-20" : "md:pb-10"}`}>
          <div className={`mx-auto grid h-full max-w-[1400px] grid-cols-12 content-center gap-x-3 ${alignItems}`}>
            {kicker && (
              <div style={colStyle(kicker, compact)} className="rise mb-3 text-white/90">
                <span className={`inline-flex items-center gap-2.5 ${justify}`}>
                  <WaveStrip className="h-2.5 w-10 text-[var(--color-accent)]" />
                  <span className="kicker">{String(kicker.props.text ?? "")}</span>
                </span>
              </div>
            )}

            {title && (
              <h1
                style={{ ...colStyle(title, compact), animationDelay: "80ms" }}
                className={`rise hero-title text-white ${titleClass}`}
              >
                {String(title.props.text ?? "")}
              </h1>
            )}

            {subtitle && (
              <p
                style={{ ...colStyle(subtitle, compact), animationDelay: "160ms" }}
                className={`rise mt-4 max-w-[34rem] leading-relaxed text-white/85 ${compact ? "text-[0.92rem]" : "text-base lg:text-lg"} ${align === "center" ? "mx-auto" : align === "right" ? "ml-auto" : ""}`}
              >
                {String(subtitle.props.text ?? "")}
              </p>
            )}

            {(cta1 || cta2) && (
              <div
                style={{ ...(cta1 ? colStyle(cta1, compact) : cta2 ? colStyle(cta2, compact) : {}), animationDelay: "240ms" }}
                className={`rise mt-7 flex flex-wrap items-center gap-3 ${justify}`}
              >
                {cta1 && (
                  <Link href={resolveHref(String(cta1.props.link ?? ""))} className="btn-primary text-sm">
                    {String(cta1.props.label ?? "Comprar")}
                    <span aria-hidden>→</span>
                  </Link>
                )}
                {cta2 && (
                  <Link href={resolveHref(String(cta2.props.link ?? ""))} className="btn-ghost text-sm text-white">
                    {String(cta2.props.label ?? "Ver más")}
                  </Link>
                )}
              </div>
            )}

            {dots && (
              <div
                style={colStyle(dots, compact)}
                className={`mt-7 flex items-center gap-3 ${justify}`}
              >
                {["01", "02", "03"].map((d, i) => (
                  <span key={d} className="flex items-center gap-2">
                    <span className={`mono text-[0.66rem] tracking-widest ${i === 0 ? "text-white" : "text-white/40"}`}>
                      {d}
                    </span>
                    <span className={`h-px transition-all ${i === 0 ? "w-8 bg-white" : "w-4 bg-white/30"}`} />
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {!compact && (
          <ScrollCue
            className={`absolute ${benefits ? "bottom-16" : "bottom-6"} left-1/2 hidden h-9 -translate-x-1/2 text-white/55 lg:block`}
          />
        )}

        {benefits && (
          <div className="absolute inset-x-0 bottom-0 border-t border-white/15 bg-[#120a07]/45 backdrop-blur-md">
            <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-center gap-x-10 gap-y-1.5 px-5 py-3 text-white/90">
              {((benefits.props.items as { icon: string; text: string }[]) ?? []).map((item, i) => {
                const Icon = BENEFIT_ICONS[item.icon] ?? BENEFIT_ICONS.wave;
                return (
                  <span key={i} className="flex items-center gap-2.5 text-[0.74rem] tracking-wide">
                    <Icon className="h-4 w-4 text-[var(--color-surface-warm)]" />
                    {item.text}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ======================= MARQUEE ======================= */}
      <div className="overflow-hidden border-y border-[var(--color-line)] bg-[var(--color-ink)] py-2.5 text-[var(--color-surface-base)]">
        <div className="marquee-track">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex shrink-0 items-center gap-12 pr-12">
              {["Envío gratis desde $250.000", "Tela italiana UV50+", "Cambio de talla sin costo", "Hecho a mano en Cartagena", "Tallaje real verificado"].map(
                (t) => (
                  <span key={t} className="flex items-center gap-3 text-[0.68rem] tracking-[0.22em] uppercase">
                    <WaveLine className="h-2.5 w-8 text-[var(--color-accent)]" />
                    {t}
                  </span>
                ),
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ======================= SECCIONES ======================= */}
      {sections.map((s) => {
        if (s.type === "categories") {
          return (
            <section key={s.id} className="bg-[var(--color-surface-base)] px-5 py-16 md:px-10 md:py-20">
              <div className="mx-auto max-w-[1400px]">
                <SectionHeading
                  kicker="Colección"
                  title={String(s.props.title ?? "Explora por categoría")}
                  lead="Cada silueta está pensada para un cuerpo real y un plan distinto."
                />
                <div className={`mt-12 grid gap-5 ${compact ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-4"}`}>
                  {categories.slice(0, 4).map((c, i) => (
                    <Link
                      key={c.id}
                      href={resolveHref(`category:${c.slug}`)}
                      className="lift group relative block overflow-hidden rounded-[1.4rem]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={c.imageUrl}
                        alt={c.name}
                        className="h-[22rem] w-full object-cover transition duration-[900ms] group-hover:scale-[1.07]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                      <span className="mono absolute left-4 top-4 text-[0.66rem] tracking-[0.2em] text-white/70">
                        0{i + 1}
                      </span>
                      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                        <p className="font-display text-2xl">{c.name}</p>
                        <p className="mt-1 line-clamp-2 text-[0.72rem] leading-relaxed text-white/70">
                          {c.description}
                        </p>
                        <span className="mt-3 inline-flex items-center gap-2 text-[0.66rem] tracking-[0.22em] uppercase">
                          Ver piezas
                          <span className="inline-block h-px w-7 bg-[var(--color-accent)] transition-all duration-500 group-hover:w-12" />
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          );
        }

        if (s.type === "featured") {
          return (
            <section key={s.id} className="relative bg-[var(--color-surface-warm)]/45 px-5 pb-20 pt-16 md:px-10">
              <WaveDivider className="absolute inset-x-0 top-0 h-10" flip color="var(--color-surface-base)" />
              <div className="mx-auto max-w-[1400px] pt-8">
                <SectionHeading
                  kicker="Best sellers"
                  title={String(s.props.title ?? "Lo más deseado")}
                  lead="Las piezas que más vuelven a casa con nuestras clientas."
                />
                <div className={`mt-12 grid gap-6 ${compact ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4"}`}>
                  {featured.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
                <div className="mt-12 text-center">
                  <Link href="/coleccion" className="btn-primary text-sm">
                    Ver toda la colección <span aria-hidden>→</span>
                  </Link>
                </div>
              </div>
            </section>
          );
        }

        if (s.type === "editorial") {
          return (
            <section key={s.id} className="bg-[var(--color-surface-base)] px-5 py-16 md:px-10 md:py-24">
              <div className={`mx-auto grid max-w-[1400px] items-center gap-12 ${compact ? "" : "lg:grid-cols-2"}`}>
                <div className="relative">
                  <div className="overflow-hidden rounded-[1.6rem]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="https://images.pexels.com/photos/32689360/pexels-photo-32689360.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=760&w=1000"
                      alt="Taller Coralina"
                      className="h-[26rem] w-full object-cover"
                    />
                  </div>
                  <div className="absolute -bottom-6 -right-3 hidden rounded-2xl bg-[var(--color-primary)] px-5 py-4 text-white shadow-xl lg:block">
                    <p className="font-display text-3xl leading-none">100%</p>
                    <p className="mt-1 text-[0.62rem] tracking-[0.18em] uppercase opacity-85">
                      Hecho a mano
                      <br />
                      en Colombia
                    </p>
                  </div>
                </div>
                <div>
                  <span className="kicker text-[var(--color-primary)]">Nuestro taller</span>
                  <h3 className="font-display mt-3 text-4xl leading-tight lg:text-5xl">
                    {String(s.props.title ?? "Hecho para el agua")}
                  </h3>
                  <WaveLine className="mt-4 h-3 w-24 text-[var(--color-accent)]" />
                  <p className="mt-5 max-w-lg text-[0.95rem] leading-relaxed text-[var(--color-ink)]/75">
                    Tela italiana con doble forro, resistente al cloro y al bronceador. Cada pieza se corta y
                    cose en nuestro taller en Cartagena: tallaje real, costuras planas y secado rápido.
                  </p>
                  <ul className="mt-7 space-y-4">
                    {[
                      { Icon: ShellIcon, t: "Tallaje real", d: "Tabla de medidas propia por categoría, verificada en probador." },
                      { Icon: CoralIcon, t: "Protección UV50+", d: "Tela italiana de secado rápido que no se estira con el mar." },
                      { Icon: StarfishIcon, t: "Cambio sin costo", d: "Cambia la talla durante los primeros 15 días, sin preguntas." },
                    ].map(({ Icon, t, d }) => (
                      <li key={t} className="flex gap-4">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--color-surface-warm)]/60">
                          <Icon className="h-6 w-6 text-[var(--color-primary)]" />
                        </span>
                        <span>
                          <span className="block text-sm font-medium">{t}</span>
                          <span className="block text-[0.82rem] leading-relaxed opacity-65">{d}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          );
        }

        if (s.type === "testimonials") {
          return (
            <section key={s.id} className="bg-[var(--color-surface-warm)]/35 px-5 py-16 md:px-10 md:py-20">
              <div className="mx-auto max-w-[1400px]">
                <SectionHeading kicker="Ellas ya lo usan" title="Amor por Coralina" lead="4.9 / 5 sobre 320 reseñas verificadas." />
                <div className={`mt-12 grid gap-5 ${compact ? "grid-cols-1" : "md:grid-cols-3"}`}>
                  {[
                    { n: "Valentina R.", c: "Cartagena", t: "El enterizo me quedó perfecto según la tabla de tallas. No se transparenta y aguantó todo el viaje." },
                    { n: "Mariana O.", c: "Medellín", t: "Pedí un combo de dos piezas y llegó en tres días. La tela es otro nivel, no se deforma." },
                    { n: "Daniela G.", c: "Bogotá", t: "Me cambiaron la talla sin drama. El bikini no se estira después del mar y el color sigue intacto." },
                  ].map((x) => (
                    <figure key={x.n} className="card-soft flex h-full flex-col p-6">
                      <div className="flex gap-1 text-[var(--color-accent)]">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <StarfishIcon key={i} className="h-3.5 w-3.5" />
                        ))}
                      </div>
                      <blockquote className="mt-4 flex-1 text-[0.9rem] leading-relaxed text-[var(--color-ink)]/80">
                        “{x.t}”
                      </blockquote>
                      <figcaption className="mt-5 flex items-center gap-3 border-t border-[var(--color-line)] pt-4">
                        <span className="font-display grid h-10 w-10 place-items-center rounded-full bg-[var(--color-surface-warm)] text-sm">
                          {x.n.charAt(0)}
                        </span>
                        <span>
                          <span className="block text-xs font-medium">{x.n}</span>
                          <span className="block text-[0.68rem] opacity-55">{x.c} · compra verificada</span>
                        </span>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            </section>
          );
        }

        if (s.type === "newsletter") {
          return (
            <section
              key={s.id}
              className="relative overflow-hidden bg-[var(--color-primary)] px-5 py-20 text-white md:px-10"
            >
              <SeaBackdrop className="absolute inset-0 h-full w-full text-white/30" />
              <CoralFan className="floaty absolute -left-10 -bottom-16 h-64 w-64 text-white/10" />
              <div className="relative mx-auto max-w-2xl text-center">
                <WaveBadge className="mx-auto h-11 w-11 text-[var(--color-surface-warm)]" />
                <h3 className="font-display mt-5 text-4xl leading-tight md:text-5xl">Primera en enterarte</h3>
                <p className="mt-3 text-sm text-white/85">
                  Nuevos drops, preventas privadas y 10% en tu primera compra.
                </p>
                <form
                  className="mx-auto mt-7 flex max-w-md flex-col gap-3 sm:flex-row"
                  onSubmit={(e) => e.preventDefault()}
                >
                  <input
                    type="email"
                    placeholder="tu@correo.com"
                    className="flex-1 rounded-full bg-white/95 px-5 py-3.5 text-sm text-[var(--color-ink)] outline-none"
                  />
                  <button className="rounded-full bg-[var(--color-ink)] px-7 py-3.5 text-sm font-medium transition hover:bg-black">
                    Suscribirme
                  </button>
                </form>
                <p className="mt-3 text-[0.68rem] text-white/60">Sin spam. Cancela cuando quieras.</p>
              </div>
            </section>
          );
        }

        return (
          <footer key={s.id} className="bg-[var(--color-ink)] px-5 pb-8 pt-16 text-[var(--color-surface-base)] md:px-10">
            <div className={`mx-auto grid max-w-[1400px] gap-10 ${compact ? "" : "md:grid-cols-4"}`}>
              <div>
                <span className="font-display text-3xl">Coralina</span>
                <p className="mt-3 max-w-xs text-[0.78rem] leading-relaxed opacity-65">
                  Swimwear tropical–elegante hecho a mano en Colombia. Envíos a todo el país en 2 a 4 días
                  hábiles.
                </p>
                <div className="mt-5 flex gap-2">
                  {["IG", "TK", "WA"].map((s2) => (
                    <span
                      key={s2}
                      className="grid h-9 w-9 place-items-center rounded-full border border-white/20 text-[0.62rem] tracking-widest"
                    >
                      {s2}
                    </span>
                  ))}
                </div>
              </div>
              <FooterCol
                title="Tienda"
                items={
                  categories.length > 0
                    ? categories.map((c) => ({ label: c.name, href: resolveHref(`category:${c.slug}`) }))
                    : [{ label: "Colección", href: resolveHref("collection") }]
                }
              />
              <FooterCol
                title="Ayuda"
                items={["Guía de tallas", "Envíos y cambios", "Cuidado de la prenda", "Contacto"].map((label) => ({ label }))}
              />
              <FooterCol
                title="Legal"
                items={["Términos", "Privacidad", "Devoluciones"].map((label) => ({ label }))}
              />
            </div>
            <WaveStrip className="mx-auto mt-12 h-3 max-w-[1400px] text-white/15" />
            <div className="mx-auto mt-5 flex max-w-[1400px] flex-wrap items-center justify-between gap-2 text-[0.68rem] opacity-55">
              <span>© {new Date().getFullYear()} Coralina Store</span>
              <span>Hecho con mar y sol · Cartagena, CO</span>
            </div>
          </footer>
        );
      })}
    </div>
  );
}

function FooterCol({ title, items }: { title: string; items: { label: string; href?: string }[] }) {
  return (
    <div>
      <p className="kicker opacity-80">{title}</p>
      <ul className="mt-4 space-y-2.5 text-[0.8rem] opacity-70">
        {items.map((it) => (
          <li key={it.href ?? it.label}>
            {it.href ? (
              <Link href={it.href} className="transition hover:text-[var(--color-accent)] hover:opacity-100">
                {it.label}
              </Link>
            ) : (
              <span>{it.label}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SectionHeading({
  kicker,
  title,
  lead,
}: {
  kicker: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="text-center">
      <span className="kicker text-[var(--color-primary)]">{kicker}</span>
      <h2 className="font-display mt-3 text-4xl leading-tight md:text-5xl">{title}</h2>
      <WaveLine className="mx-auto mt-4 h-3 w-24 text-[var(--color-accent)]" />
      {lead && <p className="mx-auto mt-4 max-w-md text-[0.88rem] leading-relaxed opacity-65">{lead}</p>}
    </div>
  );
}

export function ProductCard({ product }: { product: HomeProduct }) {
  const off =
    product.compareAtCents && product.compareAtCents > product.priceCents
      ? Math.round(100 - (product.priceCents / product.compareAtCents) * 100)
      : 0;
  const soldOut = product.totalStock === 0;

  return (
    <Link href={`/producto/${product.handle}`} className="group block">
      <div className="relative overflow-hidden rounded-[1.2rem] bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.images[0]}
          alt={product.title}
          className={`h-[23rem] w-full object-cover transition duration-[900ms] group-hover:scale-[1.06] ${soldOut ? "opacity-70 grayscale-[35%]" : ""}`}
        />
        <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-10 transition-transform duration-500 group-hover:translate-y-0">
          <span className="flex items-center justify-center gap-2 text-[0.68rem] tracking-[0.2em] text-white uppercase">
            Ver producto <span aria-hidden>→</span>
          </span>
        </div>
        {off > 0 && !soldOut && (
          <span className="chip absolute left-3 top-3 bg-[var(--color-primary)] text-white">−{off}%</span>
        )}
        {soldOut && <span className="chip absolute left-3 top-3 bg-[var(--color-ink)] text-white">Agotado</span>}
        {!soldOut && product.totalStock <= 6 && (
          <span className="chip absolute right-3 top-3 bg-white/90 text-[var(--color-primary)]">
            Últimas {product.totalStock}
          </span>
        )}
      </div>
      <div className="mt-3.5">
        <p className="text-[0.62rem] tracking-[0.2em] uppercase text-[var(--color-ink)]/45">
          {product.categoryName}
        </p>
        <h3 className="mt-1.5 text-[0.92rem] leading-snug font-medium transition group-hover:text-[var(--color-primary)]">
          {product.title}
        </h3>
        <p className="mt-1.5 flex items-center gap-2">
          <span className="text-[0.95rem] font-semibold text-[var(--color-primary)]">
            {formatCOP(product.priceCents)}
          </span>
          {product.compareAtCents && (
            <span className="text-[0.78rem] line-through opacity-40">{formatCOP(product.compareAtCents)}</span>
          )}
        </p>
      </div>
    </Link>
  );
}
