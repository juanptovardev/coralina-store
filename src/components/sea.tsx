import type { SVGProps } from "react";

/* Vectores inspirados en el mar — trazo orgánico, femenino, minimalista. */

export function WaveDivider({
  className = "",
  flip = false,
  color = "var(--color-surface-warm)",
}: {
  className?: string;
  flip?: boolean;
  color?: string;
}) {
  return (
    <svg
      viewBox="0 0 1440 90"
      preserveAspectRatio="none"
      className={className}
      style={{ transform: flip ? "scaleY(-1)" : undefined, display: "block", width: "100%" }}
      aria-hidden
    >
      <path
        d="M0,52 C120,88 240,88 360,62 C480,36 600,8 720,20 C840,32 960,84 1080,86 C1200,88 1320,50 1440,34 L1440,90 L0,90 Z"
        fill={color}
        opacity="0.9"
      />
      <path
        d="M0,68 C160,92 300,64 460,54 C620,44 760,62 900,72 C1040,82 1200,72 1440,52 L1440,90 L0,90 Z"
        fill={color}
      />
    </svg>
  );
}

export function WaveLine({ className = "", ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 120 14" fill="none" className={className} aria-hidden {...rest}>
      <path
        d="M1 7c5-6 10-6 15 0s10 6 15 0 10-6 15 0 10 6 15 0 10-6 15 0 10 6 15 0 10-6 14 0"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CoralIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <path
        d="M24 44V26M24 26c0-5 4-8 4-13 0-3-2-5-4-5s-4 2-4 5c0 5 4 8 4 13Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M24 34c-4-1-7-4-8-9-.6-3-3-5-5-4s-2 4-.5 6c2.6 3.4 4 7 4.5 11M24 34c4-1 7-4 8-9 .6-3 3-5 5-4s2 4 .5 6c-2.6 3.4-4 7-4.5 11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="24" cy="10" r="2" fill="currentColor" />
    </svg>
  );
}

export function ShellIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <path
        d="M24 41c-9 0-17-7.6-17-17S15 7 24 7s17 7.6 17 17-8 17-17 17Z"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity=".25"
      />
      <path
        d="M24 41C16 34 11 28 11 21c0-7 6-12 13-12s13 5 13 12c0 7-5 13-13 20Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M24 9v32M17 12c-1 9 1 18 4 25M31 12c1 9-1 18-4 25" stroke="currentColor" strokeWidth="1.3" opacity=".7" />
    </svg>
  );
}

export function StarfishIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <path
        d="M24 5.5 30 19l14.5 1.5-10.8 9.6 3.1 14.2L24 37l-12.8 7.3 3.1-14.2L3.5 20.5 18 19 24 5.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="24" r="2.2" fill="currentColor" opacity=".55" />
    </svg>
  );
}

export function SeaweedIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <path
        d="M19 44c0-10-6-13-6-21 0-6 3-11 6-14M29 44c0-10 6-13 6-21 0-6-3-11-6-14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M24 44V16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M24 26c4-1 6-4 6-8M24 32c-4-1-6-4-6-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function SunIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <circle cx="24" cy="24" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M24 3v6M24 39v6M45 24h-6M9 24H3M38.8 9.2l-4.2 4.2M13.4 34.6l-4.2 4.2M38.8 38.8l-4.2-4.2M13.4 13.4 9.2 9.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export const BENEFIT_ICONS: Record<string, (p: { className?: string }) => React.ReactElement> = {
  wave: (p) => <WaveLine className={p.className} />,
  shell: (p) => <ShellIcon className={p.className} />,
  coral: (p) => <CoralIcon className={p.className} />,
  star: (p) => <StarfishIcon className={p.className} />,
  sun: (p) => <SunIcon className={p.className} />,
};

/** Isologotipo: coral dentro de círculo. */
export function CoralinaMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden>
      <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="1.4" opacity=".35" />
      <path
        d="M32 52V34m0 0c0-6 5-9 5-15 0-4-2.3-6-5-6s-5 2-5 6c0 6 5 9 5 15Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M32 44c-5-1.4-8.6-5-9.8-11-.7-3.6-3.6-6-6-4.8-2.4 1.2-2.4 4.8-.6 7.2M32 44c5-1.4 8.6-5 9.8-11 .7-3.6 3.6-6 6-4.8 2.4 1.2 2.4 4.8.6 7.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Imagotipo: símbolo + wordmark. */
