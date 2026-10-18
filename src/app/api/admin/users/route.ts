import { NextResponse } from "next/server";
import { db } from "@/db";
import { customers, orders, users } from "@/db/schema";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getActor } from "@/lib/session";
import { getSessionEmail } from "@/lib/session-role";
import { recordAudit } from "@/lib/audit";
import { findUserByEmail, hashPassword } from "@/lib/users";
import {
  generateTemporaryPassword,
  validateCreateUser,
  validateUpdateUser,
} from "@/lib/validate-user-admin";

const DUPLICATE_ERROR = "Ya existe una cuenta con ese email.";
const NOT_ADMIN_ERROR = "Tu rol no permite gestionar usuarios.";
const LAST_ADMIN_ERROR = "Debe quedar al menos un administrador activo.";

/** Email duplicado en carrera (unique_violation 23505), mismo 409 que el check previo. */
function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "23505";
}

// GET /api/admin/users?q=  → lista de cuentas + datos de envío (por email) + nº pedidos.
// El gate de rol admin|asesor vive en el middleware (deny-by-default /api/admin/*).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  // admin primero, luego asesor, luego cliente; y dentro de cada rol, alta desc.
  const roleOrder = sql`case ${users.role} when 'admin' then 0 when 'asesor' then 1 else 2 end`;
  const where = q
    ? or(ilike(users.email, `%${q}%`), ilike(users.name, `%${q}%`))
    : undefined;

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      active: users.active,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      phone: customers.phone,
      city: customers.city,
      address: customers.address,
      orderCount: sql<number>`count(distinct ${orders.id})::int`,
    })
    .from(users)
    // Envío y pedidos se derivan del cliente con el MISMO email (left join: tolerante si no existe).
    .leftJoin(customers, eq(customers.email, users.email))
    .leftJoin(orders, eq(orders.customerId, customers.id))
    .where(where)
    .groupBy(users.id, customers.id)
    .orderBy(roleOrder, desc(users.createdAt));

  return NextResponse.json({ users: rows });
}

export async function POST(req: Request) {
  const actor = await getActor();
  // getActor() ya restringe a admin|asesor (middleware); la gestión de usuarios es SOLO admin.
  if (actor.role !== "admin") {
    return NextResponse.json({ ok: false, error: NOT_ADMIN_ERROR }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const action = typeof body?.action === "string" ? body.action : "";
  // Email del actor (cookie firmada) para los guards de "a mí mismo".
  const actorEmail = await getSessionEmail();

  switch (action) {
    case "create":
      return createUser(body ?? {}, actor);
    case "update":
      return updateUser(body ?? {}, actor, actorEmail);
    case "reset_password":
      return resetPassword(body ?? {}, actor);
    case "set_active":
      return setActive(body ?? {}, actor, actorEmail);
    case "delete":
      return deleteUser(body ?? {}, actor, actorEmail);
    default:
      return NextResponse.json({ ok: false, error: `Acción desconocida: ${action}` }, { status: 400 });
  }
}

type Actor = Awaited<ReturnType<typeof getActor>>;

async function createUser(body: Record<string, unknown>, actor: Actor) {
  const check = validateCreateUser(body);
  if (!check.ok) return NextResponse.json({ ok: false, error: check.error }, { status: 400 });
  const { email, name, role, password } = check.data;

  if (await findUserByEmail(email)) {
    return NextResponse.json({ ok: false, error: DUPLICATE_ERROR }, { status: 409 });
  }
  const generated = password ? undefined : generateTemporaryPassword();
  const passwordHash = await hashPassword(password ?? generated!);

  let id: number;
  try {
    const [row] = await db
      .insert(users)
      .values({ email, name, role, passwordHash })
      .returning({ id: users.id });
    id = row.id;
  } catch (e) {
    if (isUniqueViolation(e)) {
      return NextResponse.json({ ok: false, error: DUPLICATE_ERROR }, { status: 409 });
    }
    console.error("[admin/users] alta falló:", e);
    return NextResponse.json(
      { ok: false, error: "No pudimos crear la cuenta. Intenta de nuevo." },
      { status: 500 },
    );
  }

  await recordAudit({
    actor,
    module: "usuarios",
    entityType: "user",
    entityId: id,
    action: "create",
    newValue: { email, name, role },
    summary: `${actor.name} creó la cuenta ${email} con rol ${role}.`,
  });

  return NextResponse.json({ ok: true, id, ...(generated ? { passwordGenerada: generated } : {}) });
}

async function updateUser(body: Record<string, unknown>, actor: Actor, actorEmail: string | null) {
  const check = validateUpdateUser(body);
  if (!check.ok) return NextResponse.json({ ok: false, error: check.error }, { status: 400 });

  const id = Number(body.id);
  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) return NextResponse.json({ ok: false, error: "Usuario no encontrado." }, { status: 404 });

  const nextName = check.data.name ?? target.name;
  const nextRole = check.data.role ?? target.role;

  // Guard: el actor no puede quitarse a sí mismo el rol admin.
  if (actorEmail && target.email === actorEmail && nextRole !== "admin") {
    return NextResponse.json(
      { ok: false, error: "No puedes quitarte a ti mismo el rol de administrador." },
      { status: 400 },
    );
  }
  // Guard: no dejar el sistema sin ningún admin activo.
  if (target.role === "admin" && nextRole !== "admin" && target.active) {
    if ((await activeAdminCount()) <= 1) {
      return NextResponse.json({ ok: false, error: LAST_ADMIN_ERROR }, { status: 400 });
    }
  }

  await db.update(users).set({ name: nextName, role: nextRole }).where(eq(users.id, id));
  await recordAudit({
    actor,
    module: "usuarios",
    entityType: "user",
    entityId: id,
    action: "update",
    fieldChanged: "name,role",
    oldValue: { name: target.name, role: target.role },
    newValue: { name: nextName, role: nextRole },
    summary: `${actor.name} actualizó la cuenta ${target.email}.`,
  });
  return NextResponse.json({ ok: true });
}

async function resetPassword(body: Record<string, unknown>, actor: Actor) {
  const id = Number(body.id);
  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) return NextResponse.json({ ok: false, error: "Usuario no encontrado." }, { status: 404 });

  const password = generateTemporaryPassword();
  const passwordHash = await hashPassword(password);
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));

  await recordAudit({
    actor,
    module: "usuarios",
    entityType: "user",
    entityId: id,
    action: "update",
    fieldChanged: "password_hash",
    summary: `${actor.name} restableció la contraseña de ${target.email}.`,
  });
  return NextResponse.json({ ok: true, password });
}

