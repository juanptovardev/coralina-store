"use client";

import { useEffect, useState } from "react";
import { Badge, Card, Modal, PageHeader, Toast, useJson } from "@/components/admin/ui";
import type { Actor } from "@/lib/session";

type Entry = {
  id: number;
  actorName: string;
  actorRole: string;
  module: string;
  entityType: string;
  entityId: string;
  action: string;
  summary: string;
  createdAt: string;
};

type Purge = { id: number; month: string; deletedCount: number; actorName: string; createdAt: string };

const ACTIONS = ["create", "update", "delete_soft", "delete_hard", "status_change", "publish", "purge_audit"];
const MODULES = ["productos", "pedidos", "envios", "inventario", "clientes", "diseno", "promos", "auditoria"];

const ACTION_TONE: Record<string, "green" | "blue" | "amber" | "red" | "coral" | "slate"> = {
  create: "green",
  update: "blue",
  status_change: "amber",
  publish: "coral",
  delete_soft: "slate",
  delete_hard: "red",
  purge_audit: "red",
};

export default function AuditoriaPage() {
  const [filters, setFilters] = useState({ role: "all", module: "all", action: "all", q: "", from: "", to: "" });
  // Debounce del texto libre (280 ms, igual que Clientes): evita un fetch por tecla.
  const [dq, setDq] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDq(filters.q), 280);
    return () => clearTimeout(t);
  }, [filters.q]);
  const query = new URLSearchParams({ ...filters, q: dq }).toString();
  const { data, loading, reload } = useJson<{ entries: Entry[]; purges: Purge[] }>(`/api/admin/audit?${query}`);
  const { data: actor } = useJson<Actor>("/api/admin/session");
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [month, setMonth] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [tone, setTone] = useState<"ok" | "error">("ok");

  const entries = data?.entries ?? [];
  const byDay = entries.reduce<Record<string, Entry[]>>((acc, e) => {
    const day = new Date(e.createdAt).toLocaleDateString("es-CO", { dateStyle: "full" });
    (acc[day] ??= []).push(e);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Auditoría"
        subtitle="Cada mutación del sistema queda registrada en el backend, en lenguaje claro. La purga solo acepta un mes calendario completo y deja un registro inmutable."
        actions={
          <>
            <a className="dash-btn" href={`/api/admin/audit?${query}&format=csv`}>
              Exportar CSV
            </a>
            <button className="dash-btn dash-btn-primary" onClick={() => setPurgeOpen(true)}>
              Purgar un mes
            </button>
          </>
        }
      />

      <Card className="mb-5 grid gap-3 md:grid-cols-6">
        <input
          className="admin-input md:col-span-2"
          placeholder="Buscar texto, #CR-1042, actor…"
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
        />
        <select className="admin-input" value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value })}>
          <option value="all">Todos los roles</option>
          <option value="admin">Admin</option>
          <option value="asesor">Asesor</option>
          <option value="system">Sistema</option>
        </select>
        <select className="admin-input" value={filters.module} onChange={(e) => setFilters({ ...filters, module: e.target.value })}>
          <option value="all">Todos los módulos</option>
          {MODULES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select className="admin-input" value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })}>
          <option value="all">Todas las acciones</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input type="date" className="admin-input" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          <input type="date" className="admin-input" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        </div>
      </Card>

      {loading ? (
        <Card>Cargando bitácora…</Card>
      ) : entries.length === 0 ? (
        <Card>No hay registros con esos filtros.</Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(byDay).map(([day, list]) => (
            <div key={day}>
              <p className="admin-label">{day}</p>
              <div className="mt-2 space-y-2">
                {list.map((e) => (
                  <Card key={e.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="font-mono text-xs opacity-55">
                      {new Date(e.createdAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <Badge tone={ACTION_TONE[e.action] ?? "slate"}>{e.action}</Badge>
                    <Badge tone="slate">{e.module}</Badge>
                    <span className="flex-1 text-sm">{e.summary}</span>
                    <span className="text-[0.68rem] opacity-50">
                      {e.actorName} · {e.entityType}
                      {e.entityId ? ` ${e.entityId}` : ""}
                    </span>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Card className="mt-8">
        <p className="admin-label">Registro inmutable de purgas</p>
        {(data?.purges ?? []).length === 0 ? (
          <p className="mt-2 text-xs opacity-55">Nunca se ha purgado la bitácora.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs opacity-75">
            {data?.purges.map((p) => (
              <li key={p.id}>
                · {new Date(p.createdAt).toLocaleString("es-CO")} — {p.actorName} purgó {p.deletedCount}{" "}
                registros del mes {p.month}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={purgeOpen} onClose={() => setPurgeOpen(false)} title="Purgar un mes calendario">
        {!actor?.canPurgeAudit ? (
          <div className="rounded-xl bg-[#fde8e6] p-4 text-sm text-[#b3261e]">
            Solo un Admin puede purgar la bitácora. La API responde 403 al rol Asesor.
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <p className="rounded-xl bg-[#fde8e6] p-3 text-xs text-[#b3261e]">
              Se eliminan todos los registros del mes elegido. No se permiten días sueltos ni varios meses
              a la vez. Queda un registro inmutable de esta purga.
            </p>
            <div>
              <label className="admin-label">Mes (YYYY-MM)</label>
              <input
                type="month"
                className="admin-input"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
            <div>
              <label className="admin-label">Escribe el mes de nuevo para confirmar</label>
              <input className="admin-input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="2026-07" />
            </div>
            <div>
              <label className="admin-label">Reautenticación (clave del admin)</label>
              <input type="password" className="admin-input" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-xs text-[var(--d-danger)]">{error}</p>}
            <button
              className="w-full rounded-full bg-[#b3261e] px-5 py-2.5 text-sm text-white disabled:opacity-40"
              disabled={!month || confirmText !== month || !password}
              onClick={async () => {
                setError("");
                const res = await fetch("/api/admin/audit", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ action: "purge_month", month, confirmText, password }),
                });
                const json = await res.json();
                if (!res.ok || !json.ok) {
                  setError(json.error ?? "No se pudo purgar.");
                  return;
                }
                setPurgeOpen(false);
                setTone("ok");
                setToast(`Purgados ${json.deleted} registros de ${month}`);
                reload();
              }}
            >
              Purgar mes definitivamente
            </button>
          </div>
        )}
      </Modal>

      <Toast message={toast} tone={tone} />
    </div>
  );
}
