"use client";

import { useEffect, useRef, useState } from "react";
import {
  Badge,
  Card,
  ConfirmDialog,
  notify,
  PageHeader,
  Skeleton,
  Toast,
  useBusy,
  useJson,
  postJson,
} from "@/components/admin/ui";
import { LayoutZoneGuide } from "@/components/admin/LayoutZoneGuide";
import { HomeRenderer, type HomeCategory, type HomeProduct } from "@/components/storefront/HomeRenderer";
import { StoreProvider } from "@/components/storefront/shop";
import { BANNER_IMAGES, BANNER_RATIO_MAX, BANNER_RATIO_MIN, LAYOUT_PLANE, TOKEN_LABELS, type LayoutMode } from "@/lib/constants";
import { normalizeLayout, publishChecklist, readBanner } from "@/lib/design";
import type { BannerConfig, SectionInstance, WidgetInstance } from "@/db/schema";
import type { StoreProduct } from "@/lib/queries";

type Layout = {
  id: number;
  name: string;
  mode: LayoutMode;
  status: "draft" | "active" | "archived";
  banner: BannerConfig;
  widgets: WidgetInstance[];
  sections: SectionInstance[];
  version: number;
};

const WIDGET_LABELS: Record<string, string> = {
  kicker: "Kicker (texto pequeño)",
  title: "Título principal",
  subtitle: "Subtítulo",
  cta_primary: "Botón principal",
  cta_secondary: "Botón secundario",
  benefits: "Franja de beneficios",
  slider_dots: "Indicadores de slide",
};

const SECTION_LABELS: Record<string, string> = {
  categories: "Categorías destacadas",
  featured: "Productos destacados",
  editorial: "Banda editorial",
  testimonials: "Testimonios",
  newsletter: "Newsletter",
  footer: "Footer de marca (siempre activo)",
};

