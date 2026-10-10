"use client";

import { useMemo, useState } from "react";
import type { SizeChartColumn, SizeChartRow } from "@/db/schema";
import { formatCOP } from "@/lib/constants";

type Cat = {
  id: number;
  name: string;
  chart: { unit: string; columns: SizeChartColumn[]; rows: SizeChartRow[] } | null;
};

const STEPS = ["Información", "Categoría y tallas", "Precio e imágenes", "Preview y publicar"];

export function ProductWizard({
  categories,
  onDone,
}: {
  categories: Cat[];
  onDone: (message: string, tone: "ok" | "error") => void;
}) {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<number | 0>(categories[0]?.id ?? 0);
  const [sizes, setSizes] = useState<Record<string, { on: boolean; stock: number }>>({});
  const [price, setPrice] = useState("");
  const [compareAt, setCompareAt] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [imageInput, setImageInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [featured, setFeatured] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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

  async function uploadFile(file: File) {
    setUploadErr("");
    if (!file.type.startsWith("image/")) {
      setUploadErr("Solo imágenes (JPG, PNG, WEBP, AVIF, GIF).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadErr("La imagen supera 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/admin/uploads", { method: "POST", body: fd });
      const j = await r.json();
      if (j.ok) setImages((prev) => [...prev, j.url as string]);
      else setUploadErr(String(j.error ?? "No se pudo subir la imagen."));
    } catch {
      setUploadErr("Error de red al subir la imagen.");
    } finally {
      setUploading(false);
    }
  }

  async function removeImage(img: string) {
    setImages(images.filter((x) => x !== img));
    if (img.startsWith("/uploads/")) {
      // También elimina el archivo del servidor.
      await fetch(`/api/admin/uploads?url=${encodeURIComponent(img)}`, { method: "DELETE" }).catch(() => {});
    }
  }

  async function submit(status: "draft" | "published") {
    setError("");
    setBusy(true);    const res = await fetch("/api/admin/catalog", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "create_product",
        title,
        description,
        categoryId,
        priceCents: Math.round(Number(price || 0) * 100),
        compareAtCents: compareAt ? Math.round(Number(compareAt) * 100) : null,
        images,
        sizes: activeSizes,
        tags: featured ? ["home"] : [],
        status,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok || !json.ok) {
      setError(json.error ?? "No se pudo guardar.");
      return;
    }
    onDone(status === "published" ? "Producto publicado en la tienda" : "Borrador guardado", "ok");
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
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
            Mostrar en la sección «Lo más deseado» del home (etiqueta <code>home</code>)
          </label>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="admin-label">Categoría (obligatoria)</label>
            <select
              className="admin-input"
              value={categoryId}
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
              Las tallas disponibles salen de la tabla de tallas de la categoría. Si necesitas otra
              medida, edítala en «Categorías y tallas».
            </p>
          </div>
          <div className="card-soft p-4">
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
            <label className="admin-label">Imágenes (sube un archivo o pega la URL)</label>
            <div className="flex gap-2">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                className="admin-input shrink-0 text-xs"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadFile(f);
                  e.target.value = "";
                }}
              />
              {uploading && <span className="self-center text-xs opacity-60">Subiendo…</span>}
            </div>
            {uploadErr && <p className="mt-1 text-xs text-red-400">{uploadErr}</p>}
            <div className="mt-2 flex gap-2">
              <input
                className="admin-input"
                value={imageInput}
                onChange={(e) => setImageInput(e.target.value)}
                placeholder="https://…"
              />
              <button
                className="dash-btn shrink-0 text-xs"
                onClick={() => {
                  if (!imageInput.startsWith("http")) return;
                  setImages([...images, imageInput]);
                  setImageInput("");
                }}
              >
                Añadir
              </button>
            </div>
            <p className="mt-1 text-xs opacity-50">Desde tu equipo (máx 5 MB) o URL externa.</p>
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
                </div>
              ))}
            </div>
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
                {formatCOP(Math.round(Number(price || 0) * 100))}
              </p>
              <p className="mt-2 text-xs opacity-70">{description || "Descripción corta…"}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {activeSizes.map((s) => (
                  <span key={s.size} className="chip bg-[var(--d-panel-2)]">
                    {s.size}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div>
            <p className="admin-label">Checklist de publicación</p>
            <ul className="mt-2 space-y-2 text-xs">
              <Check ok={Boolean(title)} text="Nombre definido" />
              <Check ok={Boolean(categoryId)} text="Categoría asignada" />
              <Check ok={activeSizes.length > 0} text="Al menos una talla activa" />
              <Check ok={Number(price) > 0} text="Precio mayor a 0" />
              <Check ok={images.length > 0} text="Al menos una imagen" />
            </ul>
            <p className="mt-4 text-[0.7rem] opacity-60">
              Al guardar se crean las variantes por talla, sus SKU y su nivel de inventario en la bodega
              principal. Todo queda en la bitácora.
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
        ) : (
          <div className="flex gap-2">
            <button className="dash-btn text-xs" disabled={busy} onClick={() => submit("draft")}>
              Guardar borrador
            </button>
            <button className="dash-btn dash-btn-primary text-xs" disabled={busy} onClick={() => submit("published")}>
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
