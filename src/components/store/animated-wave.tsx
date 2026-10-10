/**
 * Ola animada del borde inferior del hero (SVG propio, color heredado vía
 * `currentColor`). El movimiento se hace con la clase `hero-wave` (definida en
 * globals.css) para que respete `prefers-reduced-motion`.
 */
import { cn } from "@/lib/utils";

export function AnimatedWave({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 80"
      preserveAspectRatio="none"
      aria-hidden
      className={cn("hero-wave absolute -bottom-px left-0 z-[5] h-10 w-[200%] md:h-16", className)}
    >
      <g>
        <path
          d="M0 40c120-26 240-26 360 0s240 26 360 0 240-26 360 0 240 26 360 0 240-26 360 0 240 26 360 0v40H0Z"
          fill="currentColor"
          opacity="0.45"
        />
        <path
          d="M0 52c120-20 240-20 360 0s240 20 360 0 240-20 360 0 240 20 360 0 240-20 360 0 240 20 360 0v28H0Z"
          fill="currentColor"
        />
      </g>
    </svg>
  );
}
