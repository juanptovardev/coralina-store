"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Card,
  ConfirmDialog,
  Drawer,
  EmptyState,
  HardDeleteDialog,
  Modal,
  notify,
  PageHeader,
  Skeleton,
  Stat,
  Toast,
  useBusy,
  useDebouncedValue,
  useJson,
  postJson,
} from "@/components/admin/ui";
import { OPERATIONAL_TAGS, TAG_FLOW, formatCOP } from "@/lib/constants";
import type { StoreProduct } from "@/lib/queries";
import type { Actor } from "@/lib/session";

type OrderRow = {
  id: number;
  displayId: string;
  source: "web" | "manual";
  status: string;
  operationalTag: string;
  fulfillmentClass: "enviar" | "no_enviar";
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  discountBreakdown: { label: string; amountCents: number }[];
  paymentRef: string;
  notes: string;
  tagHistory: { tag: string; at: string; by: string }[];
  createdAt: string;
  customer: { id: number; name: string; email: string; phone: string; city: string; address: string };
  items: { id: number; productTitle: string; size: string; sku: string; unitPriceCents: number; quantity: number }[];
  shipment: { status: string; statusHistory: { status: string; at: string; by: string }[] } | null;
};

const TAG_TONES: Record<string, "coral" | "amber" | "blue" | "green" | "red" | "slate"> = {
  por_revisar: "amber",
  por_empacar: "blue",
  por_enviar: "coral",
  por_recibir: "blue",
  completado: "green",
  cancelado: "red",
};

type Metrics = {
  today: number;
  week: number;
  month: number;
  revenueMonth: number;
  avgTicket: number;
  byTag: Record<string, number>;
  byDay: { date: string; count: number; revenueCents: number }[];
};

