import { DomainError, normalizeEmail } from "@pawpost/core";
import { contacts, enrollments, suppressions, type EnrollmentStatus, type Executor, type SuppressionReason } from "@pawpost/db";
import { and, count, desc, eq, ilike, inArray } from "drizzle-orm";

import type { EngineContext } from "./context";
import { recordEvent } from "./events";
import { suppressionInput } from "./validation";

const STOP_STATUS: Record<SuppressionReason, EnrollmentStatus> = {
  unsubscribed: "unsubscribed",
  complained: "unsubscribed",
  bounced: "bounced",
  manual: "suppressed",
};

/**
 * Adds an address to the global do-not-contact list and stops every active
 * sequence for it, across all campaigns. Safe to call repeatedly.
 */
export async function suppressEmail(
  db: Executor,
  rawEmail: string,
  reason: SuppressionReason,
  note?: string,
): Promise<{ added: boolean }> {
  const email = normalizeEmail(rawEmail);
  const inserted = await db
    .insert(suppressions)
    .values({ email, reason, note })
    .onConflictDoNothing()
    .returning({ email: suppressions.email });

  const contactIds = db.select({ id: contacts.id }).from(contacts).where(eq(contacts.email, email));
  await db
    .update(enrollments)
    .set({ status: STOP_STATUS[reason] })
    .where(and(eq(enrollments.status, "active"), inArray(enrollments.contactId, contactIds)));

  return { added: inserted.length > 0 };
}

export function createSuppressionService(ctx: EngineContext) {
  const { db } = ctx;

  async function enrollmentByToken(token: string) {
    if (!/^[\w-]{16,128}$/.test(token)) return null;
    const [row] = await db
      .select({ enrollment: enrollments, email: contacts.email })
      .from(enrollments)
      .innerJoin(contacts, eq(contacts.id, enrollments.contactId))
      .where(eq(enrollments.unsubscribeToken, token))
      .limit(1);
    return row ?? null;
  }

  return {
    async list(options: { page?: number; pageSize?: number; search?: string } = {}) {
      const pageSize = Math.min(options.pageSize ?? 50, 200);
      const page = Math.max(options.page ?? 1, 1);
      const where = options.search?.trim() ? ilike(suppressions.email, `%${options.search.trim()}%`) : undefined;
      const [rows, [total]] = await Promise.all([
        db
          .select()
          .from(suppressions)
          .where(where)
          .orderBy(desc(suppressions.createdAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db.select({ n: count() }).from(suppressions).where(where),
      ]);
      return { rows, total: total?.n ?? 0, page, pageSize };
    },

    async add(raw: unknown): Promise<void> {
      const input = suppressionInput.parse(raw);
      await suppressEmail(db, input.email, "manual", input.note);
    },

    async remove(email: string): Promise<void> {
      const deleted = await db
        .delete(suppressions)
        .where(eq(suppressions.email, normalizeEmail(email)))
        .returning();
      if (!deleted.length) throw new DomainError("not_found", "That address is not on the suppression list.");
    },

    /** For the confirmation page. Returns a masked address, or null for an unknown token. */
    async lookupToken(token: string): Promise<{ maskedEmail: string; alreadyUnsubscribed: boolean } | null> {
      const row = await enrollmentByToken(token);
      if (!row) return null;
      const existing = await db.query.suppressions.findFirst({ where: eq(suppressions.email, row.email) });
      return { maskedEmail: maskEmail(row.email), alreadyUnsubscribed: Boolean(existing) };
    },

    /** Handles both the confirm button and RFC 8058 one-click POSTs. Idempotent. */
    async unsubscribeByToken(token: string, via: "link" | "one_click"): Promise<boolean> {
      const row = await enrollmentByToken(token);
      if (!row) return false;
      await db.transaction(async (tx) => {
        const { added } = await suppressEmail(tx, row.email, "unsubscribed", `via ${via}`);
        await tx.update(enrollments).set({ status: "unsubscribed" }).where(eq(enrollments.id, row.enrollment.id));
        if (added) {
          await recordEvent(tx, {
            type: "unsubscribe",
            campaignId: row.enrollment.campaignId,
            enrollmentId: row.enrollment.id,
            mailboxId: row.enrollment.mailboxId,
            email: row.email,
            detail: { via },
          });
        }
      });
      ctx.logger.info("unsubscribed", { enrollmentId: row.enrollment.id, via });
      return true;
    },
  };
}

export type SuppressionService = ReturnType<typeof createSuppressionService>;

function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"•".repeat(Math.max(local.length - visible.length, 1))}@${domain}`;
}
