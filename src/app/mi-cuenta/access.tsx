"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/store/svgs";
import { LogoutButton } from "./logout-button";

/**
 * Paso de activación del panel. La cookie de sesión (coralina_role) solo guarda
 * el rol, así que para saber QUÉ cuenta es pedimos tu email y clave una vez:
 * /api/mi-cuenta/session los verifica y emite la cookie firmada de identidad.
 * Mismo endpoint que usa el alta de sesión; si ya la tienes, este paso no aparece.
 */
export function MiCuentaAccess() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const activate = async () => {
    setErr(null);
    if (!email.trim() || !password) {
      setErr("Ingresa tu email y tu contraseña.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/mi-cuenta/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "No pudimos verificar la cuenta.");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dash flex min-h-screen items-center justify-center px-4 py-8 md:px-8">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3">
          <LogoMark className="h-10 w-10" />
          <div>
            <p className="d-title text-2xl">Coralina</p>
            <p className="dash-label">Tu cuenta</p>
          </div>
        </div>

        <section className="dash-panel mt-6 p-6">
          <p className="dash-label">Un paso más</p>
          <h1 className="d-title mt-1 text-2xl">Activa tu panel</h1>
          <p className="mt-2 text-sm text-[var(--d-ink-soft)]">
            Confirma el email y la contraseña de tu cuenta para ver tus datos y pedidos.
          </p>

          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void activate();
            }}
          >
            <div>
              <label className="dash-label" htmlFor="mc-access-email">
                Email
              </label>
              <input
                id="mc-access-email"
                className="admin-input mt-1"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                autoComplete="username"
                autoFocus
              />
            </div>
            <div>
              <label className="dash-label" htmlFor="mc-access-pwd">
                Contraseña
              </label>
              <input
                id="mc-access-pwd"
                className="admin-input mt-1"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {err && <p className="text-xs font-medium text-[var(--d-danger)]">{err}</p>}

            <button type="submit" className="dash-btn dash-btn-primary w-full" disabled={busy}>
              {busy ? "Activando…" : "Entrar a mi panel"}
            </button>
          </form>
        </section>

        <div className="mt-4">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
