"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[coralina:dashboard]", error);
  }, [error]);

  return (
    <div className="dash grid min-h-screen place-items-center p-6">
      <div className="dash-panel max-w-md p-6 text-center">
        <svg viewBox="0 0 64 30" className="mx-auto h-9 w-24 text-[var(--d-danger)]/60" fill="none" aria-hidden>
          <path d="M1 20c6-8 12-8 18 0s12 8 18 0 12-8 18 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <h1 className="d-title mt-3 text-xl">La consola tuvo un problema</h1>
        <p className="mt-2 text-[0.82rem] text-[var(--d-ink-soft)]">
          Ningún dato se perdió: las operaciones del dashboard son transaccionales. Puedes reintentar la
          vista o volver al resumen.
        </p>
        {error.digest && <p className="mono mt-2 text-[0.68rem] opacity-50">digest {error.digest}</p>}
        <div className="mt-5 flex justify-center gap-2">
          <button className="dash-btn dash-btn-primary" onClick={reset}>
            Reintentar
          </button>
          <Link href="/admin" className="dash-btn">
            Ir al resumen
          </Link>
        </div>
      </div>
    </div>
  );
}
