/* Vectores SVG propios inspirados en el mar — marca Coralina */

type P = { className?: string };

export function LogoMark({ className = "w-9 h-9" }: P) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <circle cx="24" cy="24" r="22" fill="var(--ct-primary, #C9643C)" />
      <circle cx="24" cy="19" r="7" fill="var(--ct-accent, #E8A44A)" />
      <path d="M8 28c4-3 8-3 12 0s8 3 12 0 8-3 8 0" stroke="#FAF3E4" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M10 34c3.5-2.5 7-2.5 10.5 0s7 2.5 10.5 0 6-2.5 7 0" stroke="#FAF3E4" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

export function WaveIcon({ className = "w-5 h-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className} aria-hidden>
      <path d="M3 10c3-2.4 6-2.4 9 0s6 2.4 9 0" />
      <path d="M3 15c3-2.4 6-2.4 9 0s6 2.4 9 0" opacity="0.6" />
      <path d="M5 20c2.5-2 5-2 7.5 0" opacity="0.35" />
    </svg>
  );
}

export function ShellIcon({ className = "w-5 h-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className={className} aria-hidden>
      <path d="M12 21C6.5 21 3 17 3 12.5 3 8 7.5 4 12 4s9 4 9 8.5C21 17 17.5 21 12 21Z" />
      <path d="M12 21V4M12 21l-5.5-16M12 21l5.5-16M12 21L6.5 7.5M12 21l5.5-13.5" opacity="0.75" />
      <path d="M9 21h6" strokeWidth="2.2" />
    </svg>
  );
}

export function StarfishIcon({ className = "w-5 h-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2.5c.6 2.6 1.3 4.6 2.4 5.9 1 1.2 2.8 1.9 5.1 2.3-2.3.7-4 1.5-5 2.7-1.1 1.3-1.6 3.2-1.9 5.6-.5-2.4-1.2-4.3-2.3-5.6-1.1-1.2-2.8-2-5.3-2.7 2.5-.4 4.3-1.1 5.4-2.3C11.5 7.1 12 5 12 2.5Z" />
      <circle cx="10.7" cy="9.6" r="0.55" opacity="0.5" />
      <circle cx="13.4" cy="11.8" r="0.55" opacity="0.5" />
      <circle cx="11.2" cy="14.2" r="0.55" opacity="0.5" />
    </svg>
  );
}

export function FishIcon({ className = "w-5 h-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M4 12c2.5-3.5 6-5.5 10-5.5 2.8 0 5.2 2.2 6.5 5.5-1.3 3.3-3.7 5.5-6.5 5.5-4 0-7.5-2-10-5.5Z" />
      <path d="M20 8.5 23 6v12l-3-2.5" opacity="0.7" />
      <circle cx="8" cy="11" r="0.9" fill="currentColor" stroke="none" />
      <path d="M13.5 7.5c1 2 1 7 0 9" opacity="0.5" />
    </svg>
  );
}

export function CoralIcon({ className = "w-5 h-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className} aria-hidden>
      <path d="M12 21V10M12 10c0-3 1.5-5 4.5-6.5 0 3.5-1 5.5-4.5 6.5Z" />
      <path d="M12 13c-1-2.5-3-4-6-4.5.5 2.5 2 4 6 4.5Z" opacity="0.8" />
      <path d="M9 21h6" strokeWidth="2.2" />
      <path d="M16.5 12.5c1.5-.5 2.5-1.5 3-3.5-1.8.2-3 1-3 3.5Z" opacity="0.6" />
    </svg>
  );
}

export function BubblesIcon({ className = "w-5 h-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden>
      <circle cx="9" cy="14" r="4.5" />
      <circle cx="17" cy="8" r="3" opacity="0.7" />
      <circle cx="16" cy="17" r="1.8" opacity="0.45" />
      <circle cx="6" cy="6" r="1.2" opacity="0.5" />
    </svg>
  );
}

export function SeagullIcon({ className = "w-5 h-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className={className} aria-hidden>
      <path d="M3 10c2.5-2.5 5-2.5 7.5 0" />
      <path d="M13.5 8.5c2-2 4-2 6.5 0" opacity="0.6" />
      <path d="M6 15.5c1.8-1.8 3.8-1.8 5.6 0" opacity="0.4" />
    </svg>
  );
}

export function SunIcon({ className = "w-5 h-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" opacity="0.8" />
    </svg>
  );
}

export function BagIcon({ className = "w-5 h-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M6 8h12l-1 12a2 2 0 0 1-2 1.8H9A2 2 0 0 1 7 20L6 8Z" />
      <path d="M9 10V6a3 3 0 0 1 6 0v4" />
    </svg>
  );
}

export function ArrowIcon({ className = "w-4 h-4" }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  );
}

/** Divider de ola full-width entre secciones */
export function WaveDivider({ className = "text-sand", flip = false }: P & { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 1440 56"
      preserveAspectRatio="none"
      className={`block w-full h-8 md:h-12 ${className} ${flip ? "rotate-180" : ""}`}
      aria-hidden
    >
      <path
        d="M0 28c120-18 240-18 360 0s240 18 360 0 240-18 360 0 240 18 360 0v28H0Z"
        fill="currentColor"
        opacity="0.35"
      />
      <path
        d="M0 36c120-14 240-14 360 0s240 14 360 0 240-14 360 0 240 14 360 0V56H0Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Patrón de burbujas decorativo para fondos */
export function BubblesPattern({ className = "" }: P) {
  return (
    <svg className={`pointer-events-none absolute inset-0 w-full h-full opacity-[0.12] ${className}`} aria-hidden>
      <defs>
        <pattern id="bub" width="90" height="70" patternUnits="userSpaceOnUse">
          <circle cx="20" cy="20" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="62" cy="48" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="75" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#bub)" />
    </svg>
  );
}

/** Silueta para la guía de zona de modelo (dashboard) */
export function ModelSilhouette({ className = "" }: P) {
  return (
    <svg viewBox="0 0 40 80" fill="currentColor" className={className} aria-hidden>
      <circle cx="20" cy="9" r="6.5" />
      <path d="M20 17c-6 0-9 4-9.5 9L8.5 38c-.3 4 1.5 6 4 6l2 .3-1.5 17c-.3 3 1.2 5.7 3.4 7.2 1.4.9 3.1 1.4 4.6 1.4h3c6.3 0 11.5-5 12-11.3l1-20.3c.2-2.5-1.7-4-3.7-4l-1.8.1 1-11.1C32 21 26 17 20 17Z" />
    </svg>
  );
}
