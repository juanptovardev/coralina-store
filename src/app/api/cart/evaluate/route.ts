import { NextResponse } from "next/server";
import { buildCartLines } from "@/lib/orders";
import { evaluateCart } from "@/lib/promo";
import { clientIp, rateLimit, RATE_LIMIT_ERROR, RATE_LIMIT_RETRY_AFTER } from "@/lib/rate-limit";
import { normalizeCartItems } from "@/lib/cart-input";

export async function POST(req: Request) {
  if (!rateLimit(clientIp(req))) {
    return NextResponse.json(
      { error: RATE_LIMIT_ERROR },
      { status: 429, headers: { "Retry-After": RATE_LIMIT_RETRY_AFTER } },
    );
  }
  // Frontera pública: nunca 5xx por input hostil (espeja la validación de /api/store).
  let body: { items?: unknown; code?: unknown };
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object") {
      return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    }
    body = parsed as { items?: unknown; code?: unknown };
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  // Frontera compartida con /api/store (una sola fuente ⇒ preview y cobro no divergen).
  const norm = normalizeCartItems(body?.items, "quantity");
  if (!norm.ok) {
    const error = norm.reason === "empty" ? "Carrito inválido." : "Carrito demasiado grande.";
    return NextResponse.json({ error }, { status: 400 });
  }
  const items = norm.items;
  try {
    const lines = await buildCartLines(items);
    if (lines.length === 0) {
      return NextResponse.json({ error: "Los productos del carrito no son válidos." }, { status: 400 });
    }
    const totals = await evaluateCart(lines, typeof body.code === "string" ? body.code : null);
    return NextResponse.json(totals);
  } catch (e) {
    // Fallo de motor/DB ⇒ JSON y nunca HTML 500 al cliente público.
    console.error("[cart/evaluate] failed:", e);
    return NextResponse.json({ error: "No pudimos calcular el carrito." }, { status: 500 });
  }
}
