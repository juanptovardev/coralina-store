"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { CoralinaMark } from "@/components/sea";
import { Modal } from "@/components/admin/ui";
import type { Actor } from "@/lib/session";

const NAV: { href: string; label: string; icon: ReactNode; group: string }[] = [
  { href: "/admin", label: "Resumen", group: "Operación", icon: <IconGrid /> },
  { href: "/admin/pedidos", label: "Pedidos", group: "Operación", icon: <IconReceipt /> },
  { href: "/admin/envios", label: "Envíos", group: "Operación", icon: <IconTruck /> },
  { href: "/admin/productos", label: "Productos", group: "Catálogo", icon: <IconTag /> },
  { href: "/admin/categorias", label: "Categorías y tallas", group: "Catálogo", icon: <IconRuler /> },
  { href: "/admin/inventario", label: "Inventario", group: "Catálogo", icon: <IconBox /> },
  { href: "/admin/clientes", label: "Clientes", group: "Crecimiento", icon: <IconUsers /> },
  { href: "/admin/promos", label: "Promos y combos", group: "Crecimiento", icon: <IconPercent /> },
  { href: "/admin/diseno", label: "Diseño del home", group: "Crecimiento", icon: <IconLayout /> },

  { href: "/admin/auditoria", label: "Auditoría", group: "Control", icon: <IconShield /> },
];

const GROUPS = ["Operación", "Catálogo", "Crecimiento", "Control"];

