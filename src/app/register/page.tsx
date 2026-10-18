"use client";

import { useState } from "react";
import { LogoMark, WaveIcon, SeagullIcon, CoralIcon, StarfishIcon } from "@/components/store/svgs";
import { validateRegistration } from "@/lib/validate-register";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const doRegister = async () => {
    setBusy(true);
    setErr(null);
    // Misma validación que el servidor (función pura compartida).
    const check = validateRegistration({ name, email, password: pw });
    if (!check.ok) {
      setErr(check.error);
      setBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(check.data),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; role?: string; error?: string };
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo crear la cuenta");
      // Alta OK + auto-login: el servidor ya emitió la cookie de sesión.
      window.location.assign("/mi-cuenta");
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
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-linen/60">Cuenta de cliente</p>
          </div>
        </div>
        <div className="relative">
          <WaveIcon className="h-10 w-10 text-amber-brand float-slow" />
          <h1 className="mt-4 font-display text-4xl italic leading-tight">
            Crea tu cuenta
            <br />
            y vuelve cuando quieras.
          </h1>
          <p className="mt-4 max-w-sm text-sm font-light text-linen/70">
            Regístrate una vez con tu email y contraseña; con ellas entras a tu cuenta en cualquier
            dispositivo.
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
            void doRegister();
          }}
          className="w-full max-w-sm"
        >
          <h2 className="font-display text-3xl italic">Crear cuenta</h2>
          <p className="mt-1 text-sm text-ink/55">Solo necesitas tu nombre, email y contraseña.</p>
          <div className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="reg-name">Nombre</label>
              <input
                id="reg-name"
                className="input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ana Pérez"
                autoComplete="name"
                autoFocus
              />
            </div>
            <div>
              <label className="label" htmlFor="reg-email">Email</label>
              <input
                id="reg-email"
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label" htmlFor="reg-pw">Contraseña</label>
              <input
                id="reg-pw"
                className="input"
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
              <p className="mt-1 text-xs text-ink/45">Mínimo 8 caracteres.</p>
            </div>
            {err && (
              <p className="rounded-lg bg-terracotta/10 px-3 py-2 text-xs font-medium text-terracotta">{err}</p>
            )}
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? "Creando…" : "Crear cuenta"}
            </button>
          </div>
          <p className="mt-6 text-center text-sm text-ink/55">
            ¿Ya tienes cuenta?{" "}
            <a href="/login" className="font-medium text-ink underline-offset-2 hover:underline">
              Inicia sesión
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
