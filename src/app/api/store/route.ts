import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { createOrder } from "@/lib/orders";
import { ensureSeeded } from "@/lib/seed";
import { clientIp, rateLimit, RATE_LIMIT_ERROR, RATE_LIMIT_RETRY_AFTER } from "@/lib/rate-limit";
import { normalizeCartItems } from "@/lib/cart-input";

type Body = {
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
    city?: string;
    address?: string;
    notes?: string;
  };
  items?: Array<{ variantId?: string | number; qty?: number }>;
  promoCode?: string | null;
  payment?: { method?: string; ref?: string } | null;
  notes?: string | null;
};

export async function POST(req: NextRequest) {
  if (!rateLimit(clientIp(req))) {
    return NextResponse.json(
      { error: RATE_LIMIT_ERROR },
      { status: 429, headers: { "Retry-After": RATE_LIMIT_RETRY_AFTER } },
    );
  }

  // Garantiza la secuencia de display_id (idempotente) antes del checkout.
  try {
    await ensureSeeded();
  } catch (e) {
    console.error("[store] ensureSeeded failed:", e);
    return NextResponse.json({ error: "Servicio no disponible." }, { status: 500 });
  }

  let body: Body;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object") {
      return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    }
    body = parsed as Body;
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const name = (body.customer?.name ?? "").trim();
  const email = (body.customer?.email ?? "").trim().toLowerCase();
  if (!name || !email) {
    return NextResponse.json({ error: "Nombre y correo son obligatorios." }, { status: 400 });
  }
  if (Array.isArray(body.items) && body.items.length === 0) {
    return NextResponse.json({ error: "Tu carrito está vacío." }, { status: 400 });
  }
  // Frontera compartida con /api/cart/evaluate (una sola fuente ⇒ preview y cobro no divergen).
  const norm = normalizeCartItems(body.items, "qty");
  if (!norm.ok) {
    const error = norm.reason === "empty" ? "Los productos del carrito no son válidos." : "Carrito demasiado grande.";
    return NextResponse.json({ error }, { status: 400 });
  }
  const orderItems = norm.items;

  let result;
  try {
    result = await createOrder(
      {
        customer: {
          name,
          email,
          phone: body.customer?.phone ?? "",
          city: body.customer?.city ?? "",
          address: body.customer?.address ?? "",
        },
        items: orderItems,
        source: "web",
        fulfillmentClass: "enviar",
        paymentRef: body.payment?.ref || undefined,
        paymentMethod: body.payment?.method || undefined,
        notes: body.notes || body.customer?.notes || undefined,
        promoCode: typeof body.promoCode === "string" && body.promoCode.trim() ? body.promoCode.trim() : null,
      },
      { name: "Storefront", role: "system" },
    );
  } catch (e) {
    console.error("[store] createOrder failed:", e);
    return NextResponse.json({ error: "No pudimos procesar tu pedido." }, { status: 500 });
  }

  if (!result.ok) {
    const status = result.code === "invalid_items" ? 400 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }

  try {
    const [order] = await db.select().from(orders).where(eq(orders.id, result.orderId)).limit(1);
    const breakdown = Array.isArray(order?.discountBreakdown)
      ? (order?.discountBreakdown as Array<{ label?: string }>)
      : [];

    return NextResponse.json({
      code: result.displayId.replace(/^#/, ""),
      total: (order?.totalCents ?? 0) / 100,
      discount: (order?.discountCents ?? 0) / 100,
      promo: breakdown[0]?.label ?? null,
    });
  } catch (e) {
    console.error("[store] read order failed:", e);
    return NextResponse.json({ error: "No pudimos leer el pedido creado." }, { status: 500 });
  }
}
