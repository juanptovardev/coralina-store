import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getActor, actorForRole, type Actor } from "@/lib/session";
import { clientIp, rateLimit, RATE_LIMIT_ERROR, RATE_LIMIT_RETRY_AFTER } from "@/lib/rate-limit";
import { checkLoginThrottle, registerLoginFailure, clearLoginThrottle } from "@/lib/login-throttle";
import { decodeRole, encodeRole } from "@/lib/session-sign";
import { findUserByEmail, checkEmailLogin } from "@/lib/users";
import { recordAudit } from "@/lib/audit";
export async function GET() {
  // Sin cookie de rol VÁLIDA devolvemos role:null. getActor() es fail-closed
  // (lanza ForbiddenError), así que no sirve para detectar sesión ausente.
  const raw = (await cookies()).get("coralina_role")?.value;
  const role = await decodeRole(raw);
  // Allowlist del rol (no truthiness): un cookie basura no debe verse como sesión.
  // Este guard debe quedarse: getActor() lanzaría ForbiddenError (500 sin capturar)
  // si el rol no es válido, en vez de devolver { role: null }.
  if (role !== "admin" && role !== "asesor") return NextResponse.json({ role: null });
  return NextResponse.json(await getActor());
}

export async function POST(req: Request) {
  // Boundary sensible (credencial): limita el brute-force aunque esté exento del gate admin.
  const ip = clientIp(req);
  if (!rateLimit(ip)) {
    return NextResponse.json(
      { ok: false, error: RATE_LIMIT_ERROR },
      { status: 429, headers: { "Retry-After": RATE_LIMIT_RETRY_AFTER } },
    );
  }
  const body = (await req.json().catch(() => null)) as
    | { email?: string; password?: string }
    | null;
  // El rol NUNCA viene del body. Sin email no hay sesión: mismo 401 que la clave
  // inválida para no filtrar qué falló.
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email === "") {
    return NextResponse.json({ ok: false, error: "Credenciales inválidas." }, { status: 401 });
  }

  // Throttle por cuenta (email|ip): 6+ fallos en 15 min → 429 antes de tocar scrypt.
  const throttleKey = `${email}|${ip}`;
  const throttle = checkLoginThrottle(throttleKey);
  if (throttle.blocked) {
    return NextResponse.json(
      { ok: false, error: RATE_LIMIT_ERROR },
      { status: 429, headers: { "Retry-After": String(throttle.retryAfterSeconds) } },
    );
  }

  // Login contra la tabla users (hash scrypt). Mismo 401 para email desconocido,
  // clave incorrecta o error de DB (fail-closed): checkEmailLogin quema scrypt en
  // todos los caminos, así que el timing tampoco filtra cuál falló.
  let user: Awaited<ReturnType<typeof findUserByEmail>> = null;
  try {
    user = await findUserByEmail(email);
  } catch (e) {
    // DB caída → user queda null; checkEmailLogin quema scrypt igual
    // (timing uniforme) y deniega. Nunca 500 con stack.
    console.error("[session] lookup de usuario falló:", e);
  }
  if (!(await checkEmailLogin(user, body?.password ?? ""))) {
    registerLoginFailure(throttleKey);
    return NextResponse.json({ ok: false, error: "Credenciales inválidas." }, { status: 401 });
  }

  // El rol se deriva SIEMPRE de la fila users (nunca del body ni por clave compartida).
  const role = user!.role;
  const actor: Actor = actorForRole(role);
  clearLoginThrottle(throttleKey);

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
  // Auditoría best-effort: la cookie ya está emitida; un fallo de DB de auditoría
  // no debe convertir un login exitoso en error visible.
  try {
    await recordAudit({
      actor,
      module: "session",
      entityType: "session",
      entityId: actor.role,
      action: "login",
      summary: `${actor.name} inició sesión.`,
    });
  } catch (e) {
    console.error("[session] auditoría de login falló:", e);
  }
  return NextResponse.json({ ok: true, role });
}

export async function DELETE() {
  const store = await cookies();
  // Si hay sesión válida se audita el logout; si no (cookie basura/expirada),
  // se limpia igual y no se registra nada.
  let actor: Actor | null = null;
  try {
    actor = await getActor();
  } catch {
    actor = null;
  }
  store.set("coralina_role", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  if (actor) {
    try {
      await recordAudit({
        actor,
        module: "session",
        entityType: "session",
        entityId: actor.role,
        action: "logout",
        summary: `${actor.name} cerró sesión.`,
      });
    } catch (e) {
      console.error("[session] auditoría de logout falló:", e);
    }
  }
  return NextResponse.json({ ok: true });
}