export default function DisenoPage() {
  const { data, loading, reload, error } = useJson<{
    layouts: Layout[];
    tokens: Record<string, string>;
    defaults: Record<string, string>;
  }>("/api/admin/design");
  const { data: catalog } = useJson<{ categories: HomeCategory[]; products: StoreProduct[] }>(
    "/api/admin/catalog",
  );

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Layout | null>(null);
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [resetColors, setResetColors] = useState(false);
  const { busy, run } = useBusy();

  const layouts = data?.layouts ?? [];
  // Tras guardar/resetear colores con éxito, el siguiente `data` re-siembra
  // tokens desde el server (autoridad); los demás reload() no pisan ediciones.
  const tokensReseedRef = useRef(false);

  useEffect(() => {
    // Reload fallido: el server queda en estado desconocido → se conservan las
    // ediciones locales y se descarta el flag (evita que un reload posterior
    // exitoso consuma un re-seed vencido y pise los colores no guardados).
    if (error) {
      tokensReseedRef.current = false;
      return;
    }
    if (!data) return;
    if (tokensReseedRef.current) {
      tokensReseedRef.current = false;
      setTokens(data.tokens);
      return;
    }
    setTokens((prev) => (Object.keys(prev).length ? prev : data.tokens));
  }, [data, error]);

  // El draft se inicializa UNA sola vez (primer dato / sin selección): los
  // reload() posteriores —guardar, publicar, colores— no descartan ediciones
  // locales aún no guardadas.
  useEffect(() => {
    if (!data || selectedId !== null) return;
    const target = layouts.find((l) => l.status === "active") ?? layouts[0];
    if (target) {
      setSelectedId(target.id);
      setDraft(normalizeLayout(JSON.parse(JSON.stringify(target))) as Layout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, selectedId]);

  function pick(id: number) {
    const l = layouts.find((x) => x.id === id);
    if (!l) return;
    setSelectedId(id);
    setDraft(normalizeLayout(JSON.parse(JSON.stringify(l))) as Layout);
  }

  function patchWidget(id: string, patch: Partial<WidgetInstance>) {
    if (!draft) return;
    setDraft({
      ...draft,
      widgets: draft.widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    });
  }

  function patchProps(id: string, props: Record<string, unknown>) {
    if (!draft) return;
    setDraft({
      ...draft,
      widgets: draft.widgets.map((w) => (w.id === id ? { ...w, props: { ...w.props, ...props } } : w)),
    });
  }

  async function post(body: Record<string, unknown>, successMsg = "Listo") {
    const { ok, error } = await postJson("/api/admin/design", body);
    notify(ok ? successMsg : (error ?? "Error"), ok ? "ok" : "error");
    if (ok) reload();
    return ok;
  }

  const checklist = draft ? publishChecklist(draft) : [];
  const canPublish = checklist.every((c) => c.ok);
  const products: HomeProduct[] = (catalog?.products ?? [])
    .filter((p) => p.status === "published")
    .map((p) => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      priceCents: p.priceCents,
      compareAtCents: p.compareAtCents,
      images: p.images,
      categoryName: p.categoryName,
      totalStock: p.totalStock,
    }));

  const previewWidth = device === "desktop" ? 1280 : device === "tablet" ? 834 : 390;

  return (
    <div>
      <PageHeader
        title="Diseño del home"
        subtitle="Elige dónde va la modelo y el sistema coloca el texto donde no la tapa. Todo sobre una grilla de 12 columnas, con vista previa real antes de publicar."
      />

      {error && data && (
        <p className="mb-4 rounded-lg border border-[#b3261e]/35 bg-[#fdf0ee] p-2.5 text-[0.78rem] text-[var(--d-danger)]">
          No se pudo sincronizar con el server; se conservan tus cambios locales.
        </p>
      )}

      {loading || !draft ? (
        <Skeleton rows={6} />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {layouts.map((l) => {
              const plane = LAYOUT_PLANE[l.mode];
              return (
                <button
                  key={l.id}
                  onClick={() => pick(l.id)}
                  className={`card-soft overflow-hidden p-0 text-left transition ${
                    selectedId === l.id ? "border-[var(--d-accent)] ring-2 ring-[var(--color-primary)]/20" : ""
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.banner.imageUrl} alt="" className="h-24 w-full object-cover" />
                  <div className="p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{l.name}</p>
                      {l.status === "active" && <Badge tone="green">activo</Badge>}
                    </div>
                    <LayoutZoneGuide mode={l.mode} className="mt-2 w-full" />
                    <p className="mt-2 text-[0.68rem] leading-snug opacity-65">{plane.help}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[360px_1fr]">
            {/* -------- panel de edición -------- */}
            <div className="space-y-4">
              <Card>
                <p className="admin-label">Banner</p>
                <label className="admin-label mt-3">Imagen (URL)</label>
                <input
                  className="admin-input"
                  value={readBanner(draft.banner).image}
                  onChange={(e) => setDraft({ ...draft, banner: { ...draft.banner, imageUrl: e.target.value } })}
                />
                <div className="mt-2 flex flex-wrap gap-1">
                  {(Object.keys(BANNER_IMAGES) as LayoutMode[]).map((m) => (
                    <button
                      key={m}
                      className="chip bg-[var(--d-panel-2)]"
                      onClick={() => setDraft({ ...draft, banner: { ...draft.banner, imageUrl: BANNER_IMAGES[m] } })}
                    >
                      foto {LAYOUT_PLANE[m].label}
                    </button>
                  ))}
                </div>

                <label className="admin-label mt-4">
                  Alto del banner · {readBanner(draft.banner).aspect.toFixed(2)}:1
                </label>
                <input
                  type="range"
                  min={BANNER_RATIO_MIN}
                  max={BANNER_RATIO_MAX}
                  step={0.01}
                  value={readBanner(draft.banner).aspect}
                  className="w-full accent-[var(--d-accent)]"
                  onChange={(e) =>
                    setDraft({ ...draft, banner: { ...draft.banner, aspectRatio: Number(e.target.value) } })
                  }
                />
                <p className="text-[0.66rem] opacity-55">Izquierda = banner más alto · derecha = más panorámico</p>

                <label className="admin-label mt-4">
                  Overlay de contraste · {(readBanner(draft.banner).overlay * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  min={0}
                  max={0.4}
                  step={0.01}
                  value={readBanner(draft.banner).overlay}
                  className="w-full accent-[var(--d-accent)]"
                  onChange={(e) =>
                    setDraft({ ...draft, banner: { ...draft.banner, overlayOpacity: Number(e.target.value) } })
                  }
                />
              </Card>

              <Card>
                <p className="admin-label">Capas del banner</p>
                <div className="mt-2 space-y-3">
                  {draft.widgets.map((w) => (
                    <div key={w.id} className="rounded-xl border border-[var(--d-line)] p-3">
                      <label className="flex items-center justify-between gap-2 text-xs font-medium">
                        {WIDGET_LABELS[w.type] ?? w.type}
                        <input
                          type="checkbox"
                          checked={w.enabled}
                          onChange={(e) => patchWidget(w.id, { enabled: e.target.checked })}
                        />
                      </label>
                      {w.enabled && (
                        <div className="mt-2 space-y-2">
                          {"text" in w.props && (
                            <>
                              <textarea
                                className="admin-input h-16 text-xs"
                                maxLength={w.type === "title" ? 60 : w.type === "kicker" ? 40 : 140}
                                value={String(w.props.text ?? "")}
                                onChange={(e) => patchProps(w.id, { text: e.target.value })}
                              />
                              <p className="text-[0.62rem] opacity-50">
                                {String(w.props.text ?? "").length} /{" "}
                                {w.type === "title" ? 60 : w.type === "kicker" ? 40 : 140} caracteres
                              </p>
                            </>
                          )}
                          {w.type === "title" && (
                            <select
                              className="admin-input text-xs"
                              value={String(w.props.size ?? "L")}
                              onChange={(e) => patchProps(w.id, { size: e.target.value })}
                            >
                              {["S", "M", "L"].map((s) => (
                                <option key={s} value={s}>
                                  Tamaño {s}
                                </option>
                              ))}
                            </select>
                          )}
                          {(w.type === "cta_primary" || w.type === "cta_secondary") && (
                            <>
                              <input
                                className="admin-input text-xs"
                                value={String(w.props.label ?? "")}
                                onChange={(e) => patchProps(w.id, { label: e.target.value })}
                                placeholder="Texto del botón"
                              />
                              <input
                                className="admin-input text-xs"
                                value={String(w.props.link ?? "")}
                                onChange={(e) => patchProps(w.id, { link: e.target.value })}
                                placeholder="url:/catalogo · category:bikinis · product:handle"
                              />
                            </>
                          )}
                          {draft.mode === "builder" && (
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="admin-label">Col</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={12}
                                  className="admin-input py-1 text-xs"
                                  value={w.grid.colStart}
                                  onChange={(e) =>
                                    patchWidget(w.id, {
                                      grid: { ...w.grid, colStart: Math.min(12, Math.max(1, Number(e.target.value))) },
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <label className="admin-label">Ancho</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={12}
                                  className="admin-input py-1 text-xs"
                                  value={w.grid.colSpan}
                                  onChange={(e) =>
                                    patchWidget(w.id, {
                                      grid: { ...w.grid, colSpan: Math.min(12, Math.max(1, Number(e.target.value))) },
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <label className="admin-label">Alineación</label>
                                <select
                                  className="admin-input py-1 text-xs"
                                  value={w.grid.align}
                                  onChange={(e) =>
                                    patchWidget(w.id, {
                                      grid: { ...w.grid, align: e.target.value as "left" | "center" | "right" },
                                    })
                                  }
                                >
                                  <option value="left">Izq.</option>
                                  <option value="center">Centro</option>
                                  <option value="right">Der.</option>
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <p className="admin-label">Secciones bajo el banner</p>
                <ul className="mt-2 space-y-2">
                  {[...draft.sections]
                    .sort((a, b) => a.order - b.order)
                    .map((s, idx, arr) => (
                      <li key={s.id} className="flex items-center gap-2 rounded-lg border border-[var(--d-line)] px-3 py-2 text-xs">
                        <span className="flex-1">{SECTION_LABELS[s.type] ?? s.type}</span>
                        <button
                          className="opacity-50 hover:opacity-100 disabled:opacity-20"
                          disabled={idx === 0}
                          onClick={() => {
                            const prev = arr[idx - 1];
                            setDraft({
                              ...draft,
                              sections: draft.sections.map((x) =>
                                x.id === s.id ? { ...x, order: prev.order } : x.id === prev.id ? { ...x, order: s.order } : x,
                              ),
                            });
                          }}
                        >
                          ↑
                        </button>
                        <button
                          className="opacity-50 hover:opacity-100 disabled:opacity-20"
                          disabled={idx === arr.length - 1}
                          onClick={() => {
                            const next = arr[idx + 1];
                            setDraft({
                              ...draft,
                              sections: draft.sections.map((x) =>
                                x.id === s.id ? { ...x, order: next.order } : x.id === next.id ? { ...x, order: s.order } : x,
                              ),
                            });
                          }}
                        >
                          ↓
                        </button>
                        <input
                          type="checkbox"
                          checked={s.enabled}
                          disabled={s.type === "footer"}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              sections: draft.sections.map((x) =>
                                x.id === s.id ? { ...x, enabled: e.target.checked } : x,
                              ),
                            })
                          }
                        />
                      </li>
                    ))}
                </ul>
              </Card>

              <Card>
                <p className="admin-label">Colores de marca</p>
                <div className="mt-2 space-y-2">
                  {Object.entries(tokens).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-3">
                      <input
                        type="color"
                        value={value}
                        onChange={(e) => setTokens({ ...tokens, [key]: e.target.value })}
                        className="h-8 w-10 rounded border border-[var(--d-line)]"
                      />
                      <div className="flex-1">
                        <p className="text-xs font-medium">{key}</p>
                        <p className="text-[0.65rem] opacity-55">{TOKEN_LABELS[key] ?? ""}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    className="dash-btn dash-btn-primary"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        tokensReseedRef.current = true;
                        const ok = await post({ action: "save_tokens", tokens }, "Colores guardados");
                        if (!ok) tokensReseedRef.current = false;
                      })
                    }
                  >
                    Guardar colores
                  </button>
                  <button className="dash-btn" disabled={busy} onClick={() => setResetColors(true)}>
                    Reset a marca
                  </button>
                </div>
              </Card>
            </div>

            {/* -------- preview -------- */}
            <div>
              <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex gap-1 rounded-full bg-[var(--d-panel-2)] p-1 text-xs">
                  {(["desktop", "tablet", "mobile"] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDevice(d)}
                      className={`rounded-full px-3 py-1 capitalize ${device === d ? "bg-[var(--d-bg)] text-white" : "opacity-60"}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    className="dash-btn"
                    disabled={busy}
                    onClick={() =>
                      run(() =>
                        post(
                          {
                            action: "save_layout",
                            id: draft.id,
                            name: draft.name,
                            banner: draft.banner,
                            widgets: draft.widgets,
                            sections: draft.sections,
                          },
                          "Borrador guardado",
                        ),
                      )
                    }
                  >
                    {busy ? "Guardando…" : "Guardar borrador"}
                  </button>
                  <button
                    className="dash-btn dash-btn-primary"
                    disabled={!canPublish || busy}
                    onClick={() =>
                      run(async () => {
                        const saved = await post(
                          {
                            action: "save_layout",
                            id: draft.id,
                            name: draft.name,
                            banner: draft.banner,
                            widgets: draft.widgets,
                            sections: draft.sections,
                          },
                          "Borrador guardado",
                        );
                        if (saved) await post({ action: "publish", id: draft.id }, "Home publicado");
                      })
                    }
                  >
                    {busy ? "Publicando…" : "Publicar como home"}
                  </button>
                </div>
              </Card>

              <Card className="mb-4">
                <p className="admin-label">Checklist de publicación</p>
                <ul className="mt-2 grid gap-1.5 text-xs sm:grid-cols-2">
                  {checklist.map((c) => (
                    <li key={c.id} className={`flex items-start gap-2 ${c.ok ? "text-emerald-700" : "text-[var(--d-danger)]"}`}>
                      <span>{c.ok ? "✓" : "✕"}</span>
                      <span>
                        {c.label}
                        {!c.ok && <em className="block opacity-70">{c.hint}</em>}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>

              <div className="overflow-hidden rounded-2xl border border-[var(--d-line)] bg-white">
                <div className="flex items-center gap-2 border-b border-[var(--d-line)] bg-[var(--d-panel-2)] px-4 py-2 text-[0.68rem] uppercase tracking-wider opacity-60">
                  Vista previa · {device} · mismos componentes que la tienda
                </div>
                <div className="overflow-x-auto scroll-thin">
                  <div style={{ width: previewWidth, transformOrigin: "top left" }}>
                    <StoreProvider catalog={[]} theme={null}>
                      <HomeRenderer
                        layout={{
                          mode: draft.mode,
                          banner: draft.banner,
                          widgets: draft.widgets,
                          sections: draft.sections,
                        }}
                        categories={catalog?.categories ?? []}
                        products={products}
                        device={device}
                      />
                    </StoreProvider>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={resetColors}
        onClose={() => setResetColors(false)}
        title="Reset de colores a marca"
        message="Devuelve todos los colores a los valores de marca por defecto. Los personalizados se pierden. ¿Confirmas?"
        confirmLabel="Resetear"
        onConfirm={() =>
          run(async () => {
            tokensReseedRef.current = true;
            const ok = await post({ action: "reset_tokens" }, "Colores restaurados a marca");
            if (!ok) tokensReseedRef.current = false;
          })
        }
      />

      <Toast />
    </div>
  );
}
