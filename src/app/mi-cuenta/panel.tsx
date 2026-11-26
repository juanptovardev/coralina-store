"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/store/svgs";
import { formatCOP } from "@/lib/constants";
import { validateProfile } from "@/lib/validate-profile";
import type { MiCuentaOrder, MiCuentaOrderItem, MiCuentaProfile } from "@/lib/mi-cuenta";
import { LogoutButton } from "./logout-button";

// Misma clave y forma que usa la tienda (src/components/store/shop.tsx).
const CART_KEY = "coralina_cart_v1";

const TAG_LABEL: Record<string, string> = {
  por_revisar: "Por revisar",
  por_empacar: "Por empacar",
  por_enviar: "Por enviar",
  por_recibir: "Por recibir",
  completado: "Completado",
  cancelado: "Cancelado",
};

const SHIP_LABEL: Record<string, string> = {
  revision: "En revisión",
  despacho: "En despacho",
  reparto: "En reparto",
  completado: "Completado",
  archivado: "Archivado",
};

function tagClass(tag: string): string {
  if (tag === "cancelado") return "bg-[#fdf0ee] text-[var(--d-danger)]";
  if (tag === "completado") return "bg-[#e8f3ef] text-[var(--d-ok)]";
  if (tag === "por_revisar") return "bg-[var(--d-accent-soft)] text-[var(--d-accent)]";
  return "bg-[var(--d-panel-2)] text-[var(--d-ink-soft)]";
}

function fmtOrderDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

function lineTotal(item: MiCuentaOrderItem): number {
  return item.unitPriceCents * item.quantity;
}

