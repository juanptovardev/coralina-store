"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Cierra sesión vía DELETE /api/admin/session y limpia también la cookie de
 * identidad del panel (coralina_identity) para que no quede un email colgado
 * tras el logout. Vuelve a /login.
 */
export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onLogout = async () => {
    setBusy(true);
    try {
      await Promise.allSettled([
        fetch("/api/admin/session", { method: "DELETE" }),
        fetch("/api/mi-cuenta/session", { method: "DELETE" }),
      ]);
    } catch {
      // Aunque falle la red, volvemos a /login (las cookies se limpian en el servidor).
    } finally {
      router.replace("/login");
    }
  };

  return (
    <button type="button" onClick={() => void onLogout()} disabled={busy} className="dash-btn w-full">
      {busy ? "Saliendo…" : "Cerrar sesión"}
    </button>
  );
}
