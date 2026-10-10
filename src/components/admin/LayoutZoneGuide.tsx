"use client";

import { LAYOUT_PLANE, type LayoutMode } from "@/lib/constants";

/** Diagrama del plano espacial: dónde va la modelo y dónde el texto. */
export function LayoutZoneGuide({ mode, className = "" }: { mode: LayoutMode; className?: string }) {
  const plane = LAYOUT_PLANE[mode];
  const colW = 100 / 12;
  const mx = (plane.modelZone[0] - 1) * colW;
  const mw = (plane.modelZone[1] - plane.modelZone[0] + 1) * colW;
  const cx = (plane.contentZone[0] - 1) * colW;
  const cw = (plane.contentZone[1] - plane.contentZone[0] + 1) * colW;

  return (
    <svg viewBox="0 0 100 34" className={className} aria-label={`Plano del layout ${plane.label}`}>
      <rect x="0" y="0" width="100" height="34" rx="1.5" fill="#fff" stroke="rgba(46,33,27,.18)" strokeWidth=".4" />
      {Array.from({ length: 11 }).map((_, i) => (
        <line
          key={i}
          x1={(i + 1) * colW}
          y1="0"
          x2={(i + 1) * colW}
          y2="34"
          stroke="rgba(46,33,27,.07)"
          strokeWidth=".25"
        />
      ))}
      {/* franjas Y */}
      {[5.1, 18.7, 25.5].map((y) => (
        <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="rgba(46,33,27,.06)" strokeWidth=".25" />
      ))}

      {/* zona contenido */}
      <rect x={cx} y="3" width={cw} height="28" fill="var(--color-accent)" opacity=".16" rx="1" />
      {/* zona modelo */}
      <rect x={mx} y="1.5" width={mw} height="31" fill="var(--color-primary)" opacity=".2" rx="1" />
      {/* silueta de modelo */}
      <g transform={`translate(${mx + mw / 2}, 6)`} fill="var(--color-primary)" opacity=".65">
        <circle cx="0" cy="3" r="2.3" />
        <path d="M-2.6 6.5c0-.6 5.2-.6 5.2 0 .9 3 .6 7 .2 10.5h-1.5l-.6 8h-1.4l-.4-8h-.6l-.4 8h-1.4l-.6-8h-1.5c-.4-3.5-.7-7.5.2-10.5Z" />
      </g>
      {/* placeholders de texto */}
      <rect x={cx + 2} y="9" width={cw * 0.75} height="2.6" rx="1.3" fill="var(--color-ink)" opacity=".45" />
      <rect x={cx + 2} y="13.5" width={cw * 0.55} height="1.6" rx=".8" fill="var(--color-ink)" opacity=".3" />
      <rect x={cx + 2} y="19" width={cw * 0.3} height="3.4" rx="1.7" fill="var(--color-primary)" opacity=".75" />
      <rect x="0" y="30" width="100" height="4" fill="var(--color-ink)" opacity=".12" />
    </svg>
  );
}