export function CoralinaLogo({ className = "", tone = "currentColor" }: { className?: string; tone?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`} style={{ color: tone }}>
      <CoralinaMark className="h-8 w-8" />
      <span className="leading-none">
        <span className="font-display block text-xl tracking-tight">Coralina</span>
        <span className="block text-[0.55rem] tracking-[0.42em] uppercase opacity-70">Swimwear</span>
      </span>
    </span>
  );
}

/** Eje del espejo vertical de la banda de olas (anclajes y=300/330/360 → centro 315; el espejo es y' = 2·315 − y). */
const BACKDROP_MIRROR_Y = 315;

/**
 * Fondo decorativo de burbujas / ondas suaves.
 * `flip` espeja SOLO la banda de olas sobre su propio eje (`BACKDROP_MIRROR_Y`),
 * manteniéndola en la mitad inferior; los círculos decorativos quedan donde están.
 * No usar `scaleY(-1)` en el `<svg>` raíz: espejaría el viewBox completo sobre y=200
 * y desplazaría la banda a la mitad superior (distinto de WaveStrip/WaveDivider,
 * cuyo `<svg>` es toda la figura).
 */
export function SeaBackdrop({ className = "", flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg viewBox="0 0 800 400" className={className} fill="none" aria-hidden>
      {/* flip espeja solo las olas; los círculos quedan como están */}
      <g transform={flip ? `translate(0 ${BACKDROP_MIRROR_Y * 2}) scale(1 -1)` : undefined}>
        <path d="M-20 300c120-40 200 40 320 10s180-90 300-70 220 80 220 80" stroke="currentColor" strokeWidth="1" opacity=".3" />
        <path d="M-20 330c120-40 200 40 320 10s180-90 300-70 220 80 220 80" stroke="currentColor" strokeWidth="1" opacity=".22" />
        <path d="M-20 360c120-40 200 40 320 10s180-90 300-70 220 80 220 80" stroke="currentColor" strokeWidth="1" opacity=".14" />
      </g>
      <circle cx="120" cy="90" r="26" stroke="currentColor" strokeWidth="1" opacity=".25" />
      <circle cx="660" cy="130" r="42" stroke="currentColor" strokeWidth="1" opacity=".2" />
      <circle cx="420" cy="60" r="14" stroke="currentColor" strokeWidth="1" opacity=".3" />
    </svg>
  );
}

/** Marco de olas concéntricas para encabezados de sección. */
export function WaveBadge({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="1" opacity=".3" />
      <path d="M8 26c4-5 8-5 12 0s8 5 12 0 6-4 8-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M10 32c4-5 8-5 12 0s8 5 12 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".6" />
    </svg>
  );
}

/** Rama de coral abanico, decorativa y grande. */
export function CoralFan({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" className={className} aria-hidden>
      <path d="M100 195V120" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path
        d="M100 120c0-22-18-34-18-58 0-14 8-22 18-22s18 8 18 22c0 24-18 36-18 58Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M100 150c-18-4-30-16-34-38-3-15-14-24-24-19s-10 20-3 29c10 13 16 27 18 42M100 150c18-4 30-16 34-38 3-15 14-24 24-19s10 20 3 29c-10 13-16 27-18 42"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="100" cy="42" r="4" fill="currentColor" opacity=".5" />
      <circle cx="46" cy="104" r="3" fill="currentColor" opacity=".35" />
      <circle cx="154" cy="104" r="3" fill="currentColor" opacity=".35" />
    </svg>
  );
}

/** Indicador de scroll con gota. */
export function ScrollCue({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 44" fill="none" className={className} aria-hidden>
      <rect x="1" y="1" width="22" height="34" rx="11" stroke="currentColor" strokeWidth="1.3" opacity=".7" />
      <circle cx="12" cy="11" r="3" fill="currentColor">
        <animate attributeName="cy" values="11;22;11" dur="2.2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;.2;1" dur="2.2s" repeatCount="indefinite" />
      </circle>
      <path d="M8 39l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}

/** Tira de olas finas para franjas y separadores. `flip` espeja la tira completa (SVG centrado en y=6: cambia la fase, no la posición). */
export function WaveStrip({ className = "", flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 400 12"
      preserveAspectRatio="none"
      fill="none"
      className={className}
      style={flip ? { transform: "scaleY(-1)" } : undefined}
      aria-hidden
    >
      <path d="M0 6c20-6 40-6 60 0s40 6 60 0 40-6 60 0 40 6 60 0 40-6 60 0 40 6 60 0" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
