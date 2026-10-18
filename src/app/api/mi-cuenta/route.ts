import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionRole, getSessionEmail, type SessionRole } from "@/lib/session-role";
import { getProfileByEmail, getOrdersForEmail, updateProfileByEmail } from "@/lib/mi-cuenta";
import { validateProfile, validatePasswordChange, type ProfileInput } from "@/lib/validate-profile";
import { findUserByEmail, hashPassword, verifyPassword } from "@/lib/users";
import { checkLoginThrottle, clearLoginThrottle, registerLoginFailure } from "@/lib/login-throttle";
import { RATE_LIMIT_ERROR } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

type Session = { role: SessionRole; email: string };

/**
 * Sesión del panel de cliente: rol (cookie firmada) + email (cookie de identidad
 * emitida tras verificar la clave en /api/mi-cuenta/session). El email NUNCA sale
 * del body de estas acciones.
 */
async function currentSession(): Promise<Session | null> {
  const role = await getSessionRole();
  if (!role) return null;
  const email = await getSessionEmail();
  if (!email) return null;
  return { role, email };
}

function unauthorized() {
  return NextResponse.json(
    { ok: false, code: "invalid_session", error: "Sesión inválida. Vuelve a iniciar sesión." },
    { status: 401 },
  );
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const parsed = await req.json().catch(() => null);
  return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
}

/** Auditoría best-effort: la acción del usuario ya se aplicó. */
async function auditBestEffort(input: Parameters<typeof recordAudit>[0]): Promise<void> {
  try {
    await recordAudit(input);
  } catch (e) {
    console.error("[mi-cuenta] auditoría falló:", e);
  }
}

/** Perfil + pedidos del cliente. Todo se resuelve por el email de la sesión. */
export async function GET() {
  const session = await currentSession();
  if (!session) return unauthorized();
  try {
    const [profile, orders] = await Promise.all([
      getProfileByEmail(session.email),
      getOrdersForEmail(session.email),
    ]);
    if (!profile) return unauthorized();
    return NextResponse.json({ ok: true, profile, orders });
  } catch (e) {
    console.error("[mi-cuenta] GET falló:", e);
    return NextResponse.json({ ok: false, error: "No pudimos cargar tu cuenta." }, { status: 500 });
  }
}

/** Guarda name (users) + phone/city/address (customers) del propio perfil. */
export async function PATCH(req: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const check = validateProfile((await readBody(req)) as ProfileInput);
  if (!check.ok) {
    return NextResponse.json({ ok: false, error: check.error }, { status: 400 });
  }

  let previous: Awaited<ReturnType<typeof getProfileByEmail>> = null;
  try {
    previous = await getProfileByEmail(session.email);
    const profile = await updateProfileByEmail(session.email, check.data);
    await auditBestEffort({
      actor: { name: session.email, role: session.role, canHardDelete: false, canPurgeAudit: false },
      module: "clientes",
      entityType: "customer",
      entityId: session.email,
      action: "update",
      fieldChanged: "profile",
      oldValue: previous
        ? { name: previous.name, phone: previous.phone, city: previous.city, address: previous.address }
        : null,
      newValue: check.data,
      summary: "El cliente actualizó sus datos de perfil.",
    });
    return NextResponse.json({ ok: true, profile });
  } catch (e) {
    console.error("[mi-cuenta] PATCH falló:", e);
    return NextResponse.json({ ok: false, error: "No pudimos guardar tus datos." }, { status: 500 });
  }
}

/** Cambio de contraseña con la clave actual. Throttle por cuenta: pwd:<email>. */
export async function POST(req: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const check = validatePasswordChange(await readBody(req));
  if (!check.ok) {
    return NextResponse.json({ ok: false, error: check.error }, { status: 400 });
  }

  const throttleKey = `pwd:${session.email}`;
  const throttle = checkLoginThrottle(throttleKey);
  if (throttle.blocked) {
    return NextResponse.json(
      { ok: false, error: RATE_LIMIT_ERROR },
      { status: 429, headers: { "Retry-After": String(throttle.retryAfterSeconds) } },
    );
  }

  try {
    const user = await findUserByEmail(session.email);
    if (!user) return unauthorized();

    let currentOk = false;
    try {
      currentOk = await verifyPassword(check.data.currentPassword, user.passwordHash);
    } catch {
      currentOk = false;
    }
    if (!currentOk) {
      registerLoginFailure(throttleKey);
      return NextResponse.json(
        { ok: false, code: "invalid_current_password", error: "No pudimos validar la contraseña actual." },
        { status: 401 },
      );
    }

    const passwordHash = await hashPassword(check.data.newPassword);
    await db
      .update(users)
      .set({ passwordHash })
      .where(and(eq(users.id, user.id), eq(users.email, session.email)));
    clearLoginThrottle(throttleKey);

    await auditBestEffort({
      actor: { name: session.email, role: session.role, canHardDelete: false, canPurgeAudit: false },
      module: "session",
      entityType: "user",
      entityId: session.email,
      action: "update",
      fieldChanged: "password",
      summary: "El cliente cambió su contraseña.",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[mi-cuenta] POST (cambio de clave) falló:", e);
    return NextResponse.json({ ok: false, error: "No pudimos cambiar tu contraseña." }, { status: 500 });
  }
}
