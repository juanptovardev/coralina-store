"use client";

import { useMemo, useState } from "react";
import { postJson, useBusy } from "@/components/admin/ui";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import type { SizeChartColumn, SizeChartRow } from "@/db/schema";
import { formatCOP } from "@/lib/constants";
import { formatPriceInput, parsePriceInput } from "@/lib/format";

type Cat = {
  id: number;
  name: string;
  chart: { unit: string; columns: SizeChartColumn[]; rows: SizeChartRow[] } | null;
};

const STEPS = ["Información", "Categoría y tallas", "Precio e imágenes", "Preview y publicar"];

export type ProductWizardInitial = {
  id: number;
  title: string;
  description: string;
  categoryId: number;
  priceCents: number;
  compareAtCents: number | null;
  images: string[];
  tags: string[];
  status: string;
  sizes: { size: string; stock: number }[];
};

export function ProductWizard({
  categories,
  onDone,
  initial,
}: {
  categories: Cat[];
  onDone: (message: string, tone: "ok" | "error") => void;
  initial?: ProductWizardInitial | null;
}) {
  const editing = Boolean(initial);
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState<number | 0>(
    initial?.categoryId ?? categories[0]?.id ?? 0,
  );
  const [sizes, setSizes] = useState<Record<string, { on: boolean; stock: number }>>(() => {
    const map: Record<string, { on: boolean; stock: number }> = {};
    for (const s of initial?.sizes ?? []) map[s.size] = { on: true, stock: s.stock };
    return map;
  });
  const [newSizes, setNewSizes] = useState<string[]>([]);
  const [newSizeInput, setNewSizeInput] = useState("");
  const [price, setPrice] = useState(initial ? formatPriceInput(initial.priceCents) : "");
  const [compareAt, setCompareAt] = useState(
    initial?.compareAtCents ? formatPriceInput(initial.compareAtCents) : "",
  );
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [featured, setFeatured] = useState(initial ? initial.tags.includes("home") : true);
  const [error, setError] = useState("");
  const { busy, run } = useBusy();

  const category = categories.find((c) => c.id === categoryId) ?? null;
  const chartRows = category?.chart?.rows ?? [];

  const activeSizes = useMemo(
    () =>
      chartRows
        .map((r) => String(r.size))
        .filter((s) => sizes[s]?.on)
        .map((s) => ({ size: s, stock: sizes[s]?.stock ?? 0 })),
    [chartRows, sizes],
  );

  // Precios: entrada en pesos con formato es-CO, salida en centavos.
  const priceCents = parsePriceInput(price);
  const compareAtCents = compareAt.trim() ? parsePriceInput(compareAt) : null;

  // Gate de publicación: Publicar exige el checklist completo (5/5).
  const checklist = [
    { ok: title.trim().length > 0, text: "Nombre definido" },
    { ok: categoryId > 0, text: "Categoría asignada" },
    {
      ok: editing ? (initial?.sizes.length ?? 0) + newSizes.length > 0 : activeSizes.length > 0,
      text: "Al menos una talla activa",
    },
    { ok: (priceCents ?? 0) > 0, text: "Precio mayor a 0" },
    { ok: images.length > 0, text: "Al menos una imagen" },
  ];
  const missing = checklist.filter((c) => !c.ok).map((c) => c.text);
  const canPublish = missing.length === 0;

  const existingSizeNames = initial?.sizes.map((s) => s.size) ?? [];
  const newSizeTrimmed = newSizeInput.trim();
  const newSizeDup =
    newSizeTrimmed.length > 0 &&
    (existingSizeNames.includes(newSizeTrimmed) || newSizes.includes(newSizeTrimmed));

  function addNewSize() {
    const name = newSizeTrimmed;
    if (!name) return;
    if (existingSizeNames.includes(name) || newSizes.includes(name)) return;
    setNewSizes([...newSizes, name]);
    setNewSizeInput("");
  }

  // La imagen elegida pasa a la primera posición: esa es la portada.
  function makeCover(index: number) {
    if (index <= 0) return;
    setImages((prev) => {
      const next = [...prev];
      const [img] = next.splice(index, 1);
      next.unshift(img);
      return next;
    });
  }

  async function removeImage(img: string) {
    setImages((prev) => prev.filter((x) => x !== img));
    if (img.startsWith("/uploads/")) {
      // También elimina el archivo del servidor.
      await fetch(`/api/admin/uploads?url=${encodeURIComponent(img)}`, { method: "DELETE" }).catch(() => {});
    }
  }

  // Al editar se conservan las demás etiquetas: solo se agrega/quita «home».
  function tagsPayload(): string[] {
    const base = initial?.tags ?? [];
    return featured ? [...new Set([...base, "home"])] : base.filter((t) => t !== "home");
  }

  const dirty = Boolean(
    initial &&
      (title !== initial.title ||
        description !== initial.description ||
        (priceCents !== null && priceCents !== initial.priceCents) ||
        (compareAtCents ?? null) !== initial.compareAtCents ||
        images.join("\n") !== initial.images.join("\n") ||
        tagsPayload().join("|") !== initial.tags.join("|") ||
        newSizes.length > 0),
  );

  const previewSizes = useMemo(
    () =>
      editing
        ? [...(initial?.sizes ?? []).map((s) => s.size), ...newSizes]
        : activeSizes.map((s) => s.size),
    [editing, initial, newSizes, activeSizes],
  );

  async function submit(status: "draft" | "published" | "archived") {
    setError("");
    if (priceCents === null) {
      setError("Revisa el precio: usa números como 28990 o 28.990,50.");
      return;
    }
    if (compareAt.trim() && compareAtCents === null) {
      setError("Revisa el precio tachado: usa números como 339000 o 33.900.");
      return;
    }
    await run(async () => {
      const { ok, error } = await postJson(
        "/api/admin/catalog",
        initial
          ? {
              action: "update_product",
              id: initial.id,
              title,
              categoryId,
              priceCents,
              compareAtCents,
              status,
              description,
              images,
              tags: tagsPayload(),
              // Solo tallas NUEVAS: las existentes no se tocan.
              sizes: newSizes.map((s) => ({ size: s })),
            }
          : {
              action: "create_product",
              title,
              description,
              categoryId,
              priceCents,
              compareAtCents,
              images,
              sizes: activeSizes,
              tags: featured ? ["home"] : [],
              status,
            },
      );
      if (!ok) {
        setError(error ?? "No se pudo guardar.");
        return;
      }
      onDone(
        initial
          ? "Producto actualizado"
          : status === "published"
            ? "Producto publicado en la tienda"
            : "Borrador guardado",
        "ok",
      );
    });
  }

  return (
    <div className="text-sm">
      <ol className="mb-5 flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`chip ${i === step ? "bg-[var(--d-accent)] text-white" : i < step ? "bg-[#dcece7] text-[#1f5c50]" : "bg-[var(--d-panel-2)]"}`}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-4">
          <div>
            <label className="admin-label">Nombre del producto</label>
            <input
              className="admin-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bikini Coralina Verde Palma"
            />
          </div>
          <div>
            <label className="admin-label">Descripción corta</label>
            <textarea
              className="admin-input h-28"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Triangular con lazos ajustables, tela italiana UV50+…"
            />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
            />
            Mostrar en la sección «Lo más deseado» del home (etiqueta <code>home</code>)
          </label>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="admin-label">Categoría {editing ? "(no editable al editar)" : "(obligatoria)"}</label>
            <select
              className="admin-input"
              value={categoryId}
              disabled={editing}
              onChange={(e) => {
                setCategoryId(Number(e.target.value));
                setSizes({});
              }}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[0.7rem] opacity-60">
              {editing
                ? "Mover un producto de categoría cambiaría sus variantes; se gestiona creando uno nuevo."
                : "Las tallas disponibles salen de la tabla de tallas de la categoría. Si necesitas otra medida, edítala en «Categorías y tallas»."}
            </p>
          </div>
          <div className="card-soft p-4">
            {editing ? (
              <>
                <p className="admin-label">Tallas existentes</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(initial?.sizes ?? []).map((s) => (
                    <span key={s.size} className="chip bg-[var(--d-panel-2)]">
                      {s.size}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-[0.7rem] opacity-60">
                  Las tallas existentes no se pueden borrar (hay pedidos e inventario que dependen de
                  ellas). Su stock se edita en Inventario.
                </p>
                <div className="mt-4 border-t border-[var(--d-line)] pt-3">
                  <p className="admin-label">Añadir talla nueva</p>
                  <div className="mt-2 flex gap-2">
                    <input
                      className="admin-input max-w-[9rem]"
                      placeholder="Ej. XL"
                      value={newSizeInput}
                      onChange={(e) => setNewSizeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addNewSize();
                      }}
                    />
                    <button
                      className="dash-btn shrink-0 text-xs"
                      disabled={newSizeTrimmed.length === 0 || newSizeDup}
                      title={newSizeDup ? "Esa talla ya existe" : undefined}
                      onClick={addNewSize}
                    >
                      Añadir talla
                    </button>
                  </div>
                  {newSizeDup && <p className="mt-1 text-xs text-[var(--d-danger)]">Esa talla ya existe.</p>}
                  {newSizes.length > 0 && (
                    <p className="mt-2 text-xs">
                      Nuevas: {newSizes.join(", ")}{" "}
                      <span className="opacity-55">(quedan con stock 0; ajústalo en Inventario)</span>
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="admin-label">Tallas a activar y stock inicial</p>
                <div className="mt-2 space-y-2">
                  {chartRows.length === 0 && (
                    <p className="text-xs opacity-60">Esta categoría no tiene tabla de tallas.</p>
                  )}
                  {chartRows.map((r) => {
                    const size = String(r.size);
                    const state = sizes[size] ?? { on: false, stock: 0 };
                    return (
                      <div key={size} className="flex items-center gap-3">
                        <label className="flex w-28 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={state.on}
                            onChange={(e) => setSizes({ ...sizes, [size]: { ...state, on: e.target.checked } })}
                          />
                          <span className="font-medium">{size}</span>
                        </label>
                        <input
                          type="number"
                          min={0}
                          disabled={!state.on}
                          className="admin-input max-w-[7rem] disabled:opacity-40"
                          value={state.stock}
                          onChange={(e) => setSizes({ ...sizes, [size]: { ...state, stock: Number(e.target.value) } })}
                        />
                        <span className="text-xs opacity-55">
                          SKU: {title ? `${title.toUpperCase().slice(0, 8)}…-${size}` : `—-${size}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="admin-label">Precio (COP)</label>
              <input className="admin-input" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="289000" />
            </div>
            <div>
              <label className="admin-label">Precio tachado (opcional)</label>
              <input className="admin-input" value={compareAt} onChange={(e) => setCompareAt(e.target.value)} placeholder="339000" />
            </div>
          </div>
          <div>
            <ImageUploadField label="Imágenes" onUploaded={(url) => setImages((prev) => [...prev, url])} />
            <div className="mt-3 flex flex-wrap gap-2">
              {images.map((img, i) => (
                <div key={img} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="" className="h-24 w-20 rounded object-cover" />
                  {i === 0 && (
                    <span className="chip absolute left-1 top-1 bg-[var(--d-accent)] text-white">1ª</span>
                  )}
                  <button
                    className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-xs text-white"
                    onClick={() => void removeImage(img)}
                  >
                    ×
                  </button>
                  {i > 0 && (
                    <button
                      className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[0.6rem] text-white"
                      onClick={() => makeCover(i)}
                    >
                      Hacer portada
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs opacity-50">
              La primera imagen es la portada. Máximo 12; se aceptan archivos o URLs de
              images.pexels.com.
            </p>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="card-soft overflow-hidden">
            <div className="bg-[var(--d-panel-2)] px-4 py-2 text-[0.68rem] uppercase tracking-wider opacity-60">
              Preview de la ficha (igual que la tienda)
            </div>
            <div className="p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {images[0] ? (
                <img src={images[0]} alt="" className="h-52 w-full rounded-lg object-cover" />
              ) : (
                <div className="flex h-52 items-center justify-center rounded-lg bg-[var(--color-ink)]/5 text-xs opacity-50">
                  Sin imagen
                </div>
              )}
              <p className="kicker mt-3 text-[var(--d-accent)]">{category?.name}</p>
              <h3 className="font-display mt-1 text-2xl">{title || "Nombre del producto"}</h3>
              <p className="mt-1 text-lg font-semibold text-[var(--d-accent)]">
                {formatCOP(priceCents ?? 0)}
              </p>
              <p className="mt-2 text-xs opacity-70">{description || "Descripción corta…"}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {previewSizes.map((s) => (
                  <span key={s} className="chip bg-[var(--d-panel-2)]">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div>
            <p className="admin-label">Checklist de publicación</p>
            <ul className="mt-2 space-y-2 text-xs">
              {checklist.map((c) => (
                <Check key={c.text} ok={c.ok} text={c.text} />
              ))}
            </ul>
            <p className="mt-4 text-[0.7rem] opacity-60">
              {editing
                ? "Los cambios (descripción, imágenes, tallas nuevas) se aplican sobre el producto existente y quedan en la bitácora."
                : "Al guardar se crean las variantes por talla, sus SKU y su nivel de inventario en la bodega principal. Todo queda en la bitácora."}
            </p>
          </div>
        </div>
      )}

      {error && <p className="mt-4 text-xs text-[var(--d-danger)]">{error}</p>}

      <div className="mt-6 flex items-center justify-between">
        <button className="dash-btn text-xs" disabled={step === 0} onClick={() => setStep(step - 1)}>
          Atrás
        </button>
        {step < 3 ? (
          <button className="dash-btn dash-btn-primary text-xs" onClick={() => setStep(step + 1)}>
            Siguiente
          </button>
        ) : initial ? (
          <div className="flex gap-2">
            {initial.status !== "published" && (
              <button
                className="dash-btn text-xs"
                disabled={busy || !canPublish}
                title={canPublish ? undefined : `Falta: ${missing.join(" · ")}`}
                onClick={() => submit("published")}
              >
                Guardar y publicar
              </button>
            )}
            <button
              className="dash-btn dash-btn-primary text-xs"
              disabled={busy || !dirty}
              title={dirty ? undefined : "No hay cambios por guardar"}
              onClick={() => submit(initial.status as "draft" | "published" | "archived")}
            >
              Guardar cambios
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button className="dash-btn text-xs" disabled={busy} onClick={() => submit("draft")}>
              Guardar borrador
            </button>
            <button
              className="dash-btn dash-btn-primary text-xs"
              disabled={busy || !canPublish}
              title={canPublish ? undefined : `Falta: ${missing.join(" · ")}`}
              onClick={() => submit("published")}
            >
              Publicar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Check({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className={`flex items-center gap-2 ${ok ? "text-[#2f6b5e]" : "text-[var(--d-danger)]"}`}>
      <span>{ok ? "✓" : "✕"}</span>
      {text}
    </li>
  );
}
