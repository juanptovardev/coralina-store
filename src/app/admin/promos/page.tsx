"use client";

import { useEffect, useState } from "react";
import { Badge, Card, EmptyState, Modal, PageHeader, Toast, useJson } from "@/components/admin/ui";
import { formatCOP } from "@/lib/constants";
import type { StoreProduct } from "@/lib/queries";

type Promo = {
  id: number;
  name: string;
  type: string;
  categoryIds: number[];
  percent: number;
  amountCents: number;
  minQty: number;
  minSubtotalCents: number;
  comboPriceCents: number;
  priority: number;
  stackable: boolean;
  code: string;
  enabled: boolean;
  usageCount: number;
  state: string;
};

const TYPES = [
  { value: "category_percent", label: "% por categoría" },
  { value: "category_amount", label: "Monto fijo por categoría" },
  // sku_percent oculto: el storefront solo interpreta 1 productId y este form
  // no tiene picker de productos; crearlo aquí produciría una promo muerta.
  { value: "combo", label: "Combo / set" },
  { value: "cart_amount", label: "Descuento por monto de carrito" },
];

export default function PromosPage() {
  const { data, loading, reload } = useJson<{ promotions: Promo[] }>("/api/admin/promos");
  const { data: catalog } = useJson<{ categories: { id: number; name: string }[]; products: StoreProduct[] }>(
    "/api/admin/catalog",
  );
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState("");
  const [tone, setTone] = useState<"ok" | "error">("ok");
  const [form, setForm] = useState({
    name: "",
    type: "category_percent",
    categoryIds: [] as number[],
    productIds: [] as number[],
    percent: 10,
    amountCents: 0,
    minQty: 2,
    minSubtotalCents: 0,
    comboPriceCents: 0,
    priority: 10,
    code: "",
  });

  // preview del motor con un carrito de prueba (2 productos reales)
  const [preview, setPreview] = useState<{
    subtotalCents: number;
    discountCents: number;
    totalCents: number;
    applied: { id: number; label: string; amountCents: number }[];
  } | null>(null);

  const sampleItems = (catalog?.products ?? [])
    .flatMap((p) => p.variants.slice(0, 1).map((v) => ({ variantId: v.id, quantity: 1 })))
    .slice(0, 2);

  useEffect(() => {
    if (sampleItems.length === 0) return;
    fetch("/api/cart/evaluate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: sampleItems }),
    })
      .then((r) => r.json())
      .then((j) => setPreview(j?.applied ? j : null))
      .catch(() => setPreview(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, data]);

  async function post(body: Record<string, unknown>) {
    const res = await fetch("/api/admin/promos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setTone(json.ok ? "ok" : "error");
    setToast(json.ok ? "Listo" : json.error);
    if (json.ok) reload();
  }

  const promos = data?.promotions ?? [];

  return (
    <div>
      <PageHeader
        title="Promos y combos"
        subtitle="Un solo motor de evaluación: lo que ves aquí es exactamente lo que calcula el carrito de la tienda. Prioridad menor = se aplica primero."
        actions={
          <button className="dash-btn dash-btn-primary" onClick={() => setCreating(true)}>
            + Nueva promoción
          </button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div>
          {loading ? (
            <Card>Cargando…</Card>
          ) : promos.length === 0 ? (
            <EmptyState
              title="Sin promociones"
              hint="Crea un % por categoría o un combo de dos piezas."
              actionLabel="Nueva promoción"
              onAction={() => setCreating(true)}
            />
          ) : (
            <div className="space-y-3">
              {promos.map((p) => (
                <Card key={p.id} className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{p.name}</p>
                      <Badge
                        tone={p.state === "activa" ? "green" : p.state === "pausada" ? "slate" : "amber"}
                      >
                        {p.state}
                      </Badge>
                      {p.code ? <Badge tone="blue">{p.code}</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs opacity-60">
                      {TYPES.find((t) => t.value === p.type)?.label} ·{" "}
                      {p.type === "combo"
                        ? `${p.minQty} piezas por ${formatCOP(p.comboPriceCents)}`
                        : p.percent
                          ? `${p.percent}%`
                          : formatCOP(p.amountCents)}{" "}
                      · prioridad {p.priority}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="dash-btn px-2.5 py-1"
                      onClick={() => post({ action: "toggle", id: p.id })}
                    >
                      {p.enabled ? "Pausar" : "Activar"}
                    </button>
                    <button
                      className="dash-btn dash-btn-danger px-2.5 py-1"
                      onClick={() => {
                        if (confirm(`¿Eliminar «${p.name}»?`)) {
                          const pw = window.prompt("Clave del admin para confirmar el borrado:");
                          if (pw !== null) post({ action: "delete", id: p.id, password: pw });
                        }
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Card className="h-fit">
          <p className="admin-label">Preview del motor</p>
          <p className="text-[0.7rem] opacity-60">
            Carrito de prueba con {sampleItems.length} producto(s) del catálogo.
          </p>
          {preview ? (
            <div className="mt-3 space-y-1 text-xs">
              <Line label="Subtotal" value={formatCOP(preview.subtotalCents)} />
              {preview.applied.map((a) => (
                <Line key={a.id} label={a.label} value={`− ${formatCOP(a.amountCents)}`} accent />
              ))}
              <div className="border-t border-[var(--d-line)] pt-2">
                <Line label="Total" value={formatCOP(preview.totalCents)} bold />
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs opacity-55">Sin datos de carrito.</p>
          )}
          <p className="mt-4 text-[0.68rem] opacity-55">
            Reglas: se ordena por prioridad y se aplica solo la promo de mayor prioridad que cumple
            (los descuentos no se apilan).
          </p>
        </Card>
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="Nueva promoción" wide>
        <div className="grid gap-4 text-sm md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label className="admin-label">Nombre</label>
              <input
                className="admin-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="20% en enterizos"
              />
            </div>
            <div>
              <label className="admin-label">Tipo</label>
              <select
                className="admin-input"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            {form.type !== "cart_amount" && (
            <div>
              <label className="admin-label">Categorías elegibles</label>
              <div className="flex flex-wrap gap-2">
                {(catalog?.categories ?? []).map((c) => {
                  const on = form.categoryIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      className={`chip border ${on ? "border-[var(--d-accent)] bg-[var(--d-accent)] text-white" : "border-[var(--d-line)]"}`}
                      onClick={() =>
                        setForm({
                          ...form,
                          categoryIds: on
                            ? form.categoryIds.filter((x) => x !== c.id)
                            : [...form.categoryIds, c.id],
                        })
                      }
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
            )}
          </div>

          <div className="space-y-3">
            {(form.type === "category_percent" || form.type === "sku_percent") && (
              <div>
                <label className="admin-label">Porcentaje</label>
                <input
                  type="number"
                  className="admin-input"
                  value={form.percent}
                  onChange={(e) => setForm({ ...form, percent: Number(e.target.value) })}
                />
              </div>
            )}
            {(form.type === "category_amount" || form.type === "cart_amount") && (
              <div>
                <label className="admin-label">Monto del descuento (COP)</label>
                <input
                  type="number"
                  className="admin-input"
                  value={form.amountCents / 100}
                  onChange={(e) => setForm({ ...form, amountCents: Number(e.target.value) * 100 })}
                />
              </div>
            )}
            {form.type === "cart_amount" && (
              <div>
                <label className="admin-label">Monto mínimo del carrito (COP)</label>
                <input
                  type="number"
                  className="admin-input"
                  value={form.minSubtotalCents / 100}
                  onChange={(e) => setForm({ ...form, minSubtotalCents: Number(e.target.value) * 100 })}
                />
              </div>
            )}
            {form.type === "combo" && (
              <>
                <div>
                  <label className="admin-label">Piezas requeridas</label>
                  <input
                    type="number"
                    className="admin-input"
                    value={form.minQty}
                    onChange={(e) => setForm({ ...form, minQty: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="admin-label">Precio del combo (COP)</label>
                  <input
                    type="number"
                    className="admin-input"
                    value={form.comboPriceCents / 100}
                    onChange={(e) => setForm({ ...form, comboPriceCents: Number(e.target.value) * 100 })}
                  />
                </div>
              </>
            )}
            <div>
              <label className="admin-label">Código promocional (opcional)</label>
              <input
                className="admin-input"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="MAREA15"
              />
            </div>
            <div>
              <label className="admin-label">Prioridad (menor se aplica primero)</label>
              <input
                type="number"
                className="admin-input"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
              />
            </div>
            <button
              className="dash-btn dash-btn-primary w-full"
              onClick={async () => {
                // minQty solo es editable para combo; para el resto debe nacer
                // neutral (0) o el server exigiría unidades que el drawer no
                // advertía antes del fix de minQty. El código se normaliza en
                // la frontera (trim + upper) igual que en la API.
                await post({
                  action: "create",
                  ...form,
                  minQty: form.type === "combo" ? form.minQty : 0,
                  code: form.code.trim().toUpperCase(),
                });
                setCreating(false);
              }}
            >
              Crear promoción
            </button>
          </div>
        </div>
      </Modal>

      <Toast message={toast} tone={tone} />
    </div>
  );
}

function Line({
  label,
  value,
  accent,
  bold,
}: {
  label: string;
  value: string;
  accent?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <span className={accent ? "text-[var(--d-accent)]" : "opacity-65"}>{label}</span>
      <span className={`${accent ? "text-[var(--d-accent)]" : ""} ${bold ? "font-semibold" : ""}`}>
        {value}
      </span>
    </div>
  );
}
