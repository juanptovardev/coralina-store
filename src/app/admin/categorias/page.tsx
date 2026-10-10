"use client";

import { useEffect, useState } from "react";
import { Card, ConfirmDialog, EmptyState, Modal, PageHeader, Skeleton, Toast, useBusy, useJson } from "@/components/admin/ui";
import type { SizeChartColumn, SizeChartRow } from "@/db/schema";

type Cat = {
  id: number;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  productCount: number;
  chart: { unit: "cm" | "in"; columns: SizeChartColumn[]; rows: SizeChartRow[] } | null;
};

export default function CategoriasPage() {
  const { data, loading, reload } = useJson<{ categories: Cat[] }>("/api/admin/catalog");
  const [selected, setSelected] = useState<number | null>(null);
  const [columns, setColumns] = useState<SizeChartColumn[]>([]);
  const [rows, setRows] = useState<SizeChartRow[]>([]);
  const [unit, setUnit] = useState<"cm" | "in">("cm");
  const [backfill, setBackfill] = useState(true);
  const [toast, setToast] = useState("");
  const [tone, setTone] = useState<"ok" | "error">("ok");
  const [creating, setCreating] = useState(false);
  const [newCat, setNewCat] = useState({ name: "", description: "", imageUrl: "", inherit: 0 });
  const [confirmBox, setConfirmBox] = useState<{
    title: string;
    message: string;
    subtitle?: string;
    onOk: () => void;
  } | null>(null);
  const { busy, run } = useBusy();

  const cats = data?.categories ?? [];
  const current = cats.find((c) => c.id === selected) ?? null;

  useEffect(() => {
    if (!selected && cats.length > 0) setSelected(cats[0].id);
  }, [cats, selected]);

  useEffect(() => {
    if (current?.chart) {
      setColumns(current.chart.columns);
      setRows(current.chart.rows);
      setUnit(current.chart.unit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, data]);

  async function save() {
    const res = await fetch("/api/admin/catalog", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "save_size_chart",
        categoryId: selected,
        columns,
        rows,
        unit,
        backfillVariants: backfill,
      }),
    });
    const json = await res.json();
    setTone(json.ok ? "ok" : "error");
    setToast(
      json.ok
        ? `Tabla guardada${json.createdVariants ? ` · ${json.createdVariants} variantes nuevas creadas` : ""}`
        : json.error,
    );
    if (json.ok) reload();
  }

  function convert(next: "cm" | "in") {
    if (next === unit) return;
    const factor = next === "in" ? 1 / 2.54 : 2.54;
    setRows(
      rows.map((r) => {
        const out: SizeChartRow = { ...r };
        for (const c of columns) {
          if (c.type === "number" && typeof r[c.key] === "number") {
            out[c.key] = Math.round(Number(r[c.key]) * factor * 10) / 10;
          }
        }
        return out;
      }),
    );
    setUnit(next);
  }

  return (
    <div>
      <PageHeader
        title="Categorías y tablas de tallas"
        subtitle="Cada categoría tiene su propia tabla con columnas libres. De aquí salen las variantes de cada producto y la «Guía de tallas» que ve la clienta."
        actions={
          <button className="dash-btn dash-btn-primary" onClick={() => setCreating(true)}>
            + Nueva categoría
          </button>
        }
      />

      {loading ? (
        <Skeleton rows={5} />
      ) : cats.length === 0 ? (
        <EmptyState
          title="No hay categorías"
          hint="Crea la primera categoría para poder añadir productos."
          actionLabel="Crear categoría"
          onAction={() => setCreating(true)}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <div className="space-y-2">
            {cats.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selected === c.id
                    ? "border-[var(--d-accent)] bg-white"
                    : "border-[var(--d-line)] bg-white/50 hover:border-[var(--d-accent)]/50"
                }`}
              >
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-[0.7rem] opacity-55">
                  {c.productCount} productos · {c.chart?.rows.length ?? 0} tallas
                </p>
              </button>
            ))}
          </div>

          <Card>
            {!current ? (
              <p className="text-sm opacity-60">Selecciona una categoría.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl">{current.name}</h2>
                    <p className="text-xs opacity-60">{current.description || "Sin descripción"}</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-[var(--d-panel-2)] p-1 text-xs">
                    {(["cm", "in"] as const).map((u) => (
                      <button
                        key={u}
                        onClick={() => convert(u)}
                        className={`rounded-full px-3 py-1 ${unit === u ? "bg-[var(--d-bg)] text-white" : "opacity-60"}`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5 overflow-x-auto scroll-thin">
                  <table className="dash-table min-w-[520px]">
                    <thead>
                      <tr className="border-b border-[var(--d-line)] text-left">
                        {columns.map((c, ci) => (
                          <th key={c.key} className="px-2 py-2">
                            <input
                              className="admin-input py-1 text-xs"
                              value={c.label}
                              disabled={c.locked}
                              onChange={(e) => {
                                const next = [...columns];
                                next[ci] = { ...c, label: e.target.value };
                                setColumns(next);
                              }}
                            />
                            {!c.locked && (
                              <button
                                className="mt-1 text-[0.65rem] text-[var(--d-danger)]"
                                onClick={() =>
                                  setConfirmBox({
                                    title: "Quitar columna",
                                    message: `Quitarás la columna «${c.label}» de la tabla local. Se aplica al guardar. ¿Confirmas?`,
                                    subtitle: "Solo se persiste al pulsar «Guardar tabla»",
                                    onOk: () => {
                                      setColumns(columns.filter((x) => x.key !== c.key));
                                      setRows(
                                        rows.map((r) => {
                                          const copy = { ...r };
                                          delete copy[c.key];
                                          return copy;
                                        }),
                                      );
                                    },
                                  })
                                }
                              >
                                quitar columna
                              </button>
                            )}
                          </th>
                        ))}
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, ri) => (
                        <tr key={ri} >
                          {columns.map((c) => (
                            <td key={c.key} className="px-2 py-1.5">
                              <input
                                className="admin-input py-1"
                                value={String(r[c.key] ?? "")}
                                onChange={(e) => {
                                  const next = [...rows];
                                  next[ri] = {
                                    ...r,
                                    [c.key]: c.type === "number" ? Number(e.target.value) : e.target.value,
                                  };
                                  setRows(next);
                                }}
                              />
                            </td>
                          ))}
                          <td className="px-2">
                            <button
                              className="text-xs text-[var(--d-danger)]"
                              title="Quitar talla (bloqueado si tiene stock o ventas)"
                              onClick={() =>
                                setConfirmBox({
                                  title: "Quitar talla",
                                  message: `Quitarás la talla «${String(r.size)}» de la tabla local. Se aplica al guardar; si la talla tiene stock o ventas, el sistema lo bloqueará.`,
                                  subtitle: "Solo se persiste al pulsar «Guardar tabla»",
                                  onOk: () => setRows(rows.filter((_, i) => i !== ri)),
                                })
                              }
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="dash-btn"
                    onClick={() => setRows([...rows, { size: "NUEVA" }])}
                  >
                    + Añadir talla
                  </button>
                  <button
                    className="dash-btn"
                    onClick={() => {
                      const key = `col_${columns.length}`;
                      setColumns([...columns, { key, label: "Nueva medida", type: "number" }]);
                    }}
                  >
                    + Añadir columna
                  </button>
                </div>

                <label className="mt-4 flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={backfill} onChange={(e) => setBackfill(e.target.checked)} />
                  Crear las variantes faltantes en los {current.productCount} productos de esta categoría
                </label>

                <div className="mt-4 flex items-center gap-3">
                  <button
                    className="dash-btn dash-btn-primary"
                    disabled={busy}
                    onClick={() => run(save)}
                  >
                    Guardar tabla
                  </button>
                  <p className="text-[0.7rem] opacity-60">
                    Si intentas borrar una talla con stock o con pedidos históricos, el sistema lo bloquea
                    y solo la desactiva.
                  </p>
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nueva categoría">
        <div className="space-y-4 text-sm">
          <div>
            <label className="admin-label">Nombre</label>
            <input
              className="admin-input"
              value={newCat.name}
              onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
              placeholder="Panty"
            />
          </div>
          <div>
            <label className="admin-label">Descripción</label>
            <input
              className="admin-input"
              value={newCat.description}
              onChange={(e) => setNewCat({ ...newCat, description: e.target.value })}
            />
          </div>
          <div>
            <label className="admin-label">Imagen (URL)</label>
            <input
              className="admin-input"
              value={newCat.imageUrl}
              onChange={(e) => setNewCat({ ...newCat, imageUrl: e.target.value })}
            />
          </div>
          <div>
            <label className="admin-label">Tabla de tallas</label>
            <select
              className="admin-input"
              value={newCat.inherit}
              onChange={(e) => setNewCat({ ...newCat, inherit: Number(e.target.value) })}
            >
              <option value={0}>Crear nueva (talla única U)</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  Heredar de {c.name}
                </option>
              ))}
            </select>
          </div>
          <button
            className="dash-btn dash-btn-primary w-full"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const res = await fetch("/api/admin/catalog", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    action: "create_category",
                    name: newCat.name,
                    description: newCat.description,
                    imageUrl: newCat.imageUrl,
                    inheritFromCategoryId: newCat.inherit,
                  }),
                });
                const json = await res.json();
                setTone(json.ok ? "ok" : "error");
                setToast(json.ok ? "Categoría creada" : json.error);
                if (json.ok) {
                  setCreating(false);
                  setNewCat({ name: "", description: "", imageUrl: "", inherit: 0 });
                  reload();
                }
              })
            }
          >
            Crear categoría
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmBox !== null}
        onClose={() => setConfirmBox(null)}
        title={confirmBox?.title ?? ""}
        message={confirmBox?.message ?? ""}
        subtitle={confirmBox?.subtitle}
        onConfirm={() => confirmBox?.onOk()}
      />

      <Toast message={toast} tone={tone} />
    </div>
  );
}
