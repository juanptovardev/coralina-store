"use client";

import { useEffect, useState } from "react";
import { cn, resolveHref } from "@/lib/utils";
import { WaveIcon, StarfishIcon, ShellIcon, CoralIcon, FishIcon, BubblesIcon, ArrowIcon } from "./svgs";
import { AnimatedWave } from "./animated-wave";

export { resolveHref };

const BENEFIT_ICONS: Record<string, (p: { className?: string }) => React.ReactNode> = {
  wave: WaveIcon,
  star: StarfishIcon,
  shell: ShellIcon,
  coral: CoralIcon,
  fish: FishIcon,
  bubbles: BubblesIcon,
};

const TITLE_SIZES = {
  S: "text-[1.9rem] md:text-4xl",
  M: "text-[2.15rem] md:text-5xl",
  L: "text-[2.4rem] leading-[1.05] md:text-6xl lg:text-[4.3rem]",
};

type LayoutRow = {
  id: string;
  mode: string;
  banner: {
    slides: Array<{
      id: string; image: string; kicker: string; title: string; subtitle: string;
      ctaLabel: string; ctaLink: string; cta2Label: string; cta2Link: string; titleSize: "S" | "M" | "L";
    }>;
    aspect: number;
    overlay: number;
    textOn: "light" | "dark";
  };
  widgets: Record<string, any>;
};

/**
 * Banner horizontal con plano espacial (PRD §4):
 * zona de contenido por layout (A: col 0–5 · B: col 2–9 · C: col 6–11),
 * nunca invade la zona de modelo. Mobile-first: texto abajo con degradé.
 */
