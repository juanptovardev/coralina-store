import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { clientIp, rateLimit, RATE_LIMIT_ERROR, RATE_LIMIT_RETRY_AFTER } from "@/lib/rate-limit";
import { findUserByEmail, hashPassword } from "@/lib/users";
import { encodeRole } from "@/lib/session-sign";
import { validateRegistration, type RegisterInput } from "@/lib/validate-register";
import { recordAudit } from "@/lib/audit";

const DUPLICATE_ERROR = "Ya existe una cuenta con ese email.";

// ¿El fallo del insert es violación de UNIQUE sobre email (carrera entre el
// check previo y el insert)? pg classifies unique_violation como 23505.
function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "23505";
}

// Auto-registro público de clientes (T2): cualquier email crea cuenta con rol
// "cliente" y queda logueado (cookie coralina_role con los mismos atributos que
// /api/admin/session). Vive FUERA de /api/admin/* → no pasa por el gate del
// middleware; la protección aquí es rate-limit por IP + validación + unique.
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(ip)) {
    return NextResponse.json(
      { ok: false, error: RATE_LIMIT_ERROR },
      { status: 429, headers: { "Retry-After": RATE_LIMIT_RETRY_AFTER } },
    );
  }

  const parsed: unknown = await req.json().catch(() => null);
  const input = (typeof parsed === "object" && parsed !== null ? parsed : {}) as RegisterInput;
  const check = validateRegistration(input);
  if (!check.ok) {
    return NextResponse.json({ ok: false, error: check.error }, { status: 400 });
  }
  const { name, email, password } = check.data;

  try {
    if (await findUserByEmail(email)) {
      return NextResponse.json({ ok: false, error: DUPLICATE_ERROR }, { status: 409 });
    }
    const passwordHash = await hashPassword(password);
    await db.insert(users).values({ email, passwordHash, name, role: "cliente" });
  } catch (e) {
    // Email duplicado en carrera (unique) → mismo 409 que el check previo.
    if (isUniqueViolation(e)) {
      return NextResponse.json({ ok: false, error: DUPLICATE_ERROR }, { status: 409 });
    }
    // Nunca 500 con stack al fronp público.
    console.error("[register] alta de cuenta falló:", e);
    return NextResponse.json(
      { ok: false, error: "No pudimos crear la cuenta. Intenta de nuevo." },
      { status: 500 },
    );
  }

  // Auto-login: cookie firmada (HMAC en prod) con idénticos atributos que el
  // login del panel (session/route.ts POST).
  const store = await cookies();
  store.set("coralina_role", await encodeRole("cliente"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  // Auditoría best-effort (actor system): la cuenta ya está creada; un fallo de
  // DB de auditoría no debe convertir un registro exitoso en error visible.
  try {
    await recordAudit({
      actor: { name: email, role: "system" },
      module: "session",
      entityType: "user",
      entityId: email,
      action: "register",
      summary: `Nueva cuenta de cliente: ${email}.`,
    });
  } catch (e) {
    console.error("[register] auditoría de registro falló:", e);
  }
  return NextResponse.json({ ok: true, role: "cliente" });
}
