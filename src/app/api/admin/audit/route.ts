import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLog, auditPurges } from "@/db/schema";
import { and, desc, eq, gte, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import { recordAudit } from "@/lib/audit";
import { passwordMatches } from "@/lib/admin-auth";
import { getActor } from "@/lib/session";
import { ensureSeeded } from "@/lib/seed";

function buildFilters(params: URLSearchParams): SQL | undefined {
  const conds: SQL[] = [];
  const role = params.get("role");
  const mod = params.get("module");
  const action = params.get("action");
  const q = (params.get("q") ?? "").trim();
  const from = params.get("from");
  const to = params.get("to");

  if (role && role !== "all") conds.push(eq(auditLog.actorRole, role as "admin" | "asesor" | "system"));
  if (mod && mod !== "all") conds.push(eq(auditLog.module, mod));
  if (action && action !== "all") conds.push(eq(auditLog.action, action));
  if (from) conds.push(gte(auditLog.createdAt, new Date(from)));
  if (to) conds.push(lt(auditLog.createdAt, new Date(new Date(to).getTime() + 86400000)));
  if (q) {
    const like = or(
      ilike(auditLog.summary, `%${q}%`),
      ilike(auditLog.entityId, `%${q}%`),
      ilike(auditLog.actorName, `%${q}%`),
    );
    if (like) conds.push(like);
  }
  return conds.length ? and(...conds) : undefined;
}

/** Escapa una celda CSV: neutraliza fórmulas (=, +, -, @) y entrecomilla. */
function cell(v: unknown): string {
  const s = String(v ?? "");
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * ?page= (1-based) + ?pageSize= con tope duro: acota el payload sin romper
 * clientes que no envían los parámetros (devuelven la primera página completa).
 */
function pageParams(sp: URLSearchParams, defaultSize: number) {
  const p = Number(sp.get("page"));
  const s = Number(sp.get("pageSize"));
  const page = Number.isInteger(p) && p >= 1 ? p : 1;
  const pageSize = Math.min(200, Number.isInteger(s) && s >= 1 ? s : defaultSize);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

/** Tope del export CSV: streaming-safe (ignora paginación). */
const CSV_EXPORT_LIMIT = 5000;

export async function GET(req: Request) {
  await ensureSeeded();
  const { searchParams } = new URL(req.url);
  const where = buildFilters(searchParams);

  if (searchParams.get("format") === "csv") {
    // Export completo (sin paginación): el CSV es un volcado, no un listado de UI.
    const rows = await db
      .select()
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.createdAt))
      .limit(CSV_EXPORT_LIMIT);
    const header = "fecha,actor,rol,modulo,entidad,entidad_id,accion,campo,resumen";
    const body = rows
      .map((r) =>
        [
          r.createdAt.toISOString(),
          r.actorName,
          r.actorRole,
          r.module,
          r.entityType,
          r.entityId,
          r.action,
          r.fieldChanged,
          r.summary,
        ]
          .map(cell)
          .join(","),
      )
      .join("\n");
    return new NextResponse(`${header}\n${body}`, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="coralina-auditoria.csv"`,
      },
    });
  }

  const { page, pageSize, offset } = pageParams(searchParams, 200);
  const [{ n: total }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(auditLog)
    .where(where);
  const rows = await db
    .select()
    .from(auditLog)
    .where(where)
    .orderBy(desc(auditLog.createdAt))
    .limit(pageSize)
    .offset(offset);

  const purges = await db.select().from(auditPurges).orderBy(desc(auditPurges.createdAt));
  return NextResponse.json({ entries: rows, purges, page, pageSize, total });
}

export async function POST(req: Request) {
  const actor = await getActor();
  const body = await req.json();

  if (body.action === "purge_month") {
    if (!actor.canPurgeAudit) {
      return NextResponse.json({ ok: false, error: "Solo un Admin puede purgar la bitácora." }, { status: 403 });
    }
    const month = String(body.month ?? ""); // formato YYYY-MM
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return NextResponse.json(
        { ok: false, error: "Solo se permite purgar un mes calendario completo (YYYY-MM)." },
        { status: 400 },
      );
    }
    if (String(body.confirmText ?? "").trim() !== month) {
      return NextResponse.json({ ok: false, error: "El mes escrito no coincide." }, { status: 400 });
    }
    if (!passwordMatches(body.password)) {
      return NextResponse.json({ ok: false, error: "Reautenticación fallida." }, { status: 401 });
    }

    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    const deleted = await db
      .delete(auditLog)
      .where(and(gte(auditLog.createdAt, start), lt(auditLog.createdAt, end)))
      .returning({ id: auditLog.id });

    await db.insert(auditPurges).values({
      month,
      deletedCount: deleted.length,
      actorName: actor.name,
    });
    await recordAudit({
      actor,
      module: "auditoria",
      entityType: "audit_log",
      entityId: month,
      action: "purge_audit",
      summary: `${actor.name} purgó ${deleted.length} registros del mes ${month}. El registro de purga es inmutable.`,
    });
    return NextResponse.json({ ok: true, deleted: deleted.length });
  }

  return NextResponse.json({ ok: false, error: "Acción desconocida." }, { status: 400 });
}
