"use client";

import { useState } from "react";
import { LogoMark, WaveIcon, SeagullIcon, CoralIcon, StarfishIcon } from "@/components/store/svgs";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const doLogin = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // El rol NO se envía: el backend lo deriva de la cuenta (tabla users).
        body: JSON.stringify({ email: email.trim(), password: pw }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; role?: string; error?: string };
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo iniciar sesión");
      // Verifica que la cookie de sesión quedó guardada (iframes pueden bloquearla)
      const check = await fetch("/api/admin/session", { credentials: "include", cache: "no-store" })
        .then((x) => x.json())
        .catch(() => ({}));
      if (check.role !== "admin" && check.role !== "asesor" && check.role !== "cliente") {
        setBlocked(true);
        return;
      }
      // Redirige según el rol que deriva el backend desde la cuenta.
      const dest = data.role === "admin" || data.role === "asesor" ? "/admin" : "/mi-cuenta";
      window.location.assign(dest);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-linen">
      {/* Panel de marca */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-ink p-10 text-linen lg:flex">
        <div className="absolute inset-0 bg-gradient-to-b from-terracotta/25 via-transparent to-sea/25" />
        <div className="relative flex items-center gap-3">
          <LogoMark className="h-11 w-11" />
          <div>
            <p className="font-display text-2xl italic font-semibold">Coralina</p>
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-linen/60">Portal del equipo</p>
          </div>
        </div>
        <div className="relative">
          <WaveIcon className="h-10 w-10 text-amber-brand float-slow" />
          <h1 className="mt-4 font-display text-4xl italic leading-tight">
            La operación completa,
            <br />
            sin escribir una línea de código.
          </h1>
          <p className="mt-4 max-w-sm text-sm font-light text-linen/70">
            Pedidos, envíos, inventario, diseño del home y promos — todo lo que mueve la marca, en un solo
            tablero con auditoría total.
          </p>
        </div>
        <div className="relative flex items-center gap-5 text-linen/40">
          <SeagullIcon className="h-6 w-6" />
          <CoralIcon className="h-6 w-6" />
          <StarfishIcon className="h-6 w-6" />
          <span className="text-xs">© 2026 Coralina</span>
        </div>
      </div>

      {/* Formulario */}
      <div className="flex flex-1 items-center justify-center p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void doLogin();
          }}
          className="w-full max-w-sm"
        >
          <h2 className="font-display text-3xl italic">Ingresar</h2>
          <p className="mt-1 text-sm text-ink/55">Usa tu cuenta de equipo.</p>
          <div className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="login-email">Email</label>
              <input
                id="login-email"
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@coralina.com"
                autoComplete="username"
                autoFocus
              />
            </div>
            <div>
              <label className="label" htmlFor="login-pw">Contraseña</label>
              <input
                id="login-pw"
                className="input"
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            {err && (
              <p className="rounded-lg bg-terracotta/10 px-3 py-2 text-xs font-medium text-terracotta">{err}</p>
            )}
            {blocked && (
              <div className="rounded-xl border border-amber-brand/60 bg-amber-brand/15 px-4 py-3 text-xs text-ink/80">
                <p className="font-semibold">Tu navegador bloquea la sesión dentro de la vista embebida.</p>
                <p className="mt-1">Las credenciales son correctas: abre el portal en una pestaña completa para continuar.</p>
                <a href="/login" target="_blank" rel="noopener" className="btn-primary mt-3 w-full !py-2">
                  Abrir en pestaña completa ↗
                </a>
              </div>
            )}
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? "Entrando…" : "Entrar al portal"}
            </button>
          </div>
          <p className="mt-6 text-center text-sm text-ink/55">
            ¿No tienes cuenta?{" "}
            <a href="/register" className="font-medium text-ink underline-offset-2 hover:underline">
              Regístrate
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
