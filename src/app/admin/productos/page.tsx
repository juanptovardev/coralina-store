"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Badge,
  Card,
  ConfirmDialog,
  EmptyState,
  HardDeleteDialog,
  Modal,
  PageHeader,
  Skeleton,
  Toast,
  useBusy,
  useDebouncedValue,
  useJson,
} from "@/components/admin/ui";
import { ProductWizard } from "@/components/admin/ProductWizard";
import { formatCOP } from "@/lib/constants";
import type { StoreProduct } from "@/lib/queries";
import type { Actor } from "@/lib/session";
import type { SizeChartColumn, SizeChartRow } from "@/db/schema";

type CatalogCategory = {
  id: number;
  name: string;
  slug: string;
  productCount: number;
  chart: { unit: string; columns: SizeChartColumn[]; rows: SizeChartRow[] } | null;
};

export default function ProductosPage() {
  const { data, loading, reload } = useJson<{ categories: CatalogCategory[]; products: StoreProduct[] }>(
    "/api/admin/catalog",
  );
  const { data: actor } = useJson<Actor>("/api/admin/session");
  const [wizard, setWizard] = useState(false);
  const [toast, setToast] = useState("");
  const [toastTone, setToastTone] = useState<"ok" | "error">("ok");
  const [target, setTarget] = useState<StoreProduct | null>(null);
  const [editing, setEditing] = useState<StoreProduct | null>(null);
  const [filter, setFilter] = useState("");
  const [confirmBox, setConfirmBox] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    onOk: () => void;
  } | null>(null);
  const { busy, run } = useBusy();
  const dFilter = useDebouncedValue(filter, 300);

  const products = (data?.products ?? []).filter((p) =>
    p.title.toLowerCase().includes(dFilter.toLowerCase()),
  );

  async function call(body: Record<string, unknown>): Promise<string | null> {
    const res = await fetch("/api/admin/catalog", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) return json.error ?? "Error inesperado";
    reload();
    return null;
  }

  return (
    <div>
      <PageHeader
        title="Productos"
        subtitle="Hoja de cálculo del catálogo. Crear un producto genera variantes, SKU e inventario automáticamente a partir de la tabla de tallas de su categoría."
        actions={
          <>
            <Link href="/admin/categorias" className="dash-btn">
              Categorías y tallas
            </Link>
            <button className="dash-btn dash-btn-primary" onClick={() => setWizard(true)}>
              + Añadir producto
            </button>
          </>
        }
      />

      <Card className="mb-4 flex flex-wrap items-center gap-3 py-3">
        <input
          className="admin-input max-w-xs"
          placeholder="Buscar producto…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="text-xs opacity-60">
          {products.length} productos · {data?.categories.length ?? 0} categorías
        </span>
      </Card>

      {loading ? (
        <Skeleton rows={6} />
      ) : products.length === 0 ? (
        <EmptyState
          title="Aún no hay productos"
          hint="Crea el primero: elige categoría, marca las tallas y el sistema hace el resto."
          actionLabel="Añadir producto"
          onAction={() => setWizard(true)}
        />
      ) : (
        <div className="dash-panel dash-scroll overflow-auto scroll-thin">
          <table className="dash-table min-w-[940px]">
            <thead>
              <tr>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Precio</th>
                <th className="px-4 py-3">Tallas</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.images[0]} alt="" className="h-12 w-10 rounded object-cover" />
                      <div>
                        <p className="font-medium">{p.title}</p>
                        <p className="text-[0.68rem] opacity-50">/{p.handle}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 opacity-75">{p.categoryName}</td>
                  <td className="px-4 py-3">{formatCOP(p.priceCents)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.variants.map((v) => (
                        <span
                          key={v.id}
                          className={`chip ${v.stock === 0 ? "bg-[#fde8e6] text-[#b3261e]" : v.stock <= 4 ? "bg-[var(--color-accent)]/25 text-[#8a5a12]" : "bg-[var(--d-panel-2)]"}`}
                          title={`${v.sku} · ${v.stock} uds`}
                        >
                          {v.size}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">{p.totalStock}</td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={p.status === "published" ? "green" : p.status === "draft" ? "amber" : "slate"}
                    >
                      {p.status === "published" ? "Publicado" : p.status === "draft" ? "Borrador" : "Archivado"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        className="dash-btn px-2.5 py-1"
                        onClick={() => setEditing(p)}
                      >
                        Editar
                      </button>
                      <button
                        className="dash-btn px-2.5 py-1"
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            const err = await call({
                              action: "update_product",
                              id: p.id,
                              status: p.status === "published" ? "draft" : "published",
                            });
                            setToastTone(err ? "error" : "ok");
                            setToast(err ?? (p.status === "published" ? "Producto despublicado" : "Producto publicado"));
                          })
                        }
                      >
                        {p.status === "published" ? "Despublicar" : "Publicar"}
                      </button>
                      <button
                        className="dash-btn px-2.5 py-1"
                        disabled={busy}
                        onClick={() =>
                          setConfirmBox({
                            title: "Archivar producto",
                            message: `«${p.title}» dejará de verse en la tienda (estado archived). Se puede volver a publicar. ¿Confirmas?`,
                            confirmLabel: "Archivar",
                            onOk: () =>
                              run(async () => {
                                const err = await call({ action: "delete_product", id: p.id, hard: false });
                                setToastTone(err ? "error" : "ok");
                                setToast(err ?? "Producto archivado");
                              }),
                          })
                        }
                      >
                        Archivar
                      </button>
                      <button
                        className="dash-btn dash-btn-danger px-2.5 py-1"
                        onClick={() => setTarget(p)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={wizard}
        onClose={() => setWizard(false)}
        title="Añadir producto"
        wide
      >
        <ProductWizard
          categories={data?.categories ?? []}
          onDone={(msg, tone) => {
            setWizard(false);
            setToastTone(tone);
            setToast(msg);
            reload();
          }}
        />
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `Editar · ${editing.title}` : "Editar producto"}
        wide
      >
        {editing && (
          <ProductWizard
            categories={data?.categories ?? []}
            initial={{
              id: editing.id,
              title: editing.title,
              description: editing.description,
              categoryId: editing.categoryId,
              priceCents: editing.priceCents,
              compareAtCents: editing.compareAtCents,
              images: editing.images,
              tags: editing.tags,
              status: editing.status,
              sizes: editing.variants.map((v) => ({ size: v.size, stock: v.stock })),
            }}
            onDone={(msg, tone) => {
              setEditing(null);
              setToastTone(tone);
              setToast(msg);
              reload();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={confirmBox !== null}
        onClose={() => setConfirmBox(null)}
        title={confirmBox?.title ?? ""}
        message={confirmBox?.message ?? ""}
        confirmLabel={confirmBox?.confirmLabel ?? "Confirmar"}
        onConfirm={() => confirmBox?.onOk()}
      />

      <HardDeleteDialog
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        canHardDelete={Boolean(actor?.canHardDelete)}
        entityLabel={`producto «${target?.title ?? ""}»`}
        expectedText={target?.title ?? ""}
        description="El borrado definitivo solo procede si el producto nunca se vendió. Si tiene historial de ventas, el sistema obliga a archivarlo."
        onConfirm={async (confirmText, password) => {
          const err = await call({
            action: "delete_product",
            id: target?.id,
            hard: true,
            confirmText,
            password,
          });
          if (!err) {
            setToastTone("ok");
            setToast("Producto eliminado definitivamente");
          }
          return err;
        }}
      />

      <Toast message={toast} tone={toastTone} />
    </div>
  );
}