async function setActive(body: Record<string, unknown>, actor: Actor, actorEmail: string | null) {
  const id = Number(body.id);
  const active = Boolean(body.active);
  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) return NextResponse.json({ ok: false, error: "Usuario no encontrado." }, { status: 404 });

  // Guard: el actor no puede desactivarse a sí mismo.
  if (actorEmail && target.email === actorEmail && !active) {
    return NextResponse.json(
      { ok: false, error: "No puedes desactivar tu propia cuenta." },
      { status: 400 },
    );
  }
  if (!active && target.role === "admin" && target.active) {
    if ((await activeAdminCount()) <= 1) {
      return NextResponse.json({ ok: false, error: LAST_ADMIN_ERROR }, { status: 400 });
    }
  }

  await db.update(users).set({ active }).where(eq(users.id, id));
  await recordAudit({
    actor,
    module: "usuarios",
    entityType: "user",
    entityId: id,
    action: "status_change",
    fieldChanged: "active",
    oldValue: target.active,
    newValue: active,
    summary: `${actor.name} ${active ? "activó" : "desactivó"} la cuenta ${target.email}.`,
  });
  return NextResponse.json({ ok: true });
}

async function deleteUser(body: Record<string, unknown>, actor: Actor, actorEmail: string | null) {
  const id = Number(body.id);
  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) return NextResponse.json({ ok: false, error: "Usuario no encontrado." }, { status: 404 });

  // Guard: el actor no puede borrarse a sí mismo.
  if (actorEmail && target.email === actorEmail) {
    return NextResponse.json(
      { ok: false, error: "No puedes eliminar tu propia cuenta." },
      { status: 400 },
    );
  }
  // Guard: no borrar el último admin activo.
  if (target.role === "admin" && target.active) {
    if ((await activeAdminCount()) <= 1) {
      return NextResponse.json(
        { ok: false, error: "No puedes eliminar al último administrador activo." },
        { status: 400 },
      );
    }
  }
  // Guard: si el email tiene pedidos, no se borra (se desactiva).
  const [{ cnt }] = await db
    .select({ cnt: sql<number>`count(*)::int` })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .where(eq(customers.email, target.email));
  if (cnt > 0) {
    return NextResponse.json(
      { ok: false, error: "Tiene pedidos asociados: desactívalo en lugar de borrarlo." },
      { status: 409 },
    );
  }

  await db.delete(users).where(eq(users.id, id));
  await recordAudit({
    actor,
    module: "usuarios",
    entityType: "user",
    entityId: id,
    action: "delete_hard",
    oldValue: { email: target.email, name: target.name, role: target.role },
    summary: `${actor.name} eliminó la cuenta ${target.email}.`,
  });
  return NextResponse.json({ ok: true });
}

async function activeAdminCount(): Promise<number> {
  const [{ cnt }] = await db
    .select({ cnt: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.active, true)));
  return cnt;
}
