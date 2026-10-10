import { db } from "@/db";
import {
  appMeta,
  auditLog,
  categories,
  customers,
  homeLayouts,
  inventoryLevels,
  orderItems,
  orders,
  products,
  promotions,
  shipments,
  sizeCharts,
  themeTokens,
  variants,
  type SizeChartColumn,
  type SizeChartRow,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  BANNER_IMAGES,
  DEFAULT_TOKENS,
  defaultSections,
  defaultWidgets,
} from "./constants";

const SEED_KEY = "coralina_seed_v1";

const STD_COLUMNS: SizeChartColumn[] = [
  { key: "size", label: "Talla", type: "text", locked: true },
  { key: "busto", label: "Busto", type: "number" },
  { key: "cintura", label: "Cintura", type: "number" },
  { key: "cadera", label: "Cadera", type: "number" },
];

const STD_ROWS: SizeChartRow[] = [
  { size: "XS", busto: 78, cintura: 60, cadera: 86 },
  { size: "S", busto: 83, cintura: 65, cadera: 91 },
  { size: "M", busto: 88, cintura: 70, cadera: 96 },
  { size: "L", busto: 93, cintura: 75, cadera: 101 },
  { size: "XL", busto: 98, cintura: 80, cadera: 106 },
];

const PANTY_COLUMNS: SizeChartColumn[] = [
  { key: "size", label: "Talla", type: "text", locked: true },
  { key: "cadera", label: "Cadera", type: "number" },
];

const PANTY_ROWS: SizeChartRow[] = [
  { size: "S", cadera: 91 },
  { size: "M", cadera: 96 },
  { size: "L", cadera: 101 },
];

type SeedProduct = {
  title: string;
  handle: string;
  description: string;
  category: string;
  price: number;
  compareAt?: number;
  images: string[];
  tags: string[];
  sizes: string[];
  stock: number[];
};

