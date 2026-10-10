"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[coralina:storefront]", error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <svg viewBox="0 0 120 20" className="mx-auto h-6 w-40 text-[var(--color-accent)]" fill="none" aria-hidden>
          <path
            d="M1 10c5-7 10-7 15 0s10 7 15 0 10-7 15 0 10 7 15 0 10-7 15 0 10 7 15 0 10-7 14 0"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <h1 className="font-display mt-5 text-4xl">La marea nos jugó una mala pasada</h1>
        <p className="mt-3 text-sm opacity-65">Vuelve a intentarlo, la tienda sigue aquí.</p>
        <div className="mt-7 flex justify-center gap-3">
          <button className="btn-primary text-sm" onClick={reset}>
            Reintentar
          </button>
          <Link href="/" className="btn-ghost text-sm">
            Ir al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
