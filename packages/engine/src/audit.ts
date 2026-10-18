import { toCsv } from "@pawpost/core";
import { auditLog, type AuditEntry, type Executor } from "@pawpost/db";
import { and, count, desc, eq, gte, like, lte, type SQL } from "drizzle-orm";

import type { Actor, EngineContext } from "./context";
import { requirePermission } from "./guard";

export interface AuditInput {
  /** Dotted verb, e.g. "campaign.started". */
  action: string;
  /** One readable sentence, shown in the log. */
  summary: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditFilters {
  actorId?: string;
  /** Matches the action or its prefix, e.g. "campaign" or "user.invited". */
  action?: string;
  from?: Date;
  to?: Date;
}

/** Writes one audit entry. Accepts a transaction so the entry commits with the change it describes. */
export async function writeAudit(db: Executor, actor: Actor | null, entry: AuditInput): Promise<void> {
  await db.insert(auditLog).values({
    actorId: actor?.id ?? null,
    actorEmail: actor?.email ?? null,
    action: entry.action,
    summary: entry.summary,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId ?? null,
    metadata: entry.metadata ?? {},
    ipAddress: actor?.ip ?? null,
  });
}

export function createAuditService(ctx: EngineContext) {
  const { db } = ctx;

  const where = (filters: AuditFilters): SQL | undefined =>
    and(
      filters.actorId ? eq(auditLog.actorId, filters.actorId) : undefined,
      filters.action ? like(auditLog.action, `${filters.action.replace(/[%_]/g, "")}%`) : undefined,
      filters.from ? gte(auditLog.createdAt, filters.from) : undefined,
      filters.to ? lte(auditLog.createdAt, filters.to) : undefined,
    );

  return {
    record(actor: Actor | null, entry: AuditInput): Promise<void> {
      return writeAudit(db, actor, entry);
    },

    async list(filters: AuditFilters & { page?: number; pageSize?: number } = {}) {
      const pageSize = Math.min(filters.pageSize ?? 50, 200);
      const page = Math.max(filters.page ?? 1, 1);
      const [rows, [total]] = await Promise.all([
        db
          .select()
          .from(auditLog)
          .where(where(filters))
          .orderBy(desc(auditLog.id))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db.select({ n: count() }).from(auditLog).where(where(filters)),
      ]);
      return { rows, total: total?.n ?? 0, page, pageSize };
    },

    /** Download for admins; the export itself is recorded too. */
    async exportFor(actor: Actor, filters: AuditFilters = {}): Promise<{ filename: string; csv: string }> {
      requirePermission(actor, "audit.view");
      const csv = await this.exportCsv(filters);
      await writeAudit(db, actor, { action: "audit.exported", summary: `${actor.email} exported the audit log` });
      return { filename: `audit-log-${ctx.now().toISOString().slice(0, 10)}.csv`, csv };
    },

    async exportCsv(filters: AuditFilters = {}): Promise<string> {
      const rows: AuditEntry[] = await db.select().from(auditLog).where(where(filters)).orderBy(desc(auditLog.id)).limit(100_000);
      return toCsv(rows, [
        { header: "Time (UTC)", value: (r) => r.createdAt },
        { header: "User", value: (r) => r.actorEmail ?? "system" },
        { header: "Action", value: (r) => r.action },
        { header: "Summary", value: (r) => r.summary },
        { header: "Entity type", value: (r) => r.entityType },
        { header: "Entity ID", value: (r) => r.entityId },
        { header: "IP address", value: (r) => r.ipAddress },
      ]);
    },
  };
}

export type AuditService = ReturnType<typeof createAuditService>;
