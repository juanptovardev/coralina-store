"use client";

import { useEffect, useState } from "react";
import { Badge, Card, Drawer, notify, PageHeader, Stat, Toast, useJson, postJson } from "@/components/admin/ui";
import { formatCOP } from "@/lib/constants";

type CustomerRow = {
  id: number;
  name: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  notes: string;
  orderCount: number;
  ltvCents: number;
  lastOrderAt: string | null;
};

type OrderHist = {
  id: number;
  displayId: string;
  status: string;
  operationalTag: string;
  totalCents: number;
  createdAt: string;
  itemCount: number;
};

type Stats = { total: number; vip: number; recurrentes: number; avgLtvCents: number };

const SEGMENTS = [
  { value: "todos", label: "Todos" },
  { value: "vip", label: "VIP" },
  { value: "recurrentes", label: "Recurrentes" },
  { value: "sin_compras", label: "Sin compras" },
] as const;

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default function ClientesPage() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [segment, setSegment] = useState("todos");
  const [sortLtv, setSortLtv] = useState(true); // ↓ Mayor LTV primero (default v4)
  const [open, setOpen] = useState<CustomerRow | null>(null);
  const [history, setHistory] = useState<OrderHist[] | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 280);
    return () => clearTimeout(t);
  }, [q]);

  // Búsqueda por código: "#CR-1042" o "CR-1042" viaja como ?code=
  const trimmed = debounced.trim().replace(/^#/, "");
  const codeQ = /^cr-?\d/i.test(trimmed) ? trimmed : "";

  const { data, loading } = useJson<{
    customers: CustomerRow[];
    total: number;
    pageSize: number;
    stats?: Stats;
  }>(
    // Con código (#CR-…) no mandamos q: el WHERE sobre nombre/correo anularía
    // el filtro HAVING por código y devolvería 0 filas.
    `/api/admin/customers?q=${encodeURIComponent(codeQ ? "" : debounced)}&page=${page}` +
      `&segment=${segment}&sort=${sortLtv ? "ltv" : "name"}&code=${encodeURIComponent(codeQ)}`,
  );

  const rows = data?.customers ?? [];
  const stats = data?.stats;
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 50)));

  function openCustomer(c: CustomerRow) {
    setOpen(c);
    setHistory(null);
    fetch(`/api/admin/customers?id=${c.id}`)
      .then((r) => r.json())
      .then((j) => setHistory((j.orders ?? []) as OrderHist[]))
      .catch(() => setHistory([]));
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Paginación en servidor (50 por página), búsqueda con retardo y segmentos: VIP ≥ $50.000, recurrentes ≥ 2 pedidos, sin compras."
      />

      {/* Stats globales (sin filtros) */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Clientes" value={String(stats?.total ?? 0)} hint="en la base" />
        <Stat label="VIP" value={String(stats?.vip ?? 0)} hint="LTV ≥ $50.000" />
        <Stat label="Recurrentes" value={String(stats?.recurrentes ?? 0)} hint="2+ pedidos" />
        <Stat label="LTV promedio" value={formatCOP(stats?.avgLtvCents ?? 0)} hint="por cliente" />
      </div>

      <Card className="mb-4 flex flex-wrap items-center gap-3 py-3">
        <input
          className="admin-input max-w-sm"
          placeholder="Buscar nombre, correo, teléfono, ciudad o #CR-1042…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <div className="flex flex-wrap gap-1.5">
          {SEGMENTS.map((s) => (
            <button
              key={s.value}
              className={`chip border ${segment === s.value ? "border-[var(--d-accent)] bg-[var(--d-accent)] text-white" : "border-[var(--d-line)]"}`}
              onClick={() => {
                setSegment(s.value);
                setPage(1);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          className="dash-btn"
          title="Alternar orden"
          onClick={() => setSortLtv((v) => !v)}
        >
          {sortLtv ? "↓ Mayor LTV primero" : "↑ Nombre (A-Z)"}
        </button>
        <span className="text-xs opacity-60">{data?.total ?? 0} clientes</span>
      </Card>

      <div className="dash-panel dash-scroll overflow-auto scroll-thin">
        <table className="dash-table min-w-[760px]">
          <thead>
            <tr>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Ciudad</th>
              <th className="px-4 py-3">Pedidos</th>
              <th className="px-4 py-3">LTV</th>
              <th className="px-4 py-3">Última compra</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="px-4 py-6 text-sm opacity-60" colSpan={5}>
                  Cargando…
                </td>
              </tr>
            )}
            {rows.map((c) => (
              <tr
                key={c.id}
                className="cursor-pointer hover:bg-[var(--d-panel-2)]"
                onClick={() => openCustomer(c)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f5dfa0] text-[0.7rem] font-bold text-[#a94e2b]">
                      {initials(c.name) || "?"}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-[0.68rem] opacity-50">{c.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 opacity-75">{c.city || "—"}</td>
                <td className="px-4 py-3">{c.orderCount}</td>
                <td className="px-4 py-3 font-semibold">{formatCOP(c.ltvCents)}</td>
                <td className="px-4 py-3 text-xs opacity-65">
                  {c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString("es-CO") : "—"}
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-sm opacity-60" colSpan={5}>
                  Sin clientes con esos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-3 text-xs">
        <button className="dash-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Anterior
        </button>
        <span>
          Página {page} de {pages}
        </span>
        <button className="dash-btn" disabled={page >= pages} onClick={() => setPage(page + 1)}>
          Siguiente
        </button>
      </div>

      <Drawer open={Boolean(open)} onClose={() => setOpen(null)} title={open?.name ?? ""}>
        {open && (
          <div className="space-y-4 text-sm">
            <Card>
              <p className="admin-label">Contacto</p>
              <p>{open.email}</p>
              <p className="opacity-70">{open.phone || "Sin teléfono"}</p>
              <p className="opacity-70">
                {open.address || "Sin dirección"}
                {open.city ? `, ${open.city}` : ""}
              </p>
            </Card>
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <p className="admin-label">Pedidos</p>
                <p className="font-display text-2xl">{open.orderCount}</p>
              </Card>
              <Card>
                <p className="admin-label">Valor de vida</p>
                <p className="font-display text-2xl">{formatCOP(open.ltvCents)}</p>
              </Card>
            </div>

            <Card>
              <p className="admin-label">Historial de pedidos</p>
              {history === null ? (
                <p className="mt-2 text-xs opacity-60">Cargando historial…</p>
              ) : history.length === 0 ? (
                <p className="mt-2 text-xs opacity-60">Sin pedidos todavía.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {history.map((o) => (
                    <li
                      key={o.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-[var(--d-line)] bg-[var(--d-panel-2)] px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold">{o.displayId}</p>
                        <p className="opacity-60">
                          {new Date(o.createdAt).toLocaleDateString("es-CO")} · {o.itemCount} ítem(s)
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge tone={o.status === "completed" ? "green" : o.status === "canceled" ? "red" : "slate"}>
                          {o.status}
                        </Badge>
                        <span className="font-semibold">{formatCOP(o.totalCents)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <p className="admin-label">Notas internas</p>
              <textarea
                className="admin-input mt-1 h-20"
                defaultValue={open.notes}
                placeholder="Escribe una nota… se guarda al salir del campo."
                onBlur={async (e) => {
                  const notes = e.target.value;
                  if (notes === open.notes) return;
                  const { ok, error } = await postJson("/api/admin/customers", {
                    action: "update_notes",
                    id: open.id,
                    notes,
                  });
                  if (!ok) {
                    notify(error ?? "No se pudieron guardar las notas", "error");
                    return;
                  }
                  setOpen({ ...open, notes });
                  notify("Notas guardadas (auditadas)");
                }}
              />
            </Card>
          </div>
        )}
      </Drawer>

      <Toast />
    </div>
  );
}
