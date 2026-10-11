"use client";

import { useState } from "react";
import {
  Badge,
  Card,
  csvCell,
  EmptyState,
  notify,
  PageHeader,
  Skeleton,
  Toast,
  useDebouncedValue,
  useJson,
  postJson,
} from "@/components/admin/ui";

type Summary = {
  categoryId: number;
  name: string;
  imageUrl: string;
  stocked: number;
  lowCount: number;
  variantCount: number;
  level: string;
};

type Level = {
  variantId: number;
  size: string;
  sku: string;
  productId: number;
  productTitle: string;
  image: string;
  categoryId: number;
  categoryName: string;
  stocked: number;
  threshold: number;
  updatedAt: string;
};

const LEVEL_TONE: Record<string, "green" | "amber" | "red" | "blue"> = {
  high: "green",
  med: "blue",
  low: "amber",
  out: "red",
};

/** Umbral de la alerta de stock bajo (F5): variantes con stock <= 3. */
const LOW_STOCK_THRESHOLD = 3;

export default function InventarioPage() {
  const { data, loading, reload } = useJson<{ summary: Summary[]; levels: Level[] }>("/api/admin/inventory");
  const [category, setCategory] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q, 300);

  const levels = (data?.levels ?? []).filter((l) => {
    if (category && l.categoryId !== category) return false;
    if (dq && !`${l.productTitle} ${l.sku}`.toLowerCase().includes(dq.toLowerCase())) return false;
    return true;
  });

  // Alerta de stock bajo (F5): sobre TODAS las variantes (ignora filtros de la
  // tabla), incluye agotadas (stock 0) — son las más urgentes.
  const lowStock = (data?.levels ?? [])
    .filter((l) => l.stocked <= LOW_STOCK_THRESHOLD)
    .sort((a, b) => a.stocked - b.stocked);

  async function update(body: Record<string, unknown>) {
    const { ok, error } = await postJson("/api/admin/catalog", body);
    notify(ok ? "Inventario actualizado" : (error ?? "Error al actualizar"), ok ? "ok" : "error");
    reload();
  }

  function exportCsv() {
    const header = ["categoria", "producto", "talla", "sku", "stock", "umbral"].map(csvCell).join(",");
    const body = levels
      .map((l) => [l.categoryName, l.productTitle, l.size, l.sku, l.stocked, l.threshold].map(csvCell).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([`${header}\n${body}`], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "coralina-inventario.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title="Inventario"
        subtitle="Una bodega. El stock se descuenta al confirmar el pedido y se devuelve si se cancela. Las ediciones aquí quedan auditadas y bloquean cambios simultáneos."
        actions={
          <>
            {lowStock.length > 0 && (
              <Badge tone="red" dot title={`Variantes con stock ≤ ${LOW_STOCK_THRESHOLD}`}>
                stock bajo: {lowStock.length}
              </Badge>
            )}
            <button className="dash-btn" onClick={exportCsv}>
              Exportar CSV
            </button>
          </>
        }
      />

      {/* Alertas de stock bajo (F5): ancla #inv-<variantId> lleva a la fila editable */}
      {lowStock.length > 0 && (
        <div
          className="dash-panel mb-4 border border-[#b3261e]/30 bg-[#fde8e6]/40 p-4"
          role="alert"
        >
          <p className="text-[0.8rem] font-semibold text-[var(--d-danger)]">
            Alertas de stock bajo · {lowStock.length} variante(s) con ≤ {LOW_STOCK_THRESHOLD} unidades
          </p>
          <ul className="mt-2 space-y-1.5 text-xs">
            {lowStock.map((l) => (
              <li key={l.variantId} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {l.productTitle} · talla {l.size} ·{" "}
                  <span className="font-mono opacity-70">{l.sku}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone={l.stocked === 0 ? "red" : "amber"}>{l.stocked} uds</Badge>
                  <a
                    className="dash-btn px-2.5 py-0.5 text-[0.7rem]"
                    href={`#inv-${l.variantId}`}
                    onClick={(e) => {
                      // Si hay filtros activos la fila puede no estar renderizada:
                      // se limpian y se hace scroll explícito (la ancla nativa
                      // no resolvería contra una tabla que aún no muestra la fila).
                      if (!category && !dq) return;
                      e.preventDefault();
                      setCategory(null);
                      setQ("");
                      setTimeout(
                        () =>
                          document
                            .getElementById(`inv-${l.variantId}`)
                            ?.scrollIntoView({ behavior: "smooth", block: "center" }),
                        50,
                      );
                    }}
                  >
                    Editar stock
                  </a>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <Skeleton rows={6} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(data?.summary ?? []).map((s) => (
              <button
                key={s.categoryId}
                onClick={() => setCategory(category === s.categoryId ? null : s.categoryId)}
                className={`dash-panel overflow-hidden p-0 text-left transition hover:border-[var(--d-accent)] ${
                  category === s.categoryId ? "border-[var(--d-accent)] ring-2 ring-[var(--d-accent)]/20" : ""
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.imageUrl} alt="" className="h-20 w-full object-cover" />
                <div className="p-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[0.82rem] font-semibold">{s.name}</p>
                    <Badge tone={LEVEL_TONE[s.level] ?? "slate"} dot>
                      {s.level}
                    </Badge>
                  </div>
                  <p className="mono mt-1.5 text-2xl leading-none font-semibold">{s.stocked}</p>
                  <p className="mt-1 text-[0.68rem] text-[var(--d-ink-soft)]">
                    {s.variantCount} variantes · {s.lowCount} bajo umbral
                  </p>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[var(--d-panel-2)]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (s.stocked / 80) * 100)}%`,
                        background: s.level === "out" ? "var(--d-danger)" : s.level === "low" ? "var(--d-warn)" : "var(--d-accent)",
                      }}
                    />
                  </div>
                </div>
              </button>
            ))}
          </div>

          <Card className="mt-5 flex flex-wrap items-center gap-3 py-3">
            <input
              className="admin-input max-w-xs"
              placeholder="Buscar producto o SKU…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {category && (
              <button className="chip bg-[var(--d-accent)] text-white" onClick={() => setCategory(null)}>
                Quitar filtro de categoría ×
              </button>
            )}
            <span className="text-xs opacity-60">{levels.length} variantes</span>
          </Card>

          {levels.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="Sin variantes con esos filtros"
                hint="Prueba a quitar el filtro de categoría o limpiar la búsqueda."
              />
            </div>
          ) : (
            <div className="dash-panel dash-scroll mt-4 overflow-auto scroll-thin">
              <table className="dash-table min-w-[820px]">
              <thead>
                <tr>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">Talla</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Umbral</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {levels.map((l) => (
                  <tr key={l.variantId} id={`inv-${l.variantId}`}>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={l.image} alt="" className="h-10 w-8 rounded object-cover" />
                        <div>
                          <p>{l.productTitle}</p>
                          <p className="text-[0.66rem] opacity-50">{l.categoryName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2">{l.size}</td>
                    <td className="px-4 py-2 font-mono text-xs opacity-70">{l.sku}</td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min={0}
                        defaultValue={l.stocked}
                        className="admin-input max-w-[5.5rem] py-1"
                        onBlur={(e) => {
                          const value = Number(e.target.value);
                          if (value === l.stocked) return;
                          update({
                            action: "update_stock",
                            variantId: l.variantId,
                            stocked: value,
                            expectedUpdatedAt: l.updatedAt,
                          });
                        }}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min={0}
                        defaultValue={l.threshold}
                        className="admin-input max-w-[5rem] py-1"
                        onBlur={(e) => {
                          const value = Number(e.target.value);
                          if (value === l.threshold) return;
                          update({ action: "update_threshold", variantId: l.variantId, threshold: value });
                        }}
                      />
                    </td>
                    <td className="px-4 py-2">
                      {l.stocked === 0 ? (
                        <Badge tone="red">agotado</Badge>
                      ) : l.stocked <= l.threshold ? (
                        <Badge tone="amber">bajo umbral</Badge>
                      ) : (
                        <Badge tone="green">ok</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </>
      )}

      <Toast />
    </div>
  );
}
