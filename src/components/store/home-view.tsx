import { db } from "@/db";
import { eq } from "drizzle-orm";
import { homeLayouts } from "@/db/schema";
import { Banner } from "./banner";
import { NewsletterForm, type CatalogProduct } from "./shop";
import { BestSellers, ComboBuilder } from "./home-client";
import { resolveHref } from "@/lib/utils";
import { formatCOP } from "@/lib/constants";
import {
  ShellIcon,
  WaveIcon,
  SunIcon,
  CoralIcon,
  BubblesPattern,
  ArrowIcon,
  WaveDivider,
} from "./svgs";

function FallbackHero() {
  return (
    <section className="relative flex h-[70vh] min-h-[440px] items-center justify-center overflow-hidden bg-ink">
      <div className="absolute inset-0 bg-gradient-to-b from-terracotta/30 via-transparent to-ink/60" />
      <div className="relative flex flex-col items-center gap-5 px-6 text-center">
        <SunIcon className="h-10 w-10 text-amber-brand float-slow" />
        <h1 className="font-display text-4xl italic text-linen md:text-6xl">El mar se pone a la moda</h1>
        <p className="max-w-md text-sm font-light text-linen/75">
          Swimwear de corte limpio y colores de atardecer.
        </p>
        <a href="/coleccion" className="btn-primary">Comprar colección</a>
      </div>
    </section>
  );
}

