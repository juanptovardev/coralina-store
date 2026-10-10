"use client";

import { useState } from "react";
import { LogoMark, WaveIcon, SeagullIcon, CoralIcon, StarfishIcon } from "@/components/store/svgs";

type Role = "admin" | "asesor";

// La clave demo solo se muestra/usa fuera de producción (evita embeberla en el bundle).
const showDemo = process.env.NODE_ENV !== "production";

export default function LoginPage() {
  const [role, setRole] = useState<Role>("admin");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const doLogin = async (r: Role, p: string) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: r, password: p }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error((data as { error?: string }).error || "No se pudo iniciar sesión");
      // Verifica que la cookie de sesión quedó guardada (iframes pueden bloquearla)
      const check = await fetch("/api/admin/session", { credentials: "include", cache: "no-store" })
        .then((x) => x.json())
        .catch(() => ({}));
      if (check.role !== "admin" && check.role !== "asesor") {
        setBlocked(true);
        return;
      }
      window.location.assign("/admin");
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
            void doLogin(role, pw);
          }}
          className="w-full max-w-sm"
        >
          <h2 className="font-display text-3xl italic">Ingresar</h2>
          <p className="mt-1 text-sm text-ink/55">Usa tu cuenta de equipo.</p>
          <div className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="login-role">Rol</label>
              <select
                id="login-role"
                className="input"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                <option value="admin">Administrador</option>
                <option value="asesor">Asesor</option>
              </select>
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
                autoFocus
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

          {showDemo && (
            <div className="mt-8 rounded-xl border border-ink/10 bg-white/60 p-4">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink/45">Accesos de demostración</p>
              <div className="mt-2 space-y-2">
                <button
                  type="button"
                  onClick={() => void doLogin("admin", "coralina")}
                  className="flex w-full items-center justify-between rounded-lg border border-ink/10 px-3 py-2 text-left text-xs transition hover:border-terracotta"
                >
                  <span>
                    <strong>Admin</strong> · control total
                  </span>
                  <span className="text-terracotta">usar →</span>
                </button>
                <button
                  type="button"
                  onClick={() => void doLogin("asesor", "coralina")}
                  className="flex w-full items-center justify-between rounded-lg border border-ink/10 px-3 py-2 text-left text-xs transition hover:border-terracotta"
                >
                  <span>
                    <strong>Asesor</strong> · sin borrados duros
                  </span>
                  <span className="text-terracotta">usar →</span>
                </button>
              </div>
              <p className="mt-2 text-[0.65rem] text-ink/40">
                Clave por defecto: <code>coralina</code>. El Asesor no puede hard-delete ni purgar auditoría.
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
