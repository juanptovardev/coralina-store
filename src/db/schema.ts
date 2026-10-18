import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Catálogo                                                            */
/* ------------------------------------------------------------------ */

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").default("").notNull(),
  imageUrl: text("image_url").default("").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type SizeChartColumn = {
  key: string;
  label: string;
  type: "text" | "number";
  locked?: boolean;
};

export type SizeChartRow = Record<string, string | number>;

export const sizeCharts = pgTable("size_charts", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().unique(),
  unit: text("unit").$type<"cm" | "in">().default("cm").notNull(),
  columns: jsonb("columns").$type<SizeChartColumn[]>().notNull(),
  rows: jsonb("rows").$type<SizeChartRow[]>().notNull(),
  updatedBy: text("updated_by").default("system").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  handle: text("handle").notNull().unique(),
  description: text("description").default("").notNull(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "restrict" }),
  status: text("status").$type<"draft" | "published" | "archived">().default("draft").notNull(),
  priceCents: integer("price_cents").default(0).notNull(),
  compareAtCents: integer("compare_at_cents"),
  images: jsonb("images").$type<string[]>().default([]).notNull(),
  tags: jsonb("tags").$type<string[]>().default([]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const variants = pgTable(
  "variants",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    size: text("size").notNull(),
    sku: text("sku").notNull(),
    active: boolean("active").default(true).notNull(),
  },
  (t) => ({
    uniqueVariant: unique().on(t.productId, t.size),
    productIdx: index("variants_product_id_idx").on(t.productId),
  }),
);

export const inventoryLevels = pgTable("inventory_levels", {
  id: serial("id").primaryKey(),
  variantId: integer("variant_id")
    .notNull()
    .unique()
    .references(() => variants.id, { onDelete: "cascade" }),
  stocked: integer("stocked").default(0).notNull(),
  reserved: integer("reserved").default(0).notNull(),
  threshold: integer("threshold").default(4).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ------------------------------------------------------------------ */
/* Clientes / Pedidos / Envíos                                         */
/* ------------------------------------------------------------------ */

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").default("").notNull(),
  city: text("city").default("").notNull(),
  address: text("address").default("").notNull(),
  notes: text("notes").default("").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type OperationalTag =
  | "por_revisar"
  | "por_empacar"
  | "por_enviar"
  | "por_recibir"
  | "completado"
  | "cancelado";

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    displayId: text("display_id").notNull().unique(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
  source: text("source").$type<"web" | "manual">().default("web").notNull(),
  status: text("status").$type<"pending" | "completed" | "canceled">().default("pending").notNull(),
  operationalTag: text("operational_tag").$type<OperationalTag>().default("por_revisar").notNull(),
  fulfillmentClass: text("fulfillment_class").$type<"enviar" | "no_enviar">().default("enviar").notNull(),
  subtotalCents: integer("subtotal_cents").default(0).notNull(),
  discountCents: integer("discount_cents").default(0).notNull(),
  totalCents: integer("total_cents").default(0).notNull(),
  discountBreakdown: jsonb("discount_breakdown").$type<{ label: string; amountCents: number }[]>().default([]).notNull(),
  // Atribución de promo (analítica): id lógico de la promo aplicada. FK real
  // (estilo del archivo: todas usan .references()); borrar la promo no toca
  // el pedido, solo pierde la atribución.
  promoId: integer("promo_id").references(() => promotions.id, { onDelete: "set null" }),
  paymentRef: text("payment_ref").default("").notNull(),
  paymentMethod: text("payment_method").default("").notNull(),
  notes: text("notes").default("").notNull(),
  tagHistory: jsonb("tag_history").$type<{ tag: string; at: string; by: string }[]>().default([]).notNull(),
  idempotencyKey: text("idempotency_key").unique(),
  // Timestamps de ciclo de vida (F3): todos nullables (migración aditiva).
  paidAt: timestamp("paid_at", { withTimezone: true }),
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  // Devolución/reembolso (F5): estampado por la acción "devolucion" del panel;
  // null = sin devolver. Migración aditiva idempotente (_f5-migrate.mjs).
  returnedAt: timestamp("returned_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (t) => ({
    createdAtIdx: index("orders_created_at_idx").on(t.createdAt),
    customerStatusIdx: index("orders_customer_status_idx").on(t.customerId, t.status),
    promoIdx: index("orders_promo_id_idx").on(t.promoId),
  }),
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    variantId: integer("variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "restrict" }),
    // Desnormalización analítica (F3): snapshot de producto/categoría al
    // vender; evita el join variants→products en queries de top productos.
    productId: integer("product_id"),
    categoryId: integer("category_id"),
    productTitle: text("product_title").notNull(),
    size: text("size").notNull(),
    sku: text("sku").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => ({
    orderIdx: index("order_items_order_id_idx").on(t.orderId),
    productIdx: index("order_items_product_id_idx").on(t.productId),
  }),
);

export type ShipmentStatus = "revision" | "despacho" | "reparto" | "completado" | "archivado";

export const shipments = pgTable(
  "shipments",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .unique()
      .references(() => orders.id, { onDelete: "cascade" }),
    status: text("status").$type<ShipmentStatus>().default("revision").notNull(),
    statusHistory: jsonb("status_history").$type<{ status: string; at: string; by: string }[]>().default([]).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    carrier: text("carrier").default("").notNull(),
    trackingCode: text("tracking_code").default("").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ orderIdx: index("shipments_order_id_idx").on(t.orderId) }),
);

