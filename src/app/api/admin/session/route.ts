import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { passwordMatches } from "@/lib/admin-auth";
import { getActor, actorForRole, type Actor } from "@/lib/session";
import { clientIp, rateLimit, RATE_LIMIT_ERROR, RATE_LIMIT_RETRY_AFTER } from "@/lib/rate-limit";
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
  if (!rateLimit(clientIp(req))) {
    return NextResponse.json(
      { ok: false, error: RATE_LIMIT_ERROR },
      { status: 429, headers: { "Retry-After": RATE_LIMIT_RETRY_AFTER } },
    );
  }
  const body = (await req.json().catch(() => null)) as
    | { role?: string; email?: string; password?: string }
    | null;
  if (!body || (body.role !== "asesor" && body.role !== "admin")) {
    return NextResponse.json({ ok: false, error: "Rol inválido." }, { status: 400 });
  }
  const role = body.role;

  // Login por usuario: si viene email no vacío se valida contra la tabla users
  // (hash scrypt) exigiendo que el rol de la cuenta coincida con el pedido.
  // Mismo mensaje 401 para email desconocido, clave incorrecta, rol distinto o
  // error de DB (fail-closed) — y checkEmailLogin quema scrypt en todos los
  // caminos, así que el timing tampoco filtra cuál falló.
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  let actor: Actor;
  let user: Awaited<ReturnType<typeof findUserByEmail>> = null;
  if (email !== "") {
    try {
      user = await findUserByEmail(email);
    } catch (e) {
      // DB caída → user queda null; checkEmailLogin quema scrypt igual
      // (timing uniforme) y deniega. Nunca 500 con stack.
      console.error("[session] lookup de usuario falló:", e);
    }
    if (!(await checkEmailLogin(user, body.password ?? "", role))) {
      return NextResponse.json({ ok: false, error: "Credenciales inválidas." }, { status: 401 });
    }
    actor = {
      role,
      name: user!.name,
      canHardDelete: role === "admin",
      canPurgeAudit: role === "admin",
    };
  } else {
    // Ruta legacy (clave compartida): emite sesión sin email. Ambos roles exigen
    // la clave: emitir una cookie de sesión desbloquea TODO /api/admin/* vía el
    // gate, así que no se emite sin credencial (evita puerta trasera).
    if (!passwordMatches(body.password)) {
      return NextResponse.json({ ok: false, error: "Reautenticación fallida." }, { status: 401 });
    }
    actor = actorForRole(role);
  }

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
