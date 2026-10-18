import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { encodeSessionIdentity, getSessionRole } from "@/lib/session-role";
import { checkEmailLogin, findUserByEmail } from "@/lib/users";
import { clientIp, rateLimit, RATE_LIMIT_ERROR, RATE_LIMIT_RETRY_AFTER } from "@/lib/rate-limit";
import { checkLoginThrottle, clearLoginThrottle, registerLoginFailure } from "@/lib/login-throttle";

/**
 * Vincula el email verificado a la sesión actual. La cookie `coralina_role` solo
 * guarda el rol, así que /api/mi-cuenta necesita saber QUÉ cuenta es. Este
 * endpoint exige (a) una sesión de rol válida y (b) la clave de la cuenta, y
 * recién entonces emite `coralina_identity` (firmada, HttpOnly). El email nunca
 * se acepta en las acciones de /api/mi-cuenta: se lee solo de esta cookie.
 *
 * Lo llaman /login y /register justo después de autenticar. NO toca
 * POST /api/admin/session ni /api/register.
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(ip)) {
    return NextResponse.json(
      { ok: false, error: RATE_LIMIT_ERROR },
      { status: 429, headers: { "Retry-After": RATE_LIMIT_RETRY_AFTER } },
    );
  }

  // Sin sesión de rol no se emite identidad: evita ser un oráculo de login suelto.
  const role = await getSessionRole();
  if (!role) {
    return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email) {
    return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
  }

  const throttleKey = `bind:${email}|${ip}`;
  const throttle = checkLoginThrottle(throttleKey);
  if (throttle.blocked) {
    return NextResponse.json(
      { ok: false, error: RATE_LIMIT_ERROR },
      { status: 429, headers: { "Retry-After": String(throttle.retryAfterSeconds) } },
    );
  }

  let user: Awaited<ReturnType<typeof findUserByEmail>> = null;
  try {
    user = await findUserByEmail(email);
  } catch (e) {
    console.error("[mi-cuenta/session] lookup falló:", e);
  }

  // checkEmailLogin quema scrypt en todos los caminos (timing uniforme).
  const ok = (await checkEmailLogin(user, password)) && user !== null && user.role === role;
  if (!ok) {
    registerLoginFailure(throttleKey);
    return NextResponse.json({ ok: false, error: "No pudimos verificar la cuenta." }, { status: 401 });
  }

  clearLoginThrottle(throttleKey);
  const store = await cookies();
  store.set("coralina_identity", await encodeSessionIdentity(email), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return NextResponse.json({ ok: true });
}

/** Limpia la identidad (logout). Idempotente y sin exigir sesión. */
export async function DELETE() {
  const store = await cookies();
  store.set("coralina_identity", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return NextResponse.json({ ok: true });
}
