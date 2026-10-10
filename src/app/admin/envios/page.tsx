"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, Card, Drawer, Modal, PageHeader, Stat, Toast, useBusy, useJson } from "@/components/admin/ui";
import { SHIPMENT_COLUMNS, formatCOP } from "@/lib/constants";

type Trace = { status: string; at: string; by: string };

type ShipmentCard = {
  id: number;
  orderId: number;
  status: string;
  displayId: string;
  operationalTag: string;
  totalCents: number;
  customerName: string;
  city: string;
  itemCount: number;
  createdAt: string;
  completedAt: string | null;
  archivedAt?: string | null;
  statusHistory?: Trace[];
  orderStatus?: string;
};

const COL_COLOR: Record<string, string> = {
  revision: "#e8a44a",
  despacho: "#c9643c",
  reparto: "#2f6b5e",
  completado: "#1f5c50",
};

const COL_HINT: Record<string, string> = {
  revision: "Recién llegados · verificar pago y datos",
  despacho: "Empacados y listos para el transportador",
  reparto: "En camino a la clienta",
  completado: "Se archiva solo a las 24 horas",
};

function ageLabel(iso: string) {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (h < 1) return "hace minutos";
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

function ageH(c: ShipmentCard) {
  return (Date.now() - new Date(c.createdAt).getTime()) / 3600000;
}

/** Semáforo de edad: >24 h ámbar, >48 h terracota (nunca en «completado»). */
function semaphoreBorder(c: ShipmentCard) {
  const done = c.status === "completado" || c.status === "archivado";
  if (!done && ageH(c) > 48) return "4px solid #a94e2b";
  if (!done && ageH(c) > 24) return "4px solid #e8a44a";
  return `3px solid ${COL_COLOR[c.status] ?? "#e8a44a"}`;
}

function Trace({ hist }: { hist?: Trace[] }) {
  if (!hist?.length) {
    return <span className="text-[0.72rem] text-[var(--d-ink-soft)]">Sin movimientos registrados.</span>;
  }
  return (
    <span className="flex flex-wrap items-center gap-1">
      {hist.map((h, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-[var(--d-ink-soft)]/60">→</span>}
          <span
            className="rounded bg-[var(--d-panel)] px-1.5 py-0.5 text-[0.65rem] text-[var(--d-ink-soft)]"
            title={`${new Date(h.at).toLocaleString()} · ${h.by}`}
          >
            {h.status}
          </span>
        </span>
      ))}
    </span>
  );
}

export default function EnviosPage() {
  const { data, loading, reload } = useJson<{ shipments: ShipmentCard[] }>("/api/admin/shipments");
  const [cards, setCards] = useState<ShipmentCard[]>([]);
  const [dragging, setDragging] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [shakeCol, setShakeCol] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [tone, setTone] = useState<"ok" | "error">("ok");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [reactivateId, setReactivateId] = useState<number | null>(null);
  const { busy, run } = useBusy();

  const reloadRef = useRef(reload);
  useEffect(() => {
    reloadRef.current = reload;
  });

  useEffect(() => {
    if (data?.shipments) setCards(data.shipments);
  }, [data]);

  // Poll 30 s + evento de refresco del resumen (badge del dashboard)
  useEffect(() => {
    const t = setInterval(() => reloadRef.current(), 30000);
    const onRefresh = () => reloadRef.current();
    window.addEventListener("coralina:refresh-summary", onRefresh);
    return () => {
      clearInterval(t);
      window.removeEventListener("coralina:refresh-summary", onRefresh);
    };
  }, []);

  async function move(shipmentId: number, status: string) {
    const card = cards.find((c) => c.id === shipmentId);
    if (!card || card.status === status) return;
    const prev = cards;
    setCards(cards.map((c) => (c.id === shipmentId ? { ...c, status } : c))); // optimista
    const res = await fetch("/api/admin/shipments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "move", shipmentId, status }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setCards(prev); // rollback
      setShakeCol(status); // shake en la columna destino
      setTimeout(() => setShakeCol(null), 700);
      setTone("error");
      setToast(json.error ?? "No se pudo mover la tarjeta");
      return;
    }
    setTone("ok");
    setToast(`${card.displayId} → ${SHIPMENT_COLUMNS.find((c) => c.value === status)?.label ?? status}`);
    reloadRef.current();
    window.dispatchEvent(new Event("coralina:refresh-summary"));
  }

  const match = (c: ShipmentCard) =>
    !q || `${c.displayId} ${c.customerName}`.toLowerCase().includes(q.toLowerCase());

  const active = cards.filter((c) => c.status !== "archivado" && match(c));
  const archived = cards.filter((c) => c.status === "archivado" && match(c));
  const inTransit = active.filter((c) => c.status === "despacho" || c.status === "reparto");
  const revisionList = active.filter((c) => c.status === "revision");
  const staleCount = revisionList.filter((c) => ageH(c) > 24).length;

  const openCard = openId !== null ? cards.find((c) => c.id === openId) ?? null : null;
  const reactivateCard = reactivateId !== null ? cards.find((c) => c.id === reactivateId) ?? null : null;

  async function runArchiveJob() {
    const res = await fetch("/api/admin/shipments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "run_archive_job" }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      archived?: number;
      error?: string;
    };
    if (!res.ok || !json.ok) {
      setTone("error");
      setToast(json.error ?? `No se pudo ejecutar el job de archivado (HTTP ${res.status})`);
      return;
    }
    setTone("ok");
    setToast(`Job de archivado: ${json.archived} tarjeta(s) archivadas`);
    reloadRef.current();
  }

  return (
    <div>
      <PageHeader
        title="Envíos"
        subtitle="Solo entran pedidos con clase «enviar». Un pedido = un envío. Al completar, la tarjeta se archiva automáticamente a las 24 horas."
        actions={
          <>
            <input
              className="dash-input max-w-[13rem]"
              placeholder="Buscar #CR o cliente…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="dash-btn" onClick={() => reloadRef.current()}>
              ↻ Sincronizar
            </button>
            <button className="dash-btn" onClick={() => run(() => runArchiveJob())} disabled={busy}>
              {busy ? "Ejecutando…" : "Ejecutar job 24h"}
            </button>
          </>
        }
      />

      {/* Stats */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="En tablero" value={String(active.length)} hint="envíos activos" />
        <Stat
          label="En Revisión"
          value={String(revisionList.length)}
          trend={staleCount > 0 ? "down" : "flat"}
          hint={`${staleCount} con más de 24 h`}
        />
        <Stat
          label="En tránsito"
          value={String(inTransit.length)}
          hint={`${formatCOP(inTransit.reduce((s, c) => s + c.totalCents, 0))} en ruta`}
        />
        <Stat
          label="Archivados"
          value={String(archived.length)}
          hint="auto a las 24 h de completado"
        />
      </div>

      {loading ? (
        <Card>Cargando tablero…</Card>
      ) : (
        /* Board: carrusel con snap en móvil, grid 2 (md) / 4 (xl) */
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-4">
          {SHIPMENT_COLUMNS.map((col) => {
            const list = active
              .filter((c) => c.status === col.value)
              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            return (
              <div
                key={col.value}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverCol(col.value);
                }}
                onDragLeave={() => setOverCol((o) => (o === col.value ? null : o))}
                onDrop={() => {
                  setOverCol(null);
                  if (dragging !== null) move(dragging, col.value);
                  setDragging(null);
                }}
                className={`flex min-h-[320px] w-[82vw] shrink-0 snap-start flex-col rounded-2xl border p-3 transition md:w-auto ${
                  overCol === col.value
                    ? "border-[var(--d-accent)] bg-[var(--d-accent)]/10"
                    : "border-[var(--d-line)]"
                } ${shakeCol === col.value ? "shake" : ""}`}
              >
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[var(--d-ink-soft)]">
                    {col.label}
                  </p>
                  <span className="rounded-full bg-[var(--d-panel-2)] px-2 py-0.5 text-[0.68rem] font-bold text-[var(--d-ink-soft)]">
                    {list.length}
                  </span>
                </div>
                <p className="mb-2 px-1 text-[0.62rem] text-[var(--d-ink-soft)]">
                  {COL_HINT[col.value]} · {formatCOP(list.reduce((s, c) => s + c.totalCents, 0))}
                </p>
                <div className="flex-1 space-y-2">
                  {list.map((c) => {
                    const overdue = c.status !== "completado" && ageH(c) > 24;
                    return (
                      <article
                        key={c.id}
                        draggable
                        onDragStart={() => setDragging(c.id)}
                        onDragEnd={() => {
                          setDragging(null);
                          setOverCol(null);
                        }}
                        onClick={() => setOpenId(c.id)}
                        title="Arrastra para mover · clic para ver el envío"
                        className={`cursor-grab rounded-lg border border-[var(--d-line)] bg-white p-3 text-xs shadow-[0_1px_2px_rgba(36,26,16,.06)] transition hover:-translate-y-0.5 hover:border-[var(--d-accent)] hover:shadow-md active:cursor-grabbing ${
                          dragging === c.id ? "opacity-40" : ""
                        }`}
                        style={{ borderLeft: semaphoreBorder(c) }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="mono text-[0.76rem] font-bold text-[var(--d-accent)]">
                            {c.displayId}
                          </span>
                          <Badge tone="amber">{c.operationalTag}</Badge>
                        </div>
                        <p className="mt-1.5 text-[0.78rem] font-medium">{c.customerName}</p>
                        <p className="text-[0.68rem] text-[var(--d-ink-soft)]">{c.city}</p>
                        <div className="mt-2 flex items-center justify-between border-t border-[var(--d-line)] pt-2">
                          <span className="text-[0.66rem] text-[var(--d-ink-soft)]">
                            {c.itemCount} ítem(s)
                          </span>
                          <span className="mono text-[0.76rem] font-semibold">
                            {formatCOP(c.totalCents)}
                          </span>
                        </div>
                        <p
                          className={`mt-1 text-[0.62rem] ${
                            overdue ? "font-semibold text-[#a94e2b]" : "text-[var(--d-ink-soft)]"
                          }`}
                        >
                          {ageLabel(c.createdAt)}
                          {overdue ? " · atrasado" : ""}
                        </p>
                        {/* Mover sin arrastrar (táctil / accesible) */}
                        <div
                          className="mt-2 flex flex-wrap gap-1 md:hidden"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {SHIPMENT_COLUMNS.filter((x) => x.value !== c.status).map((x) => (
                            <button
                              key={x.value}
                              className="rounded-full border border-[var(--d-line)] px-2 py-0.5 text-[0.6rem] font-semibold text-[var(--d-ink-soft)]"
                              onClick={() => move(c.id, x.value)}
                            >
                              → {x.label}
                            </button>
                          ))}
                        </div>
                      </article>
                    );
                  })}
                  {list.length === 0 && (
                    <p className="rounded-xl border border-dashed border-[var(--d-line)] py-8 text-center text-[0.7rem] text-[var(--d-ink-soft)]">
                      Arrastra una card aquí
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Card className="mt-6">
        <div className="flex items-center justify-between">
          <p className="admin-label">Archivados ({archived.length})</p>
          <span className="text-xs text-[var(--d-ink-soft)]">tabla de solo lectura</span>
        </div>
        {archived.length === 0 ? (
          <p className="mt-2 text-xs opacity-55">
            Nada archivado todavía. Los envíos completados pasan aquí tras 24 horas.
          </p>
        ) : (
          <table className="dash-table mt-2">
            <thead>
              <tr>
                <th className="py-2">Pedido</th>
                <th className="py-2">Cliente</th>
                <th className="py-2">Total</th>
                <th className="py-2">Trayectoria</th>
                <th className="py-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {archived.map((c) => (
                <tr key={c.id}>
                  <td className="py-2 font-medium">{c.displayId}</td>
                  <td className="py-2">{c.customerName}</td>
                  <td className="py-2">{formatCOP(c.totalCents)}</td>
                  <td className="py-2 text-xs text-[var(--d-ink-soft)]">
                    <Trace hist={c.statusHistory} />
                  </td>
                  <td className="py-2 text-right">
                    <button className="dash-btn px-2.5 py-1" onClick={() => setReactivateId(c.id)}>
                      Reactivar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Drawer del envío: detalle + trayectoria + mover columnas */}
      <Drawer
        open={openCard !== null}
        onClose={() => setOpenId(null)}
        title={openCard?.displayId ?? ""}
        subtitle={openCard ? `${openCard.customerName} · ${openCard.city}` : undefined}
      >
        {openCard && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge tone="amber">{openCard.operationalTag}</Badge>
              <Badge tone="blue">{openCard.status}</Badge>
              {openCard.orderStatus && <Badge tone="neutral">pedido: {openCard.orderStatus}</Badge>}
            </div>
            <div className="dash-panel grid grid-cols-2 gap-3 p-4 text-[0.78rem]">
              <div>
                <p className="dash-label">Total</p>
                <p className="mono mt-1 font-semibold">{formatCOP(openCard.totalCents)}</p>
              </div>
              <div>
                <p className="dash-label">Ítems</p>
                <p className="mono mt-1 font-semibold">{openCard.itemCount}</p>
              </div>
              <div>
                <p className="dash-label">Creado</p>
                <p className="mt-1">{new Date(openCard.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="dash-label">Edad</p>
                <p className="mt-1">{ageLabel(openCard.createdAt)}</p>
              </div>
              {openCard.completedAt && (
                <div>
                  <p className="dash-label">Completado</p>
                  <p className="mt-1">{new Date(openCard.completedAt).toLocaleString()}</p>
                </div>
              )}
              {openCard.archivedAt && (
                <div>
                  <p className="dash-label">Archivado</p>
                  <p className="mt-1">{new Date(openCard.archivedAt).toLocaleString()}</p>
                </div>
              )}
            </div>
            <div>
              <p className="admin-label mb-2">Trayectoria</p>
              <Trace hist={openCard.statusHistory} />
            </div>
            <div>
              <p className="admin-label mb-2">Mover a</p>
              <div className="flex flex-wrap gap-2">
                {SHIPMENT_COLUMNS.filter((x) => x.value !== openCard.status).map((x) => (
                  <button
                    key={x.value}
                    className="dash-btn"
                    onClick={() => {
                      move(openCard.id, x.value);
                      setOpenId(null);
                    }}
                  >
                    → {x.label}
                  </button>
                ))}
              </div>
            </div>
            <a className="dash-btn inline-block" href="/admin/pedidos">
              Ver en Pedidos →
            </a>
          </div>
        )}
      </Drawer>

      {/* Reactivar archivado: modal propio (sin confirm() nativo) */}
      <Modal
        open={reactivateCard !== null}
        onClose={() => setReactivateId(null)}
        title="Reactivar envío archivado"
        subtitle="Volverá a la columna Revisión (default seguro) y quedará auditado."
      >
        <div className="space-y-4 text-[0.85rem]">
          <p>
            Vas a reactivar <span className="mono font-semibold">{reactivateCard?.displayId}</span> de{" "}
            <strong>{reactivateCard?.customerName}</strong>.
          </p>
          <div className="flex justify-end gap-2">
            <button className="dash-btn" onClick={() => setReactivateId(null)}>
              Cancelar
            </button>
            <button
              className="dash-btn dash-btn-primary"
              onClick={() => {
                if (reactivateCard) move(reactivateCard.id, "revision");
                setReactivateId(null);
              }}
            >
              Reactivar a Revisión
            </button>
          </div>
        </div>
      </Modal>

      <Toast message={toast} tone={tone} />
    </div>
  );
}