export default function PedidosPage() {
  const { data, loading, reload } = useJson<{ orders: OrderRow[]; metrics: Metrics }>(
    "/api/admin/orders",
  );
  const { data: actor } = useJson<Actor>("/api/admin/session");
  const [view, setView] = useState<"listado" | "metricas">("listado");
  const [q, setQ] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [bulkTag, setBulkTag] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [open, setOpen] = useState<OrderRow | null>(null);
  const [manual, setManual] = useState(false);
  const [target, setTarget] = useState<OrderRow | null>(null);
  const [confirmBox, setConfirmBox] = useState<{
    title: string;
    message: string;
    onOk: () => void;
  } | null>(null);
  const { busy, run } = useBusy();
  const dq = useDebouncedValue(q, 300);

  const metrics: Metrics = data?.metrics ?? {
    today: 0,
    week: 0,
    month: 0,
    revenueMonth: 0,
    avgTicket: 0,
    byTag: {},
    byDay: [],
  };

  const orders = (data?.orders ?? []).filter((o) => {
    if (tagFilter !== "all" && o.operationalTag !== tagFilter) return false;
    if (classFilter !== "all" && o.fulfillmentClass !== classFilter) return false;
    if (sourceFilter !== "all" && o.source !== sourceFilter) return false;
    if (dq && !`${o.displayId} ${o.customer.name} ${o.customer.email}`.toLowerCase().includes(dq.toLowerCase()))
      return false;
    return true;
  });

  // Link desde el panel «Necesita atención»: /admin/pedidos?tag=por_revisar
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tag");
    if (t && OPERATIONAL_TAGS.some((x) => x.value === t)) {
      const id = setTimeout(() => setTagFilter(t), 0);
      return () => clearTimeout(id);
    }
  }, []);

  // refresco suave cada 30s (como el panel real)
  useEffect(() => {
    const t = setInterval(reload, 30000);
    return () => clearInterval(t);
  }, [reload]);

  async function post(body: Record<string, unknown>): Promise<string | null> {
    const { ok, error } = await postJson("/api/admin/orders", body);
    if (!ok) return error ?? "Error inesperado";
    reload();
    return null;
  }

  async function bulkApply(tag: string) {
    const { ok, error, json } = await postJson<{
      changed?: number;
      total?: number;
      errors?: string[];
    }>("/api/admin/orders", { action: "bulk_tag", orderIds: selected, tag });
    if (!ok) {
      notify(json.errors?.[0] ?? error ?? "No se pudo aplicar el tag", "error");
      return;
    }
    notify(`${json.changed ?? 0}/${json.total ?? selected.length} pedido(s) → ${tag}`);
    setSelected([]);
    reload();
  }

  return (
    <div>
      <PageHeader
        title="Pedidos"
        subtitle="Tres capas distintas: estado comercial (pago), estado del equipo (tag operativo) y estado del paquete (tablero de envíos)."
        actions={
          <>
            <div className="flex rounded-full bg-[var(--d-panel-2)] p-1 text-xs">
              {(["listado", "metricas"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`rounded-full px-3 py-1 capitalize ${view === v ? "bg-[var(--d-bg)] text-white" : "opacity-60"}`}
                >
                  {v}
                </button>
              ))}
            </div>
            <button className="dash-btn dash-btn-primary" onClick={() => setManual(true)}>
              + Pedido manual
            </button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Hoy" value={String(metrics.today ?? 0)} hint="día natural UTC" />
        <Stat label="Semana" value={String(metrics.week ?? 0)} />
        <Stat label="Mes" value={String(metrics.month ?? 0)} hint={formatCOP(metrics.revenueMonth ?? 0)} />
        <Stat label="Ticket promedio" value={formatCOP(metrics.avgTicket ?? 0)} />
      </div>

      {view === "metricas" ? (
        <>
          <Card className="mt-5">
            <div className="flex items-baseline justify-between">
              <p className="admin-label">Pedidos · últimos 14 días</p>
              <p className="text-[0.7rem] text-[var(--d-ink-soft)]">
                total{" "}
                {formatCOP((metrics.byDay ?? []).reduce((a, d) => a + d.revenueCents, 0))}
              </p>
            </div>
            <div className="mt-4 flex h-44 items-end gap-1.5">
              {(metrics.byDay ?? []).map((d) => {
                const max = Math.max(1, ...((metrics.byDay ?? []).map((x) => x.count) || [1]));
                const h = Math.max(3, Math.round((d.count / max) * 130));
                return (
                  <div
                    key={d.date}
                    className="group flex flex-1 flex-col items-center gap-1"
                    title={`${d.date} · ${d.count} pedido(s) · ${formatCOP(d.revenueCents)}`}
                  >
                    <span className="text-[0.58rem] text-[var(--d-ink-soft)] group-hover:opacity-100 opacity-70">
                      {d.count}
                    </span>
                    <div
                      className="w-full rounded-t bg-[var(--d-accent)]/80 transition hover:bg-[var(--d-accent)]"
                      style={{ height: h }}
                    />
                    <span className="text-[0.58rem] text-[var(--d-ink-soft)]">{d.date.slice(8)}/{d.date.slice(5, 7)}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="mt-5">
            <p className="admin-label">Pedidos por estado del equipo</p>
            <div className="mt-4 space-y-3">
              {OPERATIONAL_TAGS.map((t) => {
                const n = metrics.byTag?.[t.value] ?? 0;
                const max = Math.max(1, ...Object.values(metrics.byTag ?? { a: 1 }));
                return (
                  <div key={t.value} className="flex items-center gap-3 text-xs">
                    <span className="w-28 opacity-70">{t.label}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-[var(--d-panel-2)]">
                      <div
                        className="h-full rounded-full bg-[var(--d-accent)]"
                        style={{ width: `${(n / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-right">{n}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      ) : (
        <>
          <Card className="mt-5 flex flex-wrap items-center gap-3 py-3">
            <input
              className="admin-input max-w-xs"
              placeholder="Buscar #CR-1042, cliente o correo…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select className="admin-input max-w-[12rem]" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
              <option value="all">Todos los estados del equipo</option>
              {OPERATIONAL_TAGS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select className="admin-input max-w-[10rem]" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              <option value="all">Enviar y no enviar</option>
              <option value="enviar">Solo enviar</option>
              <option value="no_enviar">Solo no enviar</option>
            </select>
            <select className="admin-input max-w-[10rem]" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
              <option value="all">Todos los orígenes</option>
              <option value="web">Web</option>
              <option value="manual">Manual</option>
            </select>
            <button
              className="dash-btn"
              onClick={() => {
                reload();
                notify("Lista actualizada");
              }}
            >
              ↻ Actualizar
            </button>
          </Card>

          {/* Barra masiva (bulk tag) — aparece con selección */}
          {selected.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-full bg-[var(--d-bg)] px-4 py-3 text-white">
              <span className="text-xs font-semibold">{selected.length} seleccionado(s)</span>
              <select
                id="bulk-tag-select"
                className="admin-input max-w-[11rem] py-1 text-xs"
                value={bulkTag}
                onChange={(e) => setBulkTag(e.target.value)}
              >
                <option value="" disabled>
                  Cambiar estado…
                </option>
                {TAG_FLOW.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <button
                className="dash-btn dash-btn-primary py-1"
                disabled={busy}
                onClick={() => {
                  if (!bulkTag) {
                    notify("Elige un estado primero", "error");
                    return;
                  }
                  const tag = bulkTag;
                  setBulkTag("");
                  void run(() => bulkApply(tag));
                }}
              >
                Aplicar
              </button>
              <button className="dash-btn py-1" onClick={() => setSelected([])}>
                Limpiar
              </button>
            </div>
          )}

          {loading ? (
            <div className="mt-5">
              <Skeleton rows={6} />
            </div>
          ) : orders.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                title="Sin pedidos con esos filtros"
                hint="Prueba a limpiar la búsqueda o crea un pedido manual."
                actionLabel="Crear pedido manual"
                onAction={() => setManual(true)}
              />
            </div>
          ) : (
            <div className="dash-panel dash-scroll mt-5 overflow-auto scroll-thin">
              <table className="dash-table min-w-[980px]">
                <thead>
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label="Seleccionar todos"
                        checked={orders.length > 0 && orders.every((o) => selected.includes(o.id))}
                        onChange={(e) =>
                          setSelected(e.target.checked ? orders.map((o) => o.id) : [])
                        }
                      />
                    </th>
                    <th className="px-4 py-3">Pedido</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Pago / orden</th>
                    <th className="px-4 py-3">Estado del equipo</th>
                    <th className="px-4 py-3">Paquete</th>
                    <th className="px-4 py-3">Origen</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr
                      key={o.id}
                      className={`cursor-pointer ${
                        selected.includes(o.id)
                          ? "bg-[var(--d-accent)]/10"
                          : o.status === "canceled"
                            ? "opacity-55"
                            : ""
                      }`}
                      onClick={() => setOpen(o)}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar ${o.displayId}`}
                          checked={selected.includes(o.id)}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? [...selected, o.id]
                                : selected.filter((id) => id !== o.id),
                            )
                          }
                        />
                      </td>
                      <td className="px-4 py-3 font-medium">{o.displayId}</td>
                      <td className="px-4 py-3">
                        <p>{o.customer.name}</p>
                        <p className="text-[0.68rem] opacity-50">{o.customer.city}</p>
                      </td>
                      <td className="px-4 py-3">{formatCOP(o.totalCents)}</td>
                      <td className="px-4 py-3">
                        <Badge tone={o.status === "completed" ? "green" : o.status === "canceled" ? "red" : "slate"}>
                          {o.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <select
                          className="admin-input max-w-[10rem] py-1 text-xs"
                          value={o.operationalTag}
                          disabled={busy}
                          onChange={(e) => {
                            const tag = e.target.value;
                            void run(async () => {
                              const err = await post({ action: "set_tag", orderId: o.id, tag });
                              notify(err ?? `Pedido ${o.displayId} → ${tag}`, err ? "error" : "ok");
                            });
                          }}
                        >
                          {OPERATIONAL_TAGS.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {o.fulfillmentClass === "no_enviar" ? (
                          <Badge tone="slate" title="No genera tarjeta en el tablero">
                            no enviar
                          </Badge>
                        ) : (
                          <Badge tone="coral">{o.shipment?.status ?? "sin envío"}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs opacity-65">{o.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ---------- drawer de detalle ---------- */}
      <Drawer open={Boolean(open)} onClose={() => setOpen(null)} title={open?.displayId ?? ""}>
        {open && (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge tone="slate">Pago/orden: {open.status}</Badge>
              <Badge tone={TAG_TONES[open.operationalTag] ?? "slate"}>
                Equipo: {open.operationalTag}
              </Badge>
              <Badge tone={open.fulfillmentClass === "enviar" ? "coral" : "slate"}>
                Clase: {open.fulfillmentClass}
              </Badge>
              {open.shipment && <Badge tone="blue">Paquete: {open.shipment.status}</Badge>}
            </div>

            <Card>
              <p className="admin-label">Cliente</p>
              <p className="font-medium">{open.customer.name}</p>
              <p className="text-xs opacity-65">{open.customer.email} · {open.customer.phone}</p>
              <p className="text-xs opacity-65">{open.customer.address}, {open.customer.city}</p>
            </Card>

            <Card>
              <p className="admin-label">Productos</p>
              <ul className="mt-2 space-y-2">
                {open.items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-3 text-xs">
                    <span>
                      {i.quantity} × {i.productTitle} · talla {i.size}
                      <span className="block opacity-50">{i.sku}</span>
                    </span>
                    <span>{formatCOP(i.unitPriceCents * i.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 space-y-1 border-t border-[var(--d-line)] pt-3 text-xs">
                <Row label="Subtotal" value={formatCOP(open.subtotalCents)} />
                {open.discountBreakdown.map((d) => (
                  <Row key={d.label} label={d.label} value={`− ${formatCOP(d.amountCents)}`} />
                ))}
                <Row label="Total" value={formatCOP(open.totalCents)} bold />
              </div>
              <p className="mt-2 text-[0.68rem] opacity-55">Pago: {open.paymentRef || "sin referencia"}</p>
            </Card>

            <Card>
              <p className="admin-label">Cambiar estado del equipo</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {TAG_FLOW.map((t) => (
                  <button
                    key={t}
                    disabled={busy}
                    className={`chip border disabled:opacity-50 ${open.operationalTag === t ? "border-[var(--d-accent)] bg-[var(--d-accent)] text-white" : "border-[var(--d-line)]"}`}
                    onClick={() => {
                      const back = TAG_FLOW.indexOf(t) < TAG_FLOW.indexOf(open.operationalTag as never);
                      const apply = async () => {
                        const err = await post({ action: "set_tag", orderId: open.id, tag: t });
                        notify(err ?? "Estado actualizado", err ? "error" : "ok");
                        setOpen(null);
                      };
                      if (back) {
                        setConfirmBox({
                          title: "Mover hacia atrás",
                          message:
                            "Vas a mover el pedido hacia atrás en el flujo. ¿Confirmas? Queda en la bitácora.",
                          onOk: () => void run(apply),
                        });
                      } else {
                        void run(apply);
                      }
                    }}
                  >
                    {t}
                  </button>
                ))}
                <button
                  className="chip border border-red-200 text-[var(--d-danger)] disabled:opacity-50"
                  disabled={busy}
                  onClick={() => {
                    setConfirmBox({
                      title: "Cancelar pedido",
                      message:
                        "Cancelar el pedido devuelve el stock y archiva su envío. ¿Confirmas?",
                      onOk: async () => {
                        const err = await post({ action: "set_tag", orderId: open.id, tag: "cancelado" });
                        notify(err ?? "Pedido cancelado y stock devuelto", err ? "error" : "ok");
                        setOpen(null);
                      },
                    });
                  }}
                >
                  cancelar (suave)
                </button>
              </div>
            </Card>

            <Card>
              <p className="admin-label">Historial</p>
              <ul className="mt-2 space-y-1 text-xs opacity-75">
                {open.tagHistory.map((h, i) => (
                  <li key={i}>
                    · {new Date(h.at).toLocaleString("es-CO")} — {h.tag} por {h.by}
                  </li>
                ))}
                {open.shipment?.statusHistory.map((h, i) => (
                  <li key={`s${i}`}>
                    · {new Date(h.at).toLocaleString("es-CO")} — paquete {h.status} por {h.by}
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <p className="admin-label">Notas internas</p>
              <textarea
                className="admin-input mt-1 h-20"
                defaultValue={open.notes}
                onBlur={async (e) => {
                  const value = e.target.value;
                  if (value === open.notes) return;
                  const err = await post({ action: "save_notes", orderId: open.id, notes: value });
                  notify(err ?? "Notas guardadas", err ? "error" : "ok");
                  // Actualiza el baseline: sin esto, el siguiente blur sin cambios
                  // re-postea y genera auditoría fantasma.
                  if (!err) setOpen({ ...open, notes: value });
                }}
              />
            </Card>

            <button
              className="dash-btn dash-btn-danger w-full"
              onClick={() => setTarget(open)}
            >
              Eliminar pedido definitivamente
            </button>
          </div>
        )}
      </Drawer>

      <ManualOrderModal
        open={manual}
        onClose={() => setManual(false)}
        onDone={(msg, t) => {
          setManual(false);
          notify(msg, t);
          reload();
        }}
      />

      <HardDeleteDialog
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        canHardDelete={Boolean(actor?.canHardDelete)}
        entityLabel={`pedido ${target?.displayId ?? ""}`}
        expectedText={target?.displayId ?? ""}
        description="Preferimos cancelar antes que borrar. El borrado elimina items y envío en cascada y no se puede deshacer."
        onConfirm={async (confirmText, password) => {
          const err = await post({ action: "hard_delete", orderId: target?.id, confirmText, password });
          if (!err) {
            setOpen(null);
            notify("Pedido eliminado definitivamente");
          }
          return err;
        }}
      />

      {/* Confirmación propia (reemplaza confirm() nativo) — ConfirmDialog en ui.tsx */}
      <ConfirmDialog
        open={confirmBox !== null}
        onClose={() => setConfirmBox(null)}
        title={confirmBox?.title ?? ""}
        message={confirmBox?.message ?? ""}
        onConfirm={() => confirmBox?.onOk()}
      />

      <Toast />
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className={bold ? "font-medium" : "opacity-65"}>{label}</span>
      <span className={bold ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}

function ManualOrderModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (msg: string, tone: "ok" | "error") => void;
}) {
  const { data } = useJson<{ products: StoreProduct[] }>("/api/admin/catalog");
  const [items, setItems] = useState<{ variantId: number; quantity: number; label: string; stock: number }[]>([]);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "", city: "", address: "" });
  const [cls, setCls] = useState<"enviar" | "no_enviar">("enviar");
  const [payment, setPayment] = useState("");
  const [notes, setNotes] = useState("");
  const [totals, setTotals] = useState<{ subtotalCents: number; discountCents: number; totalCents: number; applied: { id: number; label: string; amountCents: number }[] } | null>(null);
  const [error, setError] = useState("");
  const { busy, run } = useBusy();

  const products = data?.products ?? [];
  const options = useMemo(
    () =>
      products.flatMap((p) =>
        p.variants.map((v) => ({
          variantId: v.id,
          label: `${p.title} · ${v.size}`,
          stock: v.stock,
        })),
      ),
    [products],
  );

  useEffect(() => {
    if (items.length === 0) {
      setTotals(null);
      return;
    }
    void postJson<{
      subtotalCents?: number;
      discountCents?: number;
      totalCents?: number;
      applied?: { id: number; label: string; amountCents: number }[];
    }>("/api/admin/orders", {
      action: "preview_totals",
      items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
    }).then(({ ok, json }) => {
      setTotals(
        ok && typeof json.subtotalCents === "number"
          ? {
              subtotalCents: json.subtotalCents,
              discountCents: json.discountCents ?? 0,
              totalCents: json.totalCents ?? 0,
              applied: json.applied ?? [],
            }
          : null,
      );
    });
  }, [items]);

  return (
    <Modal open={open} onClose={onClose} title="Nuevo pedido manual" wide>
      <div className="grid gap-5 text-sm md:grid-cols-2">
        <div className="space-y-3">
          <p className="admin-label">Cliente</p>
          {(["name", "email", "phone", "city", "address"] as const).map((k) => (
            <input
              key={k}
              className="admin-input"
              placeholder={
                k === "name" ? "Nombre" : k === "email" ? "Correo" : k === "phone" ? "WhatsApp" : k === "city" ? "Ciudad" : "Dirección"
              }
              value={customer[k]}
              onChange={(e) => setCustomer({ ...customer, [k]: e.target.value })}
            />
          ))}
          <p className="text-[0.68rem] opacity-55">
            Si el correo ya existe, el pedido se asocia a ese cliente.
          </p>

          <p className="admin-label mt-4">Clase de envío</p>
          <div className="flex gap-2">
            {(["enviar", "no_enviar"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCls(c)}
                className={`chip border ${cls === c ? "border-[var(--d-accent)] bg-[var(--d-accent)] text-white" : "border-[var(--d-line)]"}`}
              >
                {c === "enviar" ? "Enviar (va al tablero)" : "No enviar (nunca aparece)"}
              </button>
            ))}
          </div>

          <input
            className="admin-input mt-3"
            placeholder="Referencia de pago (transferencia, efectivo…)"
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
          />
          <textarea
            className="admin-input h-16"
            placeholder="Notas internas"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="space-y-3">
          <p className="admin-label">Productos</p>
          <select
            className="admin-input"
            value=""
            onChange={(e) => {
              const opt = options.find((o) => o.variantId === Number(e.target.value));
              if (!opt) return;
              if (items.some((i) => i.variantId === opt.variantId)) return;
              setItems([...items, { ...opt, quantity: 1 }]);
            }}
          >
            <option value="">Añadir producto…</option>
            {options.map((o) => (
              <option key={o.variantId} value={o.variantId} disabled={o.stock <= 0}>
                {o.label} {o.stock <= 0 ? "· AGOTADO" : `· ${o.stock} uds`}
              </option>
            ))}
          </select>

          <ul className="space-y-2">
            {items.map((i) => (
              <li key={i.variantId} className="flex items-center gap-2 text-xs">
                <span className="flex-1">{i.label}</span>
                <input
                  type="number"
                  min={1}
                  max={i.stock}
                  className="admin-input max-w-[4.5rem] py-1"
                  value={i.quantity}
                  onChange={(e) =>
                    setItems(
                      items.map((x) =>
                        x.variantId === i.variantId ? { ...x, quantity: Number(e.target.value) } : x,
                      ),
                    )
                  }
                />
                {i.quantity > i.stock && <span className="text-[var(--d-danger)]">sin stock</span>}
                <button className="text-[var(--d-danger)]" onClick={() => setItems(items.filter((x) => x.variantId !== i.variantId))}>
                  ✕
                </button>
              </li>
            ))}
          </ul>

          {totals && (
            <div className="card-soft space-y-1 p-3 text-xs">
              <Row label="Subtotal" value={formatCOP(totals.subtotalCents)} />
              {totals.applied.map((a) => (
                <Row key={a.id} label={a.label} value={`− ${formatCOP(a.amountCents)}`} />
              ))}
              <Row label="Total" value={formatCOP(totals.totalCents)} bold />
            </div>
          )}

          {error && <p className="text-xs text-[var(--d-danger)]">{error}</p>}

          <button
            className="dash-btn dash-btn-primary w-full"
            disabled={busy}
            onClick={() =>
              run(async () => {
                setError("");
                const { ok, error, json } = await postJson<{ displayId?: string }>(
                  "/api/admin/orders",
                  {
                    action: "create_manual",
                    customer,
                    items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
                    fulfillmentClass: cls,
                    paymentRef: payment,
                    notes,
                  },
                );
                if (!ok) {
                  setError(error ?? "No se pudo crear el pedido.");
                  return;
                }
                setItems([]);
                setCustomer({ name: "", email: "", phone: "", city: "", address: "" });
                onDone(`Pedido ${json.displayId} creado`, "ok");
              })
            }
          >
            Crear pedido
          </button>
        </div>
      </div>
    </Modal>
  );
}