const px = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800`;

const SEED_PRODUCTS: SeedProduct[] = [
  {
    title: "Bikini Coralina Verde Palma",
    handle: "bikini-coralina-verde-palma",
    description:
      "Triangular con lazos ajustables y panty de tiro alto. Tela italiana con protección UV50+ y secado rápido.",
    category: "bikinis",
    price: 28900000,
    compareAt: 33900000,
    images: [px(8371408), px(4271771)],
    tags: ["home", "nuevo"],
    sizes: ["XS", "S", "M", "L"],
    stock: [6, 12, 9, 3],
  },
  {
    title: "Bikini Arrecife Ámbar",
    handle: "bikini-arrecife-ambar",
    description: "Top bandeau con varillas removibles y panty brasilera. Doble forro, no transparenta.",
    category: "bikinis",
    price: 31900000,
    images: [px(9162885), px(4271772)],
    tags: ["home"],
    sizes: ["S", "M", "L", "XL"],
    stock: [10, 2, 7, 5],
  },
  {
    title: "Enterizo Marea Terracota",
    handle: "enterizo-marea-terracota",
    description: "Enterizo escote halter con espalda descubierta y control suave en abdomen.",
    category: "enterizos",
    price: 38900000,
    compareAt: 44900000,
    images: [px(5405652), px(5405653)],
    tags: ["home", "nuevo"],
    sizes: ["XS", "S", "M", "L", "XL"],
    stock: [4, 8, 11, 6, 0],
  },
  {
    title: "Enterizo Brisa Lino",
    handle: "enterizo-brisa-lino",
    description: "Silueta clásica en tono lino, tirantes cruzados y copa preformada.",
    category: "enterizos",
    price: 35900000,
    images: [px(4271767), px(5405629)],
    tags: [],
    sizes: ["S", "M", "L"],
    stock: [9, 14, 1],
  },
  {
    title: "Salida de Playa Palma",
    handle: "salida-de-playa-palma",
    description: "Kimono en gasa liviana con bordado artesanal en el ruedo. Talla única.",
    category: "salidas",
    price: 21900000,
    images: [px(4284291), px(5405629)],
    tags: ["home"],
    sizes: ["U"],
    stock: [22],
  },
  {
    title: "Panty Duna Alta",
    handle: "panty-duna-alta",
    description: "Panty de tiro alto para combinar con cualquier top de la colección.",
    category: "panty",
    price: 13900000,
    images: [px(4271772), px(9162885)],
    tags: ["home"],
    sizes: ["S", "M", "L"],
    stock: [18, 16, 3],
  },
];

/** Crea/sincroniza la secuencia atómica de display_id (idempotente y monotónica). */
async function syncOrdersDisplaySeq(): Promise<void> {
  await db.execute(sql`create sequence if not exists orders_display_seq start 1041`);
  await db.execute(
    sql`select setval('orders_display_seq', greatest((select coalesce(max((substring(display_id from 5))::int) filter (where display_id ~ '^#CR-[0-9]+$'), 1040) from orders), (select last_value from orders_display_seq)), true)`,
  );
}

export async function ensureSeeded(): Promise<void> {
  const existing = await db.select().from(appMeta).where(eq(appMeta.key, SEED_KEY)).limit(1);
  if (existing.length > 0) {
    await syncOrdersDisplaySeq();
    return;
  }

  // ---- theme tokens
  for (const [key, value] of Object.entries(DEFAULT_TOKENS)) {
    await db.insert(themeTokens).values({ key, value }).onConflictDoNothing();
  }

  // ---- categories + size charts
  const catSeed = [
    {
      name: "Bikinis",
      slug: "bikinis",
      description: "Dos piezas ajustables, del clásico triangular al bandeau estructurado.",
      imageUrl: px(8371408),
      chart: { columns: STD_COLUMNS, rows: STD_ROWS },
    },
    {
      name: "Enterizos",
      slug: "enterizos",
      description: "Siluetas de una pieza con soporte y caída impecable.",
      imageUrl: px(5405652),
      chart: { columns: STD_COLUMNS, rows: STD_ROWS },
    },
    {
      name: "Salidas de playa",
      slug: "salidas",
      description: "Capas livianas para el after–mar.",
      imageUrl: px(4284291),
      chart: {
        columns: [{ key: "size", label: "Talla", type: "text", locked: true }] as SizeChartColumn[],
        rows: [{ size: "U" }] as SizeChartRow[],
      },
    },
    {
      name: "Panty",
      slug: "panty",
      description: "Complementa tu top favorito.",
      imageUrl: px(4271772),
      chart: { columns: PANTY_COLUMNS, rows: PANTY_ROWS },
    },
  ];

  const categoryIdBySlug = new Map<string, number>();
  let sort = 1;
  for (const c of catSeed) {
    const [row] = await db
      .insert(categories)
      .values({
        name: c.name,
        slug: c.slug,
        description: c.description,
        imageUrl: c.imageUrl,
        sortOrder: sort++,
      })
      .returning();
    categoryIdBySlug.set(c.slug, row.id);
    await db.insert(sizeCharts).values({
      categoryId: row.id,
      unit: "cm",
      columns: c.chart.columns,
      rows: c.chart.rows,
      updatedBy: "system",
    });
  }

  // ---- products, variants, inventory
  const variantIdByKey = new Map<string, { id: number; title: string; size: string; sku: string; price: number }>();
  for (const p of SEED_PRODUCTS) {
    const [prod] = await db
      .insert(products)
      .values({
        title: p.title,
        handle: p.handle,
        description: p.description,
        categoryId: categoryIdBySlug.get(p.category)!,
        status: "published",
        priceCents: p.price,
        compareAtCents: p.compareAt ?? null,
        images: p.images,
        tags: p.tags,
      })
      .returning();

    const slug = p.handle.toUpperCase().slice(0, 12).replace(/-/g, "");
    for (let i = 0; i < p.sizes.length; i++) {
      const size = p.sizes[i];
      const [v] = await db
        .insert(variants)
        .values({ productId: prod.id, size, sku: `${slug}-${size}`, active: true })
        .returning();
      await db.insert(inventoryLevels).values({
        variantId: v.id,
        stocked: p.stock[i] ?? 0,
        reserved: 0,
        threshold: 4,
      });
      variantIdByKey.set(`${p.handle}:${size}`, {
        id: v.id,
        title: p.title,
        size,
        sku: v.sku,
        price: p.price,
      });
    }
  }

  // ---- customers
  const custSeed = [
    { name: "Valentina Ríos", email: "valentina.rios@mail.com", phone: "3105557788", city: "Cartagena", address: "Cra 3 #6-50, Bocagrande" },
    { name: "Mariana Ospina", email: "mariana.ospina@mail.com", phone: "3128889900", city: "Medellín", address: "Cll 10 #43-22, El Poblado" },
    { name: "Daniela Guerrero", email: "dani.guerrero@mail.com", phone: "3001122334", city: "Bogotá", address: "Cra 15 #93-40" },
    { name: "Laura Restrepo", email: "laura.restrepo@mail.com", phone: "3159988776", city: "Santa Marta", address: "Cll 22 #4-10, Rodadero" },
    { name: "Camila Bernal", email: "camila.bernal@mail.com", phone: "3174455667", city: "Cali", address: "Av 6N #28-14" },
  ];
  const customerIds: number[] = [];
  for (const c of custSeed) {
    const [row] = await db.insert(customers).values(c).returning();
    customerIds.push(row.id);
  }

  // ---- orders + shipments
  const orderSeed: {
    customerIdx: number;
    source: "web" | "manual";
    tag: "por_revisar" | "por_empacar" | "por_enviar" | "por_recibir" | "completado";
    cls: "enviar" | "no_enviar";
    shipment: "revision" | "despacho" | "reparto" | "completado" | null;
    items: { key: string; qty: number }[];
    hoursAgo: number;
  }[] = [
    { customerIdx: 0, source: "web", tag: "por_revisar", cls: "enviar", shipment: "revision", items: [{ key: "bikini-coralina-verde-palma:S", qty: 1 }], hoursAgo: 3 },
    { customerIdx: 1, source: "web", tag: "por_empacar", cls: "enviar", shipment: "despacho", items: [{ key: "enterizo-marea-terracota:M", qty: 1 }, { key: "salida-de-playa-palma:U", qty: 1 }], hoursAgo: 20 },
    { customerIdx: 2, source: "manual", tag: "completado", cls: "no_enviar", shipment: null, items: [{ key: "panty-duna-alta:M", qty: 2 }], hoursAgo: 30 },
    { customerIdx: 3, source: "web", tag: "por_enviar", cls: "enviar", shipment: "reparto", items: [{ key: "bikini-arrecife-ambar:L", qty: 1 }], hoursAgo: 46 },
    { customerIdx: 4, source: "web", tag: "por_recibir", cls: "enviar", shipment: "completado", items: [{ key: "enterizo-brisa-lino:S", qty: 1 }, { key: "panty-duna-alta:S", qty: 1 }], hoursAgo: 72 },
  ];

  let seq = 1041;
  for (const o of orderSeed) {
    const createdAt = new Date(Date.now() - o.hoursAgo * 3600 * 1000);
    const lines = o.items.map((i) => {
      const v = variantIdByKey.get(i.key)!;
      return { v, qty: i.qty };
    });
    const subtotal = lines.reduce((acc, l) => acc + l.v.price * l.qty, 0);
    const [order] = await db
      .insert(orders)
      .values({
        displayId: `#CR-${seq++}`,
        customerId: customerIds[o.customerIdx],
        source: o.source,
        status: o.tag === "completado" ? "completed" : "pending",
        operationalTag: o.tag,
        fulfillmentClass: o.cls,
        subtotalCents: subtotal,
        discountCents: 0,
        totalCents: subtotal,
        paymentRef: o.source === "manual" ? "Transferencia Bancolombia" : "Pago en línea (referencia)",
        tagHistory: [{ tag: o.tag, at: createdAt.toISOString(), by: "sistema" }],
        createdAt,
      })
      .returning();

    for (const l of lines) {
      await db.insert(orderItems).values({
        orderId: order.id,
        variantId: l.v.id,
        productTitle: l.v.title,
        size: l.v.size,
        sku: l.v.sku,
        unitPriceCents: l.v.price,
        quantity: l.qty,
      });
    }

    if (o.shipment) {
      await db.insert(shipments).values({
        orderId: order.id,
        status: o.shipment,
        statusHistory: [{ status: o.shipment, at: createdAt.toISOString(), by: "sistema" }],
        completedAt: o.shipment === "completado" ? new Date(Date.now() - 2 * 3600 * 1000) : null,
        createdAt,
      });
    }

    await db.insert(auditLog).values({
      actorName: "Sistema",
      actorRole: "system",
      module: "pedidos",
      entityType: "order",
      entityId: order.displayId,
      action: "create",
      summary: `Pedido ${order.displayId} creado desde ${o.source === "web" ? "la tienda" : "el dashboard"}.`,
      createdAt,
    });
  }

  // ---- home layouts
  const layoutSeed = [
    { name: "Home Izquierda", mode: "preset_left" as const, status: "active" as const },
    { name: "Home Centro", mode: "preset_center" as const, status: "draft" as const },
    { name: "Home Derecha", mode: "preset_right" as const, status: "draft" as const },
    { name: "Constructor libre", mode: "builder" as const, status: "draft" as const },
  ];
  for (const l of layoutSeed) {
    await db.insert(homeLayouts).values({
      name: l.name,
      mode: l.mode,
      status: l.status,
      banner: { imageUrl: BANNER_IMAGES[l.mode], aspectRatio: 2.8, overlayOpacity: 0.28 },
      widgets: defaultWidgets(l.mode),
      sections: defaultSections(),
      version: 1,
      publishedAt: l.status === "active" ? new Date() : null,
    });
  }

  // ---- promos
  await db.insert(promotions).values([
    {
      name: "15% en Bikinis",
      type: "category_percent",
      categoryIds: [categoryIdBySlug.get("bikinis")!],
      percent: 15,
      priority: 20,
      enabled: true,
      code: "",
    },
    {
      name: "Combo Playa: 2 piezas por $450.000",
      type: "combo",
      categoryIds: [categoryIdBySlug.get("bikinis")!, categoryIdBySlug.get("enterizos")!],
      minQty: 2,
      comboPriceCents: 45000000,
      priority: 5,
      enabled: true,
    },
    {
      name: "$30.000 off desde $400.000",
      type: "cart_amount",
      amountCents: 3000000,
      minSubtotalCents: 40000000,
      priority: 40,
      enabled: true,
      stackable: false,
    },
  ]);

  await db.insert(auditLog).values({
    actorName: "Sistema",
    actorRole: "system",
    module: "diseno",
    entityType: "home_layout",
    entityId: "1",
    action: "publish",
    summary: "Se publicó el layout «Home Izquierda» como home activo.",
  });

  await db.insert(appMeta).values({ key: SEED_KEY, value: new Date().toISOString() });

  // La secuencia se sincroniza DESPUÉS del seed: los pedidos semilla usan
  // #CR-1041.. y un clon fresco no debe colisionar en los primeros checkouts.
  await syncOrdersDisplaySeq();
}