/* ------------------------------------------------------------------ */
/* Diseño: Home layouts + theme tokens                                 */
/* ------------------------------------------------------------------ */

export type BannerConfig = {
  imageUrl: string;
  aspectRatio: number; // 2.13 – 3.84
  overlayOpacity: number; // 0 – 0.4
};

export type WidgetInstance = {
  id: string;
  type:
    | "kicker"
    | "title"
    | "subtitle"
    | "cta_primary"
    | "cta_secondary"
    | "benefits"
    | "slider_dots";
  enabled: boolean;
  slot: "content_top" | "content_main" | "content_bottom" | "benefits_bar";
  grid: { colStart: number; colSpan: number; row: number; align: "left" | "center" | "right" };
  props: Record<string, unknown>;
  zIndex: number;
};

export type SectionInstance = {
  id: string;
  type: "categories" | "featured" | "editorial" | "testimonials" | "newsletter" | "footer";
  enabled: boolean;
  order: number;
  props: Record<string, unknown>;
};

export const homeLayouts = pgTable("home_layouts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  mode: text("mode")
    .$type<"preset_left" | "preset_center" | "preset_right" | "builder">()
    .default("preset_left")
    .notNull(),
  status: text("status").$type<"draft" | "active" | "archived">().default("draft").notNull(),
  banner: jsonb("banner").$type<BannerConfig>().notNull(),
  widgets: jsonb("widgets").$type<WidgetInstance[]>().notNull(),
  sections: jsonb("sections").$type<SectionInstance[]>().notNull(),
  version: integer("version").default(1).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const themeTokens = pgTable("theme_tokens", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

/* ------------------------------------------------------------------ */
/* Promos                                                              */
/* ------------------------------------------------------------------ */

export type PromoType =
  | "category_percent"
  | "category_amount"
  | "sku_percent"
  | "combo"
  | "cart_amount";

export const promotions = pgTable("promotions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").$type<PromoType>().notNull(),
  categoryIds: jsonb("category_ids").$type<number[]>().default([]).notNull(),
  productIds: jsonb("product_ids").$type<number[]>().default([]).notNull(),
  percent: integer("percent").default(0).notNull(),
  amountCents: integer("amount_cents").default(0).notNull(),
  minQty: integer("min_qty").default(0).notNull(),
  minSubtotalCents: integer("min_subtotal_cents").default(0).notNull(),
  comboPriceCents: integer("combo_price_cents").default(0).notNull(),
  priority: integer("priority").default(10).notNull(),
  stackable: boolean("stackable").default(false).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).defaultNow().notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  code: text("code").default("").notNull(),
  usageCount: integer("usage_count").default(0).notNull(),
});

/* ------------------------------------------------------------------ */
/* Auditoría                                                           */
/* ------------------------------------------------------------------ */

export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    actorName: text("actor_name").notNull(),
    actorRole: text("actor_role").$type<"admin" | "asesor" | "cliente" | "system">().notNull(),
    module: text("module").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").default("").notNull(),
    action: text("action").notNull(),
    fieldChanged: text("field_changed").default("").notNull(),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    summary: text("summary").default("").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ createdAtIdx: index("audit_log_created_at_idx").on(t.createdAt) }),
);

/** Registro inmutable de purgas: nunca se borra. */
export const auditPurges = pgTable("audit_purges", {
  id: serial("id").primaryKey(),
  month: text("month").notNull(),
  deletedCount: integer("deleted_count").default(0).notNull(),
  actorName: text("actor_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const appMeta = pgTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/* ------------------------------------------------------------------ */
/* Usuarios (login con scrypt, F4)                                     */
/* ------------------------------------------------------------------ */

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").$type<"admin" | "asesor" | "cliente">().notNull(),
  // Estado de la cuenta (T4): false = desactivada, no puede entrar al panel.
  active: boolean("active").notNull().default(true),
  // Último login exitoso (T4). Best-effort: null mientras nunca haya entrado.
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
