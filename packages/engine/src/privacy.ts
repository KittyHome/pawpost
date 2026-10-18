/**
 * Right-to-erasure requests: removes a person from every list, campaign and
 * activity record. The address itself stays on the suppression list, which is
 * the minimum needed to honour "never contact me again".
 */
import { DomainError, isValidEmail, normalizeEmail } from "@pawpost/core";
import { campaigns, contactLists, contacts, enrollments, events, messages, suppressions } from "@pawpost/db";
import { count, eq, inArray } from "drizzle-orm";

import { writeAudit } from "./audit";
import type { Actor, EngineContext } from "./context";
import { requirePermission } from "./guard";
import { suppressEmail } from "./suppressions";

export interface ErasePreview {
  email: string;
  lists: string[];
  campaigns: string[];
  messages: number;
  suppressed: boolean;
}

export function createPrivacyService(ctx: EngineContext) {
  const { db } = ctx;

  function parseEmail(raw: unknown): string {
    const email = normalizeEmail(String(raw ?? ""));
    if (!isValidEmail(email)) throw new DomainError("validation", "Enter a valid email address.");
    return email;
  }

  return {
    /** What erasing this address would remove, shown before confirming. */
    async preview(actor: Actor, raw: unknown): Promise<ErasePreview> {
      requirePermission(actor, "data.erase");
      const email = parseEmail(raw);
      const [listRows, campaignRows, [messageCount], suppression] = await Promise.all([
        db
          .selectDistinct({ name: contactLists.name })
          .from(contacts)
          .innerJoin(contactLists, eq(contactLists.id, contacts.listId))
          .where(eq(contacts.email, email)),
        db
          .selectDistinct({ name: campaigns.name })
          .from(enrollments)
          .innerJoin(contacts, eq(contacts.id, enrollments.contactId))
          .innerJoin(campaigns, eq(campaigns.id, enrollments.campaignId))
          .where(eq(contacts.email, email)),
        db.select({ n: count() }).from(messages).where(eq(messages.toEmail, email)),
        db.query.suppressions.findFirst({ where: eq(suppressions.email, email) }),
      ]);
      return {
        email,
        lists: listRows.map((r) => r.name),
        campaigns: campaignRows.map((r) => r.name),
        messages: messageCount?.n ?? 0,
        suppressed: Boolean(suppression),
      };
    },

    async erase(actor: Actor, raw: unknown): Promise<{ contacts: number; messages: number; events: number }> {
      requirePermission(actor, "data.erase");
      const email = parseEmail(raw);
      const result = await db.transaction(async (tx) => {
        const contactIds = (await tx.select({ id: contacts.id }).from(contacts).where(eq(contacts.email, email))).map(
          (r) => r.id,
        );
        const enrollmentIds = contactIds.length
          ? (await tx.select({ id: enrollments.id }).from(enrollments).where(inArray(enrollments.contactId, contactIds))).map(
              (r) => r.id,
            )
          : [];

        const deletedMessages = await tx.delete(messages).where(eq(messages.toEmail, email)).returning({ id: messages.id });
        const deletedEvents = await tx.delete(events).where(eq(events.email, email)).returning({ id: events.id });
        if (enrollmentIds.length) await tx.delete(events).where(inArray(events.enrollmentId, enrollmentIds));
        // Deleting contacts cascades to their enrollments.
        const deletedContacts = contactIds.length
          ? await tx.delete(contacts).where(inArray(contacts.id, contactIds)).returning({ id: contacts.id })
          : [];

        await suppressEmail(tx, email, "manual", "erased on request");
        await writeAudit(tx, actor, {
          action: "contact.erased",
          summary: `${actor.email} erased all data for ${maskEmail(email)} (kept on the suppression list)`,
          entityType: "suppression",
          metadata: { contacts: deletedContacts.length, messages: deletedMessages.length, events: deletedEvents.length },
        });
        return { contacts: deletedContacts.length, messages: deletedMessages.length, events: deletedEvents.length };
      });
      ctx.logger.info("person erased", result);
      return result;
    },
  };
}

export type PrivacyService = ReturnType<typeof createPrivacyService>;

function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 2)}${"•".repeat(Math.max(local.length - 2, 1))}@${domain}`;
}
