import { NextResponse } from "next/server";
import { passwordMatches } from "@/lib/admin-auth";
import { db } from "@/db";
import {
  categories,
  inventoryLevels,
  orderItems,
  products,
  sizeCharts,
  variants,
  type SizeChartColumn,
  type SizeChartRow,
} from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { recordAudit } from "@/lib/audit";
import { getActor } from "@/lib/session";
import { getCategories, listProducts } from "@/lib/queries";

export async function GET() {
  const [cats, prods] = await Promise.all([getCategories(), listProducts()]);
  const charts = await db.select().from(sizeCharts);
  return NextResponse.json({
    categories: cats.map((c) => ({
      ...c,
      chart: charts.find((ch) => ch.categoryId === c.id) ?? null,
      productCount: prods.filter((p) => p.categoryId === c.id).length,
    })),
    products: prods,
  });
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function POST(req: Request) {
  const actor = await getActor();
  const body = await req.json();
  const action = body.action as string;

  /* ---------------- categorías ---------------- */
  if (action === "create_category") {
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ ok: false, error: "El nombre es obligatorio." }, { status: 400 });
    const slug = slugify(name);
    const dupeCat = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug)).limit(1);
    if (dupeCat.length > 0) {
      return NextResponse.json({ ok: false, error: "Ya existe una categoría con ese nombre." }, { status: 409 });
    }
    const [cat] = await db
      .insert(categories)
      .values({
        name,
        slug,
        description: String(body.description ?? ""),
        imageUrl: String(body.imageUrl ?? ""),
        sortOrder: 99,
      })
      .returning();

    const inherit = Number(body.inheritFromCategoryId ?? 0);
    let columns: SizeChartColumn[] = [{ key: "size", label: "Talla", type: "text", locked: true }];
    let rows: SizeChartRow[] = [{ size: "U" }];
    if (inherit) {
      const [src] = await db.select().from(sizeCharts).where(eq(sizeCharts.categoryId, inherit)).limit(1);
      if (src) {
        columns = src.columns;
        rows = src.rows;
      }
    }
    await db.insert(sizeCharts).values({ categoryId: cat.id, unit: "cm", columns, rows, updatedBy: actor.name });
    await recordAudit({
      actor,
      module: "productos",
      entityType: "category",
      entityId: cat.id,
      action: "create",
      summary: `${actor.name} creó la categoría «${name}» con su tabla de tallas.`,
    });
    return NextResponse.json({ ok: true, id: cat.id });
  }

  /* ---------------- tabla de tallas ---------------- */
  if (action === "save_size_chart") {
    if (!Array.isArray(body.rows) || !Array.isArray(body.columns)) {
      return NextResponse.json({ ok: false, error: "Filas/columnas inválidas." }, { status: 400 });
    }
    const categoryId = Number(body.categoryId);
    const columns = body.columns as SizeChartColumn[];
    const rows = body.rows as SizeChartRow[];
    const [current] = await db.select().from(sizeCharts).where(eq(sizeCharts.categoryId, categoryId)).limit(1);
    if (!current) return NextResponse.json({ ok: false, error: "Categoría sin tabla." }, { status: 404 });

    const oldSizes = current.rows.map((r) => String(r.size));
    const newSizes = rows.map((r) => String(r.size));
    const removed = oldSizes.filter((s) => !newSizes.includes(s));

    // Bloqueo: no se puede quitar una talla con stock o con ventas históricas.
    if (removed.length > 0) {
      const prods = await db.select().from(products).where(eq(products.categoryId, categoryId));
      const productIds = prods.map((p) => p.id);
      if (productIds.length > 0) {
        const vs = await db
          .select({ id: variants.id, size: variants.size, stock: inventoryLevels.stocked })
          .from(variants)
          .leftJoin(inventoryLevels, eq(inventoryLevels.variantId, variants.id))
          .where(and(inArray(variants.productId, productIds), inArray(variants.size, removed)));
        const withStock = vs.filter((v) => (v.stock ?? 0) > 0);
        const ids = vs.map((v) => v.id);
        const sold = ids.length
          ? await db.select({ id: orderItems.id }).from(orderItems).where(inArray(orderItems.variantId, ids))
          : [];
        if (withStock.length > 0 || sold.length > 0) {
          return NextResponse.json(
            {
              ok: false,
              error: `No puedes eliminar la(s) talla(s) ${removed.join(", ")}: hay stock o pedidos históricos. Desactívala en su lugar.`,
            },
            { status: 409 },
          );
        }
        // sin stock ni ventas → desactivar variantes
        if (ids.length > 0) {
          await db.update(variants).set({ active: false }).where(inArray(variants.id, ids));
        }
      }
    }

    await db
      .update(sizeCharts)
      .set({ columns, rows, unit: body.unit ?? current.unit, updatedBy: actor.name, updatedAt: new Date() })
      .where(eq(sizeCharts.categoryId, categoryId));

    // Batch: crear variantes faltantes en productos existentes
    let created = 0;
    if (body.backfillVariants) {
      const prods = await db.select().from(products).where(eq(products.categoryId, categoryId));
      for (const p of prods) {
        const existing = await db.select().from(variants).where(eq(variants.productId, p.id));
        for (const size of [...new Set(newSizes)]) {
          if (existing.some((v) => v.size === size)) continue;
          const [v] = await db
            .insert(variants)
            .values({
              productId: p.id,
              size,
              sku: `${p.handle.toUpperCase().replace(/-/g, "")}-${size}`,
            })
            .returning();
          await db.insert(inventoryLevels).values({ variantId: v.id, stocked: 0, threshold: 4 });
          created++;
        }
      }
    }

    await recordAudit({
      actor,
      module: "productos",
      entityType: "size_chart",
      entityId: categoryId,
      action: "update",
      fieldChanged: "rows/columns",
      oldValue: { sizes: oldSizes },
      newValue: { sizes: newSizes, variantesCreadas: created },
      summary: `${actor.name} actualizó la tabla de tallas de la categoría #${categoryId}${created ? ` y generó ${created} variantes nuevas` : ""}.`,
    });
    return NextResponse.json({ ok: true, createdVariants: created });
  }

  /* ---------------- productos ---------------- */
  if (action === "create_product") {
    const title = String(body.title ?? "").trim();
    const categoryId = Number(body.categoryId);
    const price = Number(body.priceCents);
    const images = (Array.isArray(body.images) ? body.images : []).map(String);
    const rawSizes = (Array.isArray(body.sizes) ? body.sizes : []) as { size?: unknown; stock?: unknown }[];
    const rawStatus = String(body.status ?? "draft");
    if (!title || !Number.isInteger(categoryId) || categoryId <= 0) {
      return NextResponse.json({ ok: false, error: "Nombre y categoría son obligatorios." }, { status: 400 });
    }
    const [cat] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);
    if (!cat) {
      return NextResponse.json({ ok: false, error: "La categoría seleccionada no existe." }, { status: 400 });
    }
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ ok: false, error: "El precio debe ser mayor a 0." }, { status: 400 });
    }
    let compareAtCents: number | null = null;
    if (body.compareAtCents !== undefined && body.compareAtCents !== null && body.compareAtCents !== "") {
      compareAtCents = Number(body.compareAtCents);
      if (!Number.isFinite(compareAtCents)) {
        return NextResponse.json({ ok: false, error: "El precio de comparación no es válido." }, { status: 400 });
      }
      if (compareAtCents < price) {
        return NextResponse.json(
          { ok: false, error: "El precio de comparación no puede ser menor al precio actual." },
          { status: 400 },
        );
      }
    }
    if (!["draft", "published", "archived"].includes(rawStatus)) {
      return NextResponse.json(
        { ok: false, error: "Estado inválido: debe ser draft, published o archived." },
        { status: 400 },
      );
    }
    const status = rawStatus as "draft" | "published" | "archived";
    if (status === "published") {
      if (images.length === 0) return NextResponse.json({ ok: false, error: "Publicar exige al menos 1 imagen." }, { status: 400 });
      if (rawSizes.length === 0) return NextResponse.json({ ok: false, error: "Publicar exige al menos 1 talla activa." }, { status: 400 });
    }
    // Tallas: nombre obligatorio + stock entero ≥ 0; duplicadas → gana la
    // primera (dedupe también evita el 23505 del índice único productId+size).
    const sizeEntries = new Map<string, number>();
    for (const s of rawSizes) {
      const name = String(s?.size ?? "").trim();
      if (!name) {
        return NextResponse.json({ ok: false, error: "Cada talla necesita un nombre." }, { status: 400 });
      }
      const stock = Number(s?.stock ?? 0);
      if (!Number.isInteger(stock) || stock < 0) {
        return NextResponse.json(
          { ok: false, error: "El stock de cada talla debe ser un entero mayor o igual a 0." },
          { status: 400 },
        );
      }
      if (!sizeEntries.has(name)) sizeEntries.set(name, stock);
    }

    const handle = slugify(title);
    const dupe = await db.select().from(products).where(eq(products.handle, handle)).limit(1);
    if (dupe.length > 0) {
      return NextResponse.json({ ok: false, error: "Ya existe un producto con ese nombre." }, { status: 409 });
    }

    // Producto + variantes + inventario en UNA transacción: un fallo a mitad
    // del loop no deja un producto con tallas a medias.
    const prod = await db.transaction(async (tx) => {
      const [p] = await tx
        .insert(products)
        .values({
          title,
          handle,
          description: String(body.description ?? ""),
          categoryId,
          status,
          priceCents: price,
          compareAtCents,
          images,
          tags: (body.tags as string[]) ?? [],
        })
        .returning();

      for (const [size, stock] of sizeEntries) {
        const [v] = await tx
          .insert(variants)
          .values({
            productId: p.id,
            size,
            sku: `${handle.toUpperCase().replace(/-/g, "")}-${size}`,
          })
          .returning();
        await tx.insert(inventoryLevels).values({ variantId: v.id, stocked: stock, threshold: 4 });
      }
      return p;
    });

    await recordAudit({
      actor,
      module: "productos",
      entityType: "product",
      entityId: prod.id,
      action: "create",
      summary: `${actor.name} creó el producto «${title}» (${sizeEntries.size} tallas) en estado ${status}.`,
    });
    return NextResponse.json({ ok: true, id: prod.id, handle });
  }

  if (action === "update_product") {
    const id = Number(body.id);
    const [prod] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!prod) return NextResponse.json({ ok: false, error: "Producto no encontrado." }, { status: 404 });
    const patch: Record<string, unknown> = {};
    if (body.status !== undefined) {
      const status = String(body.status);
      if (!["draft", "published", "archived"].includes(status)) {
        return NextResponse.json(
          { ok: false, error: "Estado inválido: debe ser draft, published o archived." },
          { status: 400 },
        );
      }
      if (status === "published") {
        // Publicar exige al menos 1 imagen y 1 talla activa (validación server-side).
        if (!Array.isArray(prod.images) || prod.images.length === 0) {
          return NextResponse.json({ ok: false, error: "Publicar exige al menos 1 imagen." }, { status: 400 });
        }
        const activeVariants = await db
          .select({ id: variants.id })
          .from(variants)
          .where(and(eq(variants.productId, id), eq(variants.active, true)))
          .limit(1);
        if (activeVariants.length === 0) {
          return NextResponse.json({ ok: false, error: "Publicar exige al menos 1 talla activa." }, { status: 400 });
        }
      }
      patch.status = status;
    }
    if (body.categoryId !== undefined) {
      const catId = Number(body.categoryId);
      const [cat] = Number.isInteger(catId)
        ? await db.select({ id: categories.id }).from(categories).where(eq(categories.id, catId)).limit(1)
        : [];
      if (!cat) {
        return NextResponse.json({ ok: false, error: "La categoría seleccionada no existe." }, { status: 400 });
      }
      patch.categoryId = catId;
    }
    if (body.priceCents !== undefined) {
      const price = Number(body.priceCents);
      if (!Number.isFinite(price) || price <= 0) {
        return NextResponse.json({ ok: false, error: "El precio debe ser mayor a 0." }, { status: 400 });
      }
      patch.priceCents = price;
    }
    if (body.compareAtCents !== undefined) {
      if (body.compareAtCents === null || body.compareAtCents === "") {
        patch.compareAtCents = null;
      } else {
        const compareAt = Number(body.compareAtCents);
        if (!Number.isFinite(compareAt)) {
          return NextResponse.json({ ok: false, error: "El precio de comparación no es válido." }, { status: 400 });
        }
        patch.compareAtCents = compareAt;
      }
    }
    if (body.title) patch.title = String(body.title);
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "No hay campos para actualizar." }, { status: 400 });
    }
    // Contrato simétrico con create_product: el ESTADO final (precio y
    // compareAt combinados con lo guardado) no puede quedar invertido.
    const effectivePrice = (patch.priceCents as number) ?? prod.priceCents;
    const effectiveCompareAt =
      patch.compareAtCents !== undefined ? (patch.compareAtCents as number | null) : prod.compareAtCents;
    if (effectiveCompareAt != null && effectiveCompareAt < effectivePrice) {
      return NextResponse.json(
        { ok: false, error: "El precio de comparación no puede ser menor al precio actual." },
        { status: 400 },
      );
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "No hay cambios que aplicar." }, { status: 400 });
    }
    await db.update(products).set(patch).where(eq(products.id, id));
    await recordAudit({
      actor,
      module: "productos",
      entityType: "product",
      entityId: id,
      action: "update",
      oldValue: { status: prod.status, priceCents: prod.priceCents },
      newValue: patch,
      summary: `${actor.name} actualizó el producto «${prod.title}».`,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "delete_product") {
    const id = Number(body.id);
    const hard = Boolean(body.hard);
    const [prod] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!prod) return NextResponse.json({ ok: false, error: "Producto no encontrado." }, { status: 404 });

    if (!hard) {
      await db.update(products).set({ status: "archived" }).where(eq(products.id, id));
      await recordAudit({
        actor,
        module: "productos",
        entityType: "product",
        entityId: id,
        action: "delete_soft",
        summary: `${actor.name} archivó el producto «${prod.title}».`,
      });
      return NextResponse.json({ ok: true, mode: "archived" });
    }

    if (!actor.canHardDelete) {
      return NextResponse.json({ ok: false, error: "Tu rol no permite borrado definitivo." }, { status: 403 });
    }
    if (String(body.confirmText ?? "").trim() !== prod.title) {
      return NextResponse.json({ ok: false, error: "El nombre escrito no coincide." }, { status: 400 });
    }
    if (!passwordMatches(body.password)) {
      return NextResponse.json({ ok: false, error: "Reautenticación fallida." }, { status: 401 });
    }

    const vs = await db.select({ id: variants.id }).from(variants).where(eq(variants.productId, id));
    const vIds = vs.map((v) => v.id);
    const sold = vIds.length
      ? await db.select({ id: orderItems.id }).from(orderItems).where(inArray(orderItems.variantId, vIds))
      : [];
    if (sold.length > 0) {
      return NextResponse.json(
        { ok: false, error: "Este producto tiene ventas históricas: solo puede archivarse." },
        { status: 409 },
      );
    }

    // Deletes multi-tabla en UNA transacción: un fallo a mitad no deja
    // variantes huérfanas ni producto sin tallas. El audit se escribe TRAS el
    // commit (igual que orders/hard_delete): la bitácora no afirma lo que no pasó.
    await db.transaction(async (tx) => {
      if (vIds.length > 0) {
        await tx.delete(inventoryLevels).where(inArray(inventoryLevels.variantId, vIds));
        await tx.delete(variants).where(inArray(variants.id, vIds));
      }
      await tx.delete(products).where(eq(products.id, id));
    });
    await recordAudit({
      actor,
      module: "productos",
      entityType: "product",
      entityId: id,
      action: "delete_hard",
      oldValue: { title: prod.title, handle: prod.handle },
      summary: `${actor.name} eliminó definitivamente el producto «${prod.title}».`,
    });
    return NextResponse.json({ ok: true, mode: "hard" });
  }

  if (action === "update_stock") {
    const variantId = Number(body.variantId);
    const value = Math.max(0, Number(body.stocked));
    const [level] = await db
      .select()
      .from(inventoryLevels)
      .where(eq(inventoryLevels.variantId, variantId))
      .limit(1);
    if (!level) return NextResponse.json({ ok: false, error: "Variante sin inventario." }, { status: 404 });
    if (body.expectedUpdatedAt && new Date(body.expectedUpdatedAt).getTime() !== level.updatedAt.getTime()) {
      return NextResponse.json(
        { ok: false, error: "Otro usuario cambió este stock. Recarga la vista." },
        { status: 409 },
      );
    }
    await db
      .update(inventoryLevels)
      .set({ stocked: value, updatedAt: new Date() })
      .where(eq(inventoryLevels.variantId, variantId));
    await recordAudit({
      actor,
      module: "inventario",
      entityType: "inventory_level",
      entityId: variantId,
      action: "update",
      fieldChanged: "stocked",
      oldValue: level.stocked,
      newValue: value,
      summary: `${actor.name} ajustó el stock de la variante #${variantId} de ${level.stocked} a ${value}.`,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "update_threshold") {
    const variantId = Number(body.variantId);
    const value = Math.max(0, Number(body.threshold));
    const [level] = await db
      .select()
      .from(inventoryLevels)
      .where(eq(inventoryLevels.variantId, variantId))
      .limit(1);
    if (!level) return NextResponse.json({ ok: false, error: "Variante sin inventario." }, { status: 404 });
    if (body.expectedUpdatedAt && new Date(body.expectedUpdatedAt).getTime() !== level.updatedAt.getTime()) {
      return NextResponse.json(
        { ok: false, error: "Otro usuario cambió este umbral. Recarga la vista." },
        { status: 409 },
      );
    }
    await db
      .update(inventoryLevels)
      .set({ threshold: value, updatedAt: new Date() })
      .where(eq(inventoryLevels.variantId, variantId));
    await recordAudit({
      actor,
      module: "inventario",
      entityType: "inventory_level",
      entityId: variantId,
      action: "update",
      fieldChanged: "threshold",
      newValue: value,
      summary: `${actor.name} cambió el umbral de alerta de la variante #${variantId} a ${value}.`,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: `Acción desconocida: ${action}` }, { status: 400 });
}

export async function HEAD() {
  await db.select({ n: sql<number>`1` });
  return new NextResponse(null, { status: 200 });
}