export function MiCuentaPanel() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profile, setProfile] = useState<MiCuentaProfile | null>(null);
  const [orders, setOrders] = useState<MiCuentaOrder[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [repeatMsg, setRepeatMsg] = useState<Record<string, string>>({});

  // Perfil
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);

  // Contraseña
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNext, setPwdNext] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [pwdErr, setPwdErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/mi-cuenta", { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          code?: string;
          error?: string;
          profile?: MiCuentaProfile;
          orders?: MiCuentaOrder[];
        };
        if (res.status === 401 && data.code === "invalid_session") {
          router.replace("/login");
          return;
        }
        if (!res.ok || !data.ok || !data.profile) throw new Error(data.error || "No pudimos cargar tu cuenta.");
        if (cancelled) return;
        setProfile(data.profile);
        setName(data.profile.name);
        setPhone(data.profile.phone);
        setCity(data.profile.city);
        setAddress(data.profile.address);
        setOrders(Array.isArray(data.orders) ? data.orders : []);
      } catch (e) {
        if (!cancelled) setLoadError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const toggleOrder = (displayId: string) => {
    setExpanded((prev) => (prev.includes(displayId) ? prev.filter((x) => x !== displayId) : [...prev, displayId]));
  };

  const saveProfile = async () => {
    setProfileMsg(null);
    setProfileErr(null);
    const check = validateProfile({ name, phone, city, address });
    if (!check.ok) {
      setProfileErr(check.error);
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch("/api/mi-cuenta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(check.data),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        code?: string;
        error?: string;
        profile?: MiCuentaProfile;
      };
      if (res.status === 401 && data.code === "invalid_session") {
        router.replace("/login");
        return;
      }
      if (!res.ok || !data.ok || !data.profile) throw new Error(data.error || "No pudimos guardar tus datos.");
      setProfile(data.profile);
      setName(data.profile.name);
      setPhone(data.profile.phone);
      setCity(data.profile.city);
      setAddress(data.profile.address);
      setProfileMsg("Datos guardados.");
    } catch (e) {
      setProfileErr((e as Error).message);
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async () => {
    setPwdMsg(null);
    setPwdErr(null);
    if (pwdNext !== pwdConfirm) {
      setPwdErr("La nueva contraseña y su confirmación no coinciden.");
      return;
    }
    if (pwdNext.length < 8 || pwdNext.length > 128) {
      setPwdErr("La nueva contraseña debe tener entre 8 y 128 caracteres.");
      return;
    }
    setSavingPwd(true);
    try {
      const res = await fetch("/api/mi-cuenta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwdCurrent, newPassword: pwdNext }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; code?: string; error?: string };
      if (res.status === 401 && data.code === "invalid_session") {
        router.replace("/login");
        return;
      }
      if (!res.ok || !data.ok) throw new Error(data.error || "No pudimos cambiar tu contraseña.");
      setPwdCurrent("");
      setPwdNext("");
      setPwdConfirm("");
      setPwdMsg("Contraseña actualizada.");
    } catch (e) {
      setPwdErr((e as Error).message);
    } finally {
      setSavingPwd(false);
    }
  };

  const repeatOrder = (order: MiCuentaOrder) => {
    if (order.items.length === 0) {
      setRepeatMsg((prev) => ({ ...prev, [order.displayId]: "Este pedido no tiene artículos que repetir." }));
      return;
    }
    const issues: string[] = [];
    for (const it of order.items) {
      if (!it.current || !it.current.active) {
        issues.push(`${it.productTitle} · talla ${it.size} ya no está disponible.`);
      } else if (it.current.stock < it.quantity) {
        issues.push(
          `${it.productTitle} · talla ${it.size}: pediste ${it.quantity} y hoy quedan ${it.current.stock}.`,
        );
      }
    }
    if (issues.length > 0) {
      setRepeatMsg((prev) => ({
        ...prev,
        [order.displayId]: `No se puede repetir el pedido todavía: ${issues.join(" ")}`,
      }));
      return;
    }
    try {
      const items = order.items.map((it) => {
        const cur = it.current!;
        return {
          variantId: String(it.variantId),
          productId: String(cur.productId),
          name: cur.productTitle,
          productName: cur.productTitle,
          categorySlug: cur.categorySlug,
          size: it.size,
          sku: it.sku,
          image: cur.image,
          price: cur.priceCents,
          qty: it.quantity,
          maxStock: cur.stock,
        };
      });
      localStorage.setItem(CART_KEY, JSON.stringify(items));
      setRepeatMsg((prev) => ({ ...prev, [order.displayId]: "" }));
      router.push("/checkout");
    } catch {
      setRepeatMsg((prev) => ({
        ...prev,
        [order.displayId]: "No pudimos preparar el carrito en este navegador.",
      }));
    }
  };

  return (
    <div className="dash min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <LogoMark className="h-10 w-10" />
            <div>
              <p className="d-title text-2xl">Coralina</p>
              <p className="dash-label">Tu cuenta</p>
            </div>
          </div>
          <div className="w-44">
            <LogoutButton />
          </div>
        </header>

        {loading && (
          <section className="dash-panel p-6 text-sm text-[var(--d-ink-soft)]">Cargando tu cuenta…</section>
        )}

        {!loading && loadError && (
          <section className="dash-panel border-[var(--d-danger)]/40 p-6 text-sm text-[var(--d-danger)]">
            {loadError}
          </section>
        )}

        {!loading && !loadError && profile && (
          <>
            {/* BLOQUE 1 — Perfil */}
            <section className="dash-panel p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="dash-label">Mis datos</p>
                  <h2 className="d-title mt-1 text-2xl">Perfil</h2>
                </div>
                <span className="text-[0.7rem] text-[var(--d-ink-soft)]">Email de tu cuenta</span>
              </div>
              <form
                className="mt-4 grid gap-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveProfile();
                }}
              >
                <div className="sm:col-span-2">
                  <label className="dash-label" htmlFor="mc-name">
                    Nombre
                  </label>
                  <input
                    id="mc-name"
                    className="admin-input mt-1"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre"
                    autoComplete="name"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="dash-label" htmlFor="mc-email">
                    Email
                  </label>
                  <input id="mc-email" className="admin-input mt-1 opacity-60" value={profile.email} disabled readOnly />
                  <p className="mt-1 text-[0.68rem] text-[var(--d-ink-soft)]">
                    El email identifica tu cuenta y no se cambia desde aquí.
                  </p>
                </div>
                <div>
                  <label className="dash-label" htmlFor="mc-phone">
                    Teléfono
                  </label>
                  <input
                    id="mc-phone"
                    className="admin-input mt-1"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Opcional"
                    autoComplete="tel"
                  />
                </div>
                <div>
                  <label className="dash-label" htmlFor="mc-city">
                    Ciudad
                  </label>
                  <input
                    id="mc-city"
                    className="admin-input mt-1"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ciudad"
                    autoComplete="address-level2"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="dash-label" htmlFor="mc-address">
                    Dirección
                  </label>
                  <input
                    id="mc-address"
                    className="admin-input mt-1"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Dirección de entrega"
                    autoComplete="street-address"
                  />
                </div>
                <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
                  <button type="submit" className="dash-btn dash-btn-primary" disabled={savingProfile}>
                    {savingProfile ? "Guardando…" : "Guardar"}
                  </button>
                  {profileMsg && <span className="text-xs font-medium text-[var(--d-ok)]">{profileMsg}</span>}
                  {profileErr && <span className="text-xs font-medium text-[var(--d-danger)]">{profileErr}</span>}
                </div>
              </form>
            </section>

            {/* BLOQUE 2 — Mis pedidos (+ BLOQUE 4 repetir) */}
            <section className="dash-panel p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="dash-label">Historial</p>
                  <h2 className="d-title mt-1 text-2xl">Mis pedidos</h2>
                </div>
                <Link href="/coleccion" className="dash-btn">
                  Ver colección
                </Link>
              </div>

              {orders.length === 0 ? (
                <div className="mt-5 rounded-xl border border-dashed border-[var(--d-line)] bg-[var(--d-panel-2)] p-6 text-center text-sm text-[var(--d-ink-soft)]">
                  Todavía no tienes pedidos.{" "}
                  <Link href="/coleccion" className="font-semibold text-[var(--d-accent)] underline-offset-2 hover:underline">
                    Ver la colección
                  </Link>
                  .
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {orders.map((order) => {
                    const open = expanded.includes(order.displayId);
                    const msg = repeatMsg[order.displayId];
                    return (
                      <article
                        key={order.displayId}
                        className="rounded-xl border border-[var(--d-line)] bg-[var(--d-panel-2)] p-4"
                      >
                        <button
                          type="button"
                          onClick={() => toggleOrder(order.displayId)}
                          className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
                          aria-expanded={open}
                        >
                          <div>
                            <p className="font-semibold">{order.displayId}</p>
                            <p className="text-[0.7rem] text-[var(--d-ink-soft)]">
                              {fmtOrderDate(order.createdAt)} · {order.items.length} artículo
                              {order.items.length === 1 ? "" : "s"}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`dash-pill ${tagClass(order.operationalTag)}`}>
                              {TAG_LABEL[order.operationalTag] ?? order.operationalTag}
                            </span>
                            <span className="font-bold">{formatCOP(order.totalCents)}</span>
                            <span className="text-xs text-[var(--d-ink-soft)]">{open ? "Ocultar" : "Ver detalle"}</span>
                          </div>
                        </button>

                        {open && (
                          <div className="mt-4 space-y-4 border-t border-[var(--d-line)] pt-4">
                            <div className="divide-y divide-[var(--d-line)]">
                              {order.items.map((item, idx) => (
                                <div key={`${order.displayId}-${idx}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                                  <div>
                                    <p className="font-medium">
                                      {item.productTitle} <span className="text-[var(--d-ink-soft)]">· {item.size}</span>
                                    </p>
                                    <p className="text-[0.7rem] text-[var(--d-ink-soft)]">
                                      {item.quantity} × {formatCOP(item.unitPriceCents)}
                                    </p>
                                  </div>
                                  <span className="font-semibold">{formatCOP(lineTotal(item))}</span>
                                </div>
                              ))}
                            </div>

                            {order.discountBreakdown.length > 0 && (
                              <div className="rounded-lg bg-[var(--d-panel)] p-3 text-sm">
                                <p className="dash-label">Descuentos</p>
                                <ul className="mt-2 space-y-1">
                                  {order.discountBreakdown.map((d, idx) => (
                                    <li key={`${order.displayId}-d-${idx}`} className="flex items-center justify-between">
                                      <span className="text-[var(--d-ink-soft)]">{d.label}</span>
                                      <span className="text-[var(--d-ok)]">−{formatCOP(d.amountCents)}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <div className="rounded-lg bg-[var(--d-panel)] p-3 text-sm">
                              <p className="dash-label">Envío</p>
                              {order.shipment ? (
                                <div className="mt-1 space-y-0.5">
                                  <p>{SHIP_LABEL[order.shipment.status] ?? order.shipment.status}</p>
                                  {order.shipment.carrier && (
                                    <p className="text-[0.72rem] text-[var(--d-ink-soft)]">
                                      Transportadora: {order.shipment.carrier}
                                    </p>
                                  )}
                                  {order.shipment.trackingCode && (
                                    <p className="text-[0.72rem] text-[var(--d-ink-soft)]">
                                      Guía: <span className="mono">{order.shipment.trackingCode}</span>
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <p className="mt-1 text-[var(--d-ink-soft)]">Sin envío registrado.</p>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                              {order.canRepeat && (
                                <button
                                  type="button"
                                  className="dash-btn dash-btn-primary"
                                  onClick={() => repeatOrder(order)}
                                >
                                  Repetir pedido
                                </button>
                              )}
                              {msg && <span className="text-xs font-medium text-[var(--d-danger)]">{msg}</span>}
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* BLOQUE 3 — Cambiar mi clave */}
            <section className="dash-panel p-5">
              <p className="dash-label">Seguridad</p>
              <h2 className="d-title mt-1 text-2xl">Cambiar mi clave</h2>
              <form
                className="mt-4 grid gap-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void savePassword();
                }}
              >
                <div className="sm:col-span-2">
                  <label className="dash-label" htmlFor="mc-pwd-current">
                    Contraseña actual
                  </label>
                  <input
                    id="mc-pwd-current"
                    className="admin-input mt-1"
                    type="password"
                    value={pwdCurrent}
                    onChange={(e) => setPwdCurrent(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>
                <div>
                  <label className="dash-label" htmlFor="mc-pwd-next">
                    Nueva contraseña
                  </label>
                  <input
                    id="mc-pwd-next"
                    className="admin-input mt-1"
                    type="password"
                    value={pwdNext}
                    onChange={(e) => setPwdNext(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="dash-label" htmlFor="mc-pwd-confirm">
                    Repetir nueva contraseña
                  </label>
                  <input
                    id="mc-pwd-confirm"
                    className="admin-input mt-1"
                    type="password"
                    value={pwdConfirm}
                    onChange={(e) => setPwdConfirm(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
                <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
                  <button type="submit" className="dash-btn dash-btn-primary" disabled={savingPwd}>
                    {savingPwd ? "Guardando…" : "Cambiar contraseña"}
                  </button>
                  {pwdMsg && <span className="text-xs font-medium text-[var(--d-ok)]">{pwdMsg}</span>}
                  {pwdErr && <span className="text-xs font-medium text-[var(--d-danger)]">{pwdErr}</span>}
                </div>
              </form>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