export function Banner({ layout, previewLabel }: { layout: LayoutRow; previewLabel?: string }) {
  const { widgets, mode } = layout;
  const b = layout.banner as unknown as { slides?: unknown[]; aspect?: number; aspectRatio?: number; overlay?: number; overlayOpacity?: number };
  const banner = {
    ...layout.banner,
    slides: (Array.isArray(b.slides) ? b.slides : []) as typeof layout.banner.slides,
    aspect: b.aspect ?? b.aspectRatio ?? 2.6,
    overlay: b.overlay ?? b.overlayOpacity ?? 0,
  };
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = banner.slides.length;

  useEffect(() => {
    if (n <= 1 || widgets.dots === false || paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % n), 6500);
    return () => clearInterval(t);
  }, [n, widgets.dots, paused]);

  const slide = banner.slides[Math.min(idx, n - 1)];
  if (!slide) return null;
  const isCenter = mode === "preset_center";
  const isRight = mode === "preset_right";
  const light = banner.textOn === "light";

  const zone = isCenter
    ? "md:col-span-8 md:col-start-3 md:text-center md:items-center"
    : isRight
      ? "md:col-span-5 md:col-start-8 md:text-right md:items-end"
      : "md:col-span-5 md:col-start-1 md:text-left md:items-start";

  const desktopGradient = isCenter
    ? "md:bg-gradient-to-b md:from-ink/50 md:via-ink/15 md:to-ink/55"
    : isRight
      ? "md:bg-gradient-to-l md:from-ink/65 md:via-ink/25 md:to-transparent"
      : "md:bg-gradient-to-r md:from-ink/65 md:via-ink/25 md:to-transparent";

  // En desktop, la posición de la foto respeta la zona de modelo; en mobile se enfoca al sujeto.
  const objectPos = isCenter ? "object-center" : isRight ? "object-[22%_center] md:object-center" : "object-[78%_center] md:object-center";

  const benefits = (widgets.benefits ?? []).filter((b: any) => b.on).slice(0, 3);

  return (
    <>
      <section
        className="relative w-full overflow-hidden bg-ink"
        style={{ height: `min(86vh, max(560px, calc(100vw / ${banner.aspect})))` }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        aria-roledescription="carrusel"
      >
        {banner.slides.map((s, i) => (
          <img
            key={s.id}
            src={s.image}
            alt={s.title}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-all duration-[1200ms]",
              objectPos,
              i === idx ? "scale-100 opacity-100" : "scale-105 opacity-0",
            )}
          />
        ))}

        {/* Overlay: mobile degradé inferior · desktop solo zona de contenido */}
        <div className={cn("absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/30 to-transparent", desktopGradient)} style={{ opacity: Math.min(1, 0.55 + banner.overlay) }} />
        <div className="absolute inset-0 bg-ink" style={{ opacity: banner.overlay * 0.25 }} />

        {previewLabel && (
          <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-amber-brand px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-ink shadow-lg">
            {previewLabel}
          </div>
        )}

        {/* Zona de contenido (plano 12 columnas) */}
        <div className="absolute inset-0 z-10">
          <div className="mx-auto grid h-full max-w-7xl grid-cols-1 content-end px-5 pb-20 md:grid-cols-12 md:content-center md:px-8 md:pb-0">
            <div key={slide.id} className={cn("fade-up col-span-1 flex flex-col gap-3 md:gap-5", zone)}>
              {widgets.kicker !== false && slide.kicker && (
                <p className={cn("flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.32em] md:text-xs", light ? "text-sand" : "text-ink/80", isCenter && "md:justify-center", isRight && "md:justify-end")}>
                  <span className="h-px w-8 bg-current opacity-60" /> {slide.kicker}
                </p>
              )}
              <h1 className={cn("font-display italic font-medium leading-[1.06] text-balance", light ? "text-linen" : "text-ink", TITLE_SIZES[slide.titleSize] ?? TITLE_SIZES.L)}>
                {slide.title}
              </h1>
              {widgets.subtitle !== false && slide.subtitle && (
                <p className={cn("max-w-md text-sm font-light leading-relaxed md:text-base", light ? "text-linen/85" : "text-ink/75", isCenter && "md:mx-auto", isRight && "md:ml-auto")}>
                  {slide.subtitle}
                </p>
              )}
              <div className={cn("mt-1 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center", isCenter && "md:justify-center", isRight && "md:justify-end")}>
                {widgets.ctaPrimary !== false && slide.ctaLabel && (
                  <a href={resolveHref(slide.ctaLink)} className="btn-primary !py-3.5 text-[0.9rem]">
                    {slide.ctaLabel} <ArrowIcon className="h-4 w-4" />
                  </a>
                )}
                {widgets.ctaSecondary !== false && slide.cta2Label && (
                  <a href={resolveHref(slide.cta2Link)} className={cn("btn-ghost !py-3", light ? "text-linen" : "text-ink")}>
                    {slide.cta2Label}
                  </a>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* Beneficios en el banner (desktop, franja Y 82–100) */}
        {benefits.length > 0 && (
          <div className="absolute bottom-14 left-0 right-0 z-10 hidden md:block">
            <div className="mx-auto max-w-7xl px-8">
              <div className={cn("inline-flex flex-wrap items-center gap-x-8 gap-y-2 rounded-2xl bg-ink/35 px-5 py-3 backdrop-blur-md", isRight && "float-right", isCenter && "relative left-1/2 -translate-x-1/2")}>
                {benefits.map((b: any, i: number) => {
                  const Ico = BENEFIT_ICONS[b.icon] ?? WaveIcon;
                  return (
                    <span key={i} className="flex items-center gap-2 text-[0.78rem] font-medium tracking-wide text-linen/95">
                      <Ico className="h-4 w-4 text-amber-brand" />
                      {b.text}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Indicadores (esquina de la zona de contenido) */}
        {n > 1 && widgets.dots !== false && (
          <div className={cn("absolute bottom-12 left-5 z-20 md:bottom-auto md:top-1/2 md:left-auto md:right-8 md:-translate-y-1/2", isRight && "md:left-8 md:right-auto")}>
            <div className="flex items-center gap-2.5 text-linen md:flex-col">
              {banner.slides.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setIdx(i)}
                  aria-label={`Ir al slide ${i + 1}`}
                  className={cn("rounded-full transition-all duration-300", i === idx ? "h-1.5 w-7 bg-amber-brand md:h-7 md:w-1.5" : "h-1.5 w-2.5 bg-linen/50 hover:bg-linen/80 md:h-2.5 md:w-1.5")}
                />
              ))}
              <span className="ml-1 font-display text-xs italic text-linen/70 md:ml-0 md:mt-1">0{idx + 1}/0{n}</span>
            </div>
          </div>
        )}

        <AnimatedWave className="text-[var(--ct-surface-base,#FAF3E4)]" />
      </section>

      {/* Beneficios bajo el banner (mobile) */}
      {benefits.length > 0 && (
        <div className="-mt-px border-b border-ink/8 bg-linen md:hidden">
          <div className="flex snap-x gap-5 overflow-x-auto px-5 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {benefits.map((b: any, i: number) => {
              const Ico = BENEFIT_ICONS[b.icon] ?? WaveIcon;
              return (
                <span key={i} className="flex shrink-0 snap-start items-center gap-2 text-xs font-medium text-ink/75">
                  <Ico className="h-4 w-4 text-terracotta" /> {b.text}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
