import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { passwordMatches } from "@/lib/admin-auth";
import { getActor } from "@/lib/session";
import { clientIp, rateLimit, RATE_LIMIT_ERROR, RATE_LIMIT_RETRY_AFTER } from "@/lib/rate-limit";
import { encodeRole } from "@/lib/session-sign";
export async function GET() {
  const actor = await getActor();
  return NextResponse.json(actor);
}

export async function POST(req: Request) {
  // Boundary sensible (credencial): limita el brute-force aunque esté exento del gate admin.
  if (!rateLimit(clientIp(req))) {
    return NextResponse.json(
      { ok: false, error: RATE_LIMIT_ERROR },
      { status: 429, headers: { "Retry-After": RATE_LIMIT_RETRY_AFTER } },
    );
  }
  const body = (await req.json().catch(() => null)) as { role?: string; password?: string } | null;
  if (!body || (body.role !== "asesor" && body.role !== "admin")) {
    return NextResponse.json({ ok: false, error: "Rol inválido." }, { status: 400 });
  }
  if (body.role === "admin" && !passwordMatches(body.password)) {
    return NextResponse.json({ ok: false, error: "Reautenticación fallida." }, { status: 401 });
  }
  const role = body.role;
  const store = await cookies();
  // En producción se firma la cookie (HMAC) para que no sea falsificable.
  const value = await encodeRole(role);
  store.set("coralina_role", value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return NextResponse.json({ ok: true, role });
}
