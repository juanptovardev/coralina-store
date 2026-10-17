"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Cierra sesión vía DELETE /api/admin/session y vuelve a /login. */
export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onLogout = async () => {
    setBusy(true);
    try {
      await fetch("/api/admin/session", { method: "DELETE" });
    } catch {
      // Aunque falle la red, volvemos a /login (la cookie se limpia en el servidor).
    } finally {
      router.replace("/login");
    }
  };

  return (
    <button type="button" onClick={() => void onLogout()} disabled={busy} className="btn-primary w-full !py-2">
      {busy ? "Saliendo…" : "Cerrar sesión"}
    </button>
  );
}