/** Franja de valor inmediatamente bajo el hero (conversión) */
function ValueStrip() {
  const items = [
    { Icon: SunIcon, title: "Hecho en Colombia", text: "Confección local" },
    { Icon: WaveIcon, title: "Secado rápido", text: "Tela liviana para el agua" },
    { Icon: ShellIcon, title: "Guía de tallas", text: "Medidas por categoría antes de comprar" },
    { Icon: CoralIcon, title: "Pedido por WhatsApp", text: "Carrito y datos listos para enviar" },
  ];
  return (
    <section className="border-b border-ink/8">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-y-6 px-5 py-8 md:grid-cols-4 md:px-8">
        {items.map(({ Icon, title, text }) => (
          <div key={title} className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sand/60 text-terracotta">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-[0.72rem] text-ink/55">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CategoriesSection({
  categories,
  slugs,
  catalog,
}: {
  categories: { name: string; slug: string; description: string | null; icon: string }[];
  slugs: string[];
  catalog: CatalogProduct[];
}) {
  const list = categories.filter((c) => slugs.includes(c.slug));
  if (!list.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-terracotta">Encuentra tu pieza</p>
          <h2 className="mt-2 font-display text-3xl italic md:text-[2.6rem]">Compra por categoría</h2>
        </div>
        <a href="/coleccion" className="hidden items-center gap-2 text-sm font-semibold text-terracotta transition-all hover:gap-3 sm:flex">
          Ver la colección completa
        </a>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
        {list.map((c, i) => {
          const items = catalog.filter((p) => p.categorySlug === c.slug);
          const img = items.find((p) => p.featured)?.image ?? items[0]?.image ?? "https://images.pexels.com/photos/8371656/pexels-photo-8371656.jpeg?auto=compress&cs=tinysrgb&w=1200";
          const from = items.length ? Math.min(...items.map((p) => p.price)) : null;
          return (
            <a
              key={c.slug}
              href={`/coleccion?cat=${c.slug}`}
              className={`group relative overflow-hidden rounded-2xl bg-sand/40 fade-up ${i === 0 ? "col-span-2 md:col-span-1" : ""}`}
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <img src={img} alt={c.name} className={`w-full object-cover transition duration-700 group-hover:scale-105 ${i === 0 ? "aspect-[16/10] md:aspect-[4/5]" : "aspect-[4/5]"}`} />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
                <h3 className="font-display text-2xl italic text-linen md:text-3xl">{c.name}</h3>
                <p className="mt-0.5 text-xs text-linen/75">{c.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-sand">{items.length} piezas{from ? ` · desde ${formatCOP(from)}` : ""}</span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-linen text-terracotta transition group-hover:bg-[var(--ct-primary)] group-hover:text-white">
                    <ArrowIcon className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function EditorialSection({ data }: { data: any }) {
  return (
    <section className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
      <div className="grid items-center gap-10 md:grid-cols-2">
        <div className="relative overflow-hidden rounded-3xl">
          <img src={data?.image || "https://images.pexels.com/photos/8371656/pexels-photo-8371656.jpeg?auto=compress&cs=tinysrgb&w=1200"} alt="Editorial Coralina" className="aspect-[16/11] w-full object-cover" />
          <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
            {["UV50+", "Secado rápido", "Forro doble"].map((t) => (
              <span key={t} className="rounded-full bg-linen/90 px-3 py-1 text-[0.68rem] font-semibold text-terracotta">{t}</span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-terracotta">{data?.kicker || "Hecho para el oleaje"}</p>
          <h2 className="mt-3 font-display text-3xl italic leading-tight md:text-[2.6rem]">{data?.title || "Hecho para el agua"}</h2>
          <p className="mt-4 max-w-md text-sm font-light leading-relaxed text-ink/70">{data?.text}</p>
          <a href={resolveHref(data?.ctaLink || "collection")} className="btn-primary mt-7">
            {data?.ctaLabel || "Ver precios y tallas"}
          </a>
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection({ data }: { data: any }) {
  const items = (data?.items as { name: string; city: string; text: string }[]) || [];
  if (!items.length) return null;
  return (
    <section className="relative bg-sand/35 py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="flex flex-col items-center text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-terracotta">Directo de la orilla</p>
          <h2 className="mt-2 font-display text-3xl italic md:text-[2.6rem]">Lo que dice la marea</h2>
        </div>
        <div className="mt-10 flex snap-x gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((t, i) => (
            <figure key={i} className="card w-[82%] shrink-0 snap-start p-6 md:w-auto fade-up" style={{ animationDelay: `${i * 100}ms` }}>
              <blockquote className="font-display text-[1.08rem] italic leading-relaxed text-ink/85">“{t.text}”</blockquote>
              <figcaption className="mt-4 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-terracotta/15 text-xs font-bold text-terracotta-dark">
                  {t.name.slice(0, 1)}
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/55">
                  {t.name} · {t.city}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function NewsletterSection({ data }: { data: any }) {
  return (
    <section className="relative overflow-hidden py-16 md:py-24" style={{ background: "var(--ct-surface-warm)" }}>
      <BubblesPattern className="text-terracotta" />
      {[12, 30, 68, 85].map((left, i) => (
        <span key={left} className="bubble-up absolute bottom-0 h-3 w-3 rounded-full border border-terracotta/40" style={{ left: `${left}%`, animationDelay: `${i * 1.3}s` }} />
      ))}
      <div className="relative mx-auto flex max-w-2xl flex-col items-center px-5 text-center">
        <WaveIcon className="h-8 w-8 text-terracotta float-slow" />
        <h2 className="mt-4 font-display text-3xl italic md:text-[2.6rem]">{data?.title || "Novedades de Coralina"}</h2>
        <p className="mt-3 max-w-md text-sm font-light text-ink/70">
          {data?.text || "Aquí avisaremos las colecciones nuevas. Por ahora no hay una lista de correo activa."}
        </p>
        <div className="mt-6 flex w-full justify-center">
          <NewsletterForm />
        </div>
      </div>
    </section>
  );
}

export async function HomeView({
  catalog,
  categories,
  comboPromo,
  previewId,
}: {
  catalog: CatalogProduct[];
  categories: { name: string; slug: string; description: string | null; icon: string }[];
  comboPromo: { name: string; benefit: { kind: string; value: number }; code: string | null; endAt: string; comboPrice?: number } | null;
  previewId?: string;
}) {
  // Vista previa de borrador (PRD 7.3): renderiza con los mismos componentes que producción
  const rows = previewId
    ? await db.select().from(homeLayouts).where(eq(homeLayouts.id, Number(previewId)))
    : await db.select().from(homeLayouts).where(eq(homeLayouts.status, "active"));
  const layout = rows[0];
  if (!layout) return <FallbackHero />;
  const sections = (Array.isArray(layout.sections)
    ? (layout.sections as unknown as Array<{ type: string; enabled: boolean; data: Record<string, unknown> }>)
    : []
  ).filter((s) => s.enabled && s.type !== "footer");
  const previewLabel = previewId && layout.status !== "active" ? `Vista previa · ${layout.name} (borrador)` : undefined;

  return (
    <div>
      <Banner layout={layout as any} previewLabel={previewLabel} />
      <ValueStrip />
      {sections.map((s) => {
        switch (s.type) {
          case "categorias":
            return <CategoriesSection key={s.type} categories={categories} slugs={(s.data.slugs as string[]) || []} catalog={catalog} />;
          case "destacados":
            return <BestSellers key={s.type} catalog={catalog} />;
          case "combo":
            return (
              <div key={s.type}>
                <WaveDivider className="text-[var(--ct-surface-warm)]" />
                <ComboBuilder catalog={catalog} pct={comboPromo?.benefit.value ?? 15} comboPrice={comboPromo?.comboPrice} endAt={comboPromo?.endAt ?? null} data={s.data as any} />
                <WaveDivider className="text-[var(--ct-surface-warm)]" flip />
              </div>
            );
          case "editorial":
            return <EditorialSection key={s.type} data={s.data} />;
          case "testimonios":
            return <TestimonialsSection key={s.type} data={s.data} />;
          case "newsletter":
            return <NewsletterSection key={s.type} data={s.data} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
