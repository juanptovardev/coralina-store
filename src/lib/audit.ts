import { db } from "@/db";
import { auditLog } from "@/db/schema";
import type { Actor } from "./session";

export type AuditInput = {
  actor: Actor | { name: string; role: "admin" | "asesor" | "system" };
  module: string;
  entityType: string;
  entityId?: string | number;
  action:
    | "create"
    | "update"
    | "delete_soft"
    | "delete_hard"
    | "status_change"
    | "publish"
    | "purge_audit"
    | "login"
    | "logout";
  fieldChanged?: string;
  oldValue?: unknown;
  newValue?: unknown;
  summary: string;
};

/** Cliente de ejecución: el pool global (db) o la transacción en curso (tx). */
type AuditClient = Pick<typeof db, "insert">;

export async function recordAudit(input: AuditInput, client?: AuditClient): Promise<void> {
  await (client ?? db).insert(auditLog).values({
    actorName: input.actor.name,
    actorRole: input.actor.role,
    module: input.module,
    entityType: input.entityType,
    entityId: String(input.entityId ?? ""),
    action: input.action,
    fieldChanged: input.fieldChanged ?? "",
    oldValue: (input.oldValue ?? null) as never,
    newValue: (input.newValue ?? null) as never,
    summary: input.summary,
  });
}
