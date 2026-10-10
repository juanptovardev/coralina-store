import { NextResponse, type NextRequest } from "next/server";
import { decodeRole } from "@/lib/session-sign";

// Deny-by-default en todo /api/admin/*. La cookie `coralina_role` va FIRMADA (HMAC,
// ver session-sign.ts) en producción ⇒ no es falsificable. En dev/QA se acepta el
// valor plano para no romper las suites locales. Definir CORALINA_SESSION_SECRET
// (o CORALINA_ADMIN_PASSWORD) en prod; sin secreto se usa un default de dev.
// Única excepción: /api/admin/session (establece la cookie firmada).
// Next 16: convención `proxy.ts` (reemplaza `middleware.ts`, deprecado).
const PUBLIC_PREFIX = "/api/admin/session";

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === PUBLIC_PREFIX || pathname.startsWith(PUBLIC_PREFIX + "/")) return NextResponse.next();
  const raw = req.cookies.get("coralina_role")?.value;
  const role = await decodeRole(raw);
  if (role !== "admin" && role !== "asesor") {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/admin/:path*",
};
