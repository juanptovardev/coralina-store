import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  customers,
  inventoryLevels,
  orderItems,
  orders,
  products,
  shipments,
  users,
  variants,
  type OperationalTag,
  type ShipmentStatus,
} from "@/db/schema";
import { findUserByEmail } from "./users";
import { upsertCustomerByEmail } from "./customers";
import type { ProfileData } from "./validate-profile";

export type MiCuentaProfile = {
  email: string;
  name: string;
  phone: string;
  city: string;
  address: string;
};

/** Datos actuales de la variante para reconstruir el carrito (repetir pedido). */
export type MiCuentaCurrentVariant = {
  productId: number;
  productTitle: string;
  priceCents: number;
  image: string;
  categorySlug: string;
  stock: number;
  active: boolean;
};

export type MiCuentaOrderItem = {
  variantId: number;
  productId: number | null;
  productTitle: string;
  size: string;
  sku: string;
  quantity: number;
  unitPriceCents: number;
  current: MiCuentaCurrentVariant | null;
};

export type MiCuentaOrder = {
  displayId: string;
  createdAt: string;
  status: "pending" | "completed" | "canceled";
  operationalTag: OperationalTag;
  totalCents: number;
  discountCents: number;
  discountBreakdown: { label: string; amountCents: number }[];
  items: MiCuentaOrderItem[];
  shipment: { status: ShipmentStatus; carrier: string; trackingCode: string } | null;
  canRepeat: boolean;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * Perfil del usuario por email de sesión. `name` sale de users (identidad);
 * phone/city/address de la fila customers vinculada por email (puede no existir).
 * null si la cuenta no existe (sesión con identidad huérfana).
 */
export async function getProfileByEmail(email: string): Promise<MiCuentaProfile | null> {
  const normalized = normalizeEmail(email);
  const user = await findUserByEmail(normalized);
  if (!user) return null;
  const [customer] = await db
    .select({ phone: customers.phone, city: customers.city, address: customers.address })
    .from(customers)
    .where(eq(customers.email, normalized))
    .limit(1);
  return {
    email: user.email,
    name: user.name,
    phone: customer?.phone ?? "",
    city: customer?.city ?? "",
    address: customer?.address ?? "",
  };
}

/**
 * Actualiza users.name y hace upsert de la ficha customers por email. Ambas
 * escrituras van en una transacción: o se guarda todo, o nada.
 */
export async function updateProfileByEmail(email: string, data: ProfileData): Promise<MiCuentaProfile> {
  const normalized = normalizeEmail(email);
  const user = await findUserByEmail(normalized);
  if (!user) throw new Error("user_not_found");

  await db.transaction(async (tx) => {
    await tx.update(users).set({ name: data.name }).where(eq(users.id, user.id));
    await upsertCustomerByEmail(
      { name: data.name, email: normalized, phone: data.phone, city: data.city, address: data.address },
      { clearEmpty: true },
      tx,
    );
  });

  return { email: normalized, name: data.name, phone: data.phone, city: data.city, address: data.address };
}

/**
 * Pedidos del cliente dueño del email de sesión. Anti-IDOR: el customerId se
 * resuelve SIEMPRE por el email de la sesión; jamás se aceptan ids del cliente.
 * Los artículos y envíos se leen por orderId de esos pedidos (no por id suelto).
 */
export async function getOrdersForEmail(email: string): Promise<MiCuentaOrder[]> {
  const normalized = normalizeEmail(email);
  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.email, normalized))
    .limit(1);
  if (!customer) return [];

  const orderRows = await db
    .select()
    .from(orders)
    .where(eq(orders.customerId, customer.id))
    .orderBy(desc(orders.createdAt));
  if (orderRows.length === 0) return [];

  const orderIds = orderRows.map((o) => o.id);
  const [itemRows, shipRows] = await Promise.all([
    db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)).orderBy(asc(orderItems.id)),
    db.select().from(shipments).where(inArray(shipments.orderId, orderIds)),
  ]);

  const variantIds = [...new Set(itemRows.map((i) => i.variantId))];
  const currentRows = variantIds.length
    ? await db
        .select({
          variantId: variants.id,
          productId: variants.productId,
          active: variants.active,
          stock: inventoryLevels.stocked,
          priceCents: products.priceCents,
          productTitle: products.title,
          productStatus: products.status,
          images: products.images,
          categorySlug: categories.slug,
        })
        .from(variants)
        .innerJoin(products, eq(products.id, variants.productId))
        .leftJoin(categories, eq(categories.id, products.categoryId))
        .leftJoin(inventoryLevels, eq(inventoryLevels.variantId, variants.id))
        .where(inArray(variants.id, variantIds))
    : [];

  const currentByVariant = new Map<number, MiCuentaCurrentVariant>();
  for (const v of currentRows) {
    currentByVariant.set(v.variantId, {
      productId: v.productId,
      productTitle: v.productTitle,
      priceCents: v.priceCents,
      image: Array.isArray(v.images) ? (v.images[0] ?? "") : "",
      categorySlug: v.categorySlug ?? "",
      stock: v.stock ?? 0,
      active: v.active !== false && v.productStatus === "published",
    });
  }

  const itemsByOrder = new Map<number, MiCuentaOrderItem[]>();
  for (const it of itemRows) {
    const list = itemsByOrder.get(it.orderId) ?? [];
    list.push({
      variantId: it.variantId,
      productId: it.productId,
      productTitle: it.productTitle,
      size: it.size,
      sku: it.sku,
      quantity: it.quantity,
      unitPriceCents: it.unitPriceCents,
      current: currentByVariant.get(it.variantId) ?? null,
    });
    itemsByOrder.set(it.orderId, list);
  }

  const shipByOrder = new Map(shipRows.map((s) => [s.orderId, s]));

  return orderRows.map((o) => {
    const ship = shipByOrder.get(o.id);
    return {
      displayId: o.displayId,
      createdAt: o.createdAt.toISOString(),
      status: o.status,
      operationalTag: o.operationalTag,
      totalCents: o.totalCents,
      discountCents: o.discountCents,
      discountBreakdown: Array.isArray(o.discountBreakdown) ? o.discountBreakdown : [],
      items: itemsByOrder.get(o.id) ?? [],
      shipment: ship
        ? { status: ship.status, carrier: ship.carrier, trackingCode: ship.trackingCode }
        : null,
      canRepeat: o.operationalTag !== "cancelado",
    };
  });
}