export function AdminShell({ actor, children }: { actor: Actor; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [roleModal, setRoleModal] = useState<"admin" | "asesor" | null>(null);
  const [rolePassword, setRolePassword] = useState("");
  const [roleError, setRoleError] = useState("");

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function askRole(role: "admin" | "asesor") {
    if (role === actor.role) return;
    setRoleModal(role);
    setRolePassword("");
    setRoleError("");
  }

  async function confirmRole() {
    if (!roleModal) return;
    const role = roleModal;
    setSwitching(true);
    setRoleError("");
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role, password: role === "admin" ? rolePassword : undefined }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setRoleError(json.error ?? "No se pudo cambiar el rol.");
        return;
      }
      setRoleModal(null);
      router.refresh();
    } catch {
      setRoleError("Error de red al cambiar el rol.");
    } finally {
      setTimeout(() => setSwitching(false), 600);
    }
  }

  async function logout() {
    try {
      await fetch("/api/admin/session", { method: "DELETE" });
    } catch {
      /* best-effort: igual navegamos a /login */
    }
    window.location.assign("/login");
  }

  const current = NAV.find((n) => (n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href)));

  return (
    <div className="dash flex min-h-screen">
      {/* ---------- overlay móvil ---------- */}
      {open && (
        <button
          aria-label="Cerrar menú"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-[#241a10]/60 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* ---------- sidebar ---------- */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] shrink-0 flex-col bg-[var(--d-bg)] text-white/85 transition-transform duration-300 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <Link href="/admin" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--d-accent)]/20 text-[var(--d-gold)]">
              <CoralinaMark className="h-6 w-6" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold tracking-tight text-white">Coralina</span>
              <span className="block text-[0.58rem] font-semibold tracking-[0.22em] text-[var(--d-gold)] uppercase">
                Consola
              </span>
            </span>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-white/60 hover:bg-white/10 lg:hidden"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4 scroll-thin">
          {GROUPS.map((g) => (
            <div key={g} className="mt-4 first:mt-0">
              <p className="px-2 pb-1.5 text-[0.58rem] font-bold tracking-[0.2em] text-white/35 uppercase">
                {g}
              </p>
              <ul className="space-y-0.5">
                {NAV.filter((n) => n.group === g).map((n) => {
                  const active =
                    n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href);
                  return (
                    <li key={n.href}>
                      <Link
                        href={n.href}
                        className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.82rem] font-medium transition ${
                          active
                            ? "bg-[var(--d-accent)] text-white shadow-md shadow-black/20"
                            : "text-white/70 hover:bg-white/8 hover:text-white"
                        }`}
                      >
                        <span className={active ? "text-white" : "text-[var(--d-gold)]/70"}>{n.icon}</span>
                        {n.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <p className="text-[0.58rem] font-bold tracking-[0.2em] text-white/35 uppercase">Sesión</p>
          <p className="mt-1 text-xs font-medium text-white">{actor.name}</p>
          <p className="mt-0.5 text-[0.65rem] leading-snug text-white/45">
            {actor.canHardDelete
              ? "Borrado definitivo y purga habilitados."
              : "Solo acciones suaves: archivar y cancelar."}
          </p>
          <div className="mt-2 flex gap-1 rounded-lg bg-white/8 p-1 text-[0.66rem]">
            {(["admin", "asesor"] as const).map((r) => (
              <button
                key={r}
                disabled={switching}
                onClick={() => askRole(r)}
                className={`flex-1 rounded-md px-2 py-1 font-semibold capitalize transition ${
                  actor.role === r ? "bg-white text-[var(--d-bg)]" : "text-white/60 hover:text-white"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            onClick={logout}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 px-2 py-1.5 text-[0.7rem] font-semibold text-white/75 transition hover:border-[var(--d-gold)] hover:text-white"
          >
            Salir
          </button>
          <Link
            href="/"
            className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-white/15 px-2 py-1.5 text-[0.7rem] font-semibold text-white/75 hover:border-[var(--d-gold)] hover:text-white"
          >
            ↗ Ver la tienda
          </Link>
        </div>
      </aside>

      {/* ---------- contenido ---------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--d-line)] bg-[#f6efe1]/90 px-4 py-2.5 backdrop-blur">
          <button
            onClick={() => setOpen(true)}
            className="dash-btn px-2.5 py-1.5 lg:hidden"
            aria-label="Abrir menú"
          >
            ☰
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[0.6rem] font-bold tracking-[0.18em] text-[var(--d-ink-soft)] uppercase">
              Coralina · Consola de operación
            </p>
            <p className="truncate text-sm font-semibold">{current?.label ?? "Dashboard"}</p>
          </div>
          <span className="dash-pill hidden bg-[var(--d-accent-soft)] text-[var(--d-accent)] sm:inline-flex">
            {actor.role}
          </span>
          <Link href="/" className="dash-btn hidden sm:inline-flex">
            Ver tienda ↗
          </Link>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>

      {/* ---------- modal de cambio de rol ---------- */}
      <Modal
        open={roleModal !== null}
        onClose={() => setRoleModal(null)}
        title="Cambiar rol de sesión"
        subtitle={roleModal === "admin" ? "Requiere reautenticación con la clave del admin" : "No requiere clave"}
      >
        <div className="space-y-4 text-sm">
          {roleModal === "admin" && (
            <div>
              <label className="admin-label">Clave del admin</label>
              <input
                type="password"
                className="admin-input mt-1"
                value={rolePassword}
                autoFocus
                placeholder="••••••••"
                onChange={(e) => setRolePassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && rolePassword && !switching) void confirmRole();
                }}
              />
            </div>
          )}
          {roleError && <p className="text-xs text-[var(--d-danger)]">{roleError}</p>}
          <div className="flex justify-end gap-2">
            <button className="dash-btn" onClick={() => setRoleModal(null)}>
              Cancelar
            </button>
            <button
              className="dash-btn dash-btn-primary"
              disabled={switching || (roleModal === "admin" && !rolePassword)}
              onClick={() => void confirmRole()}
            >
              {switching ? "Cambiando…" : `Cambiar a ${roleModal ?? ""}`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ---------------- iconos de línea, propios ---------------- */
function base(p: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[1.05rem] w-[1.05rem]"
      aria-hidden
    >
      {p.children}
    </svg>
  );
}
function IconGrid() {
  return base({ children: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></> });
}
function IconReceipt() {
  return base({ children: <><path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21Z" /><path d="M9 8h6M9 12h6" /></> });
}
function IconTruck() {
  return base({ children: <><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.8" /><circle cx="17.5" cy="18" r="1.8" /></> });
}
function IconTag() {
  return base({ children: <><path d="M3 12V4h8l10 10-8 8L3 12Z" /><circle cx="7.5" cy="7.5" r="1.3" /></> });
}
function IconRuler() {
  return base({ children: <><rect x="2" y="8" width="20" height="8" rx="1.5" /><path d="M7 8v3M11 8v4M15 8v3M19 8v4" /></> });
}
function IconBox() {
  return base({ children: <><path d="M12 3 3 7.5v9L12 21l9-4.5v-9Z" /><path d="M3 7.5 12 12l9-4.5M12 12v9" /></> });
}
function IconUsers() {
  return base({ children: <><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 5.5a3.2 3.2 0 0 1 0 6M18 20a6 6 0 0 0-3-5.2" /></> });
}
function IconPercent() {
  return base({ children: <><path d="M19 5 5 19" /><circle cx="7.5" cy="7.5" r="2.5" /><circle cx="16.5" cy="16.5" r="2.5" /></> });
}
function IconLayout() {
  return base({ children: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></> });
}
function IconShield() {
  return base({ children: <><path d="M12 3 4.5 6v6c0 4.4 3.1 8.3 7.5 9 4.4-.7 7.5-4.6 7.5-9V6Z" /><path d="M12 8v4l2.5 1.5" /></> });
}
