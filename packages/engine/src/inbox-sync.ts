/**
 * Inbox sync: reads new mail in each sender's INBOX and turns it into outcomes.
 *
 *   bounce (5.x.x)  → message bounced, sequence stopped, address suppressed
 *   auto-reply      → logged only; the sequence continues
 *   human reply     → sequence stopped (if the campaign stops on reply), intent
 *                     classified by AI when enabled; opt-out requests are suppressed
 *
 * Each message is processed and the IMAP cursor advanced in one transaction, so a
 * crash never double-counts a reply or skips one.
 */
import { isOptOutReply, normalizeEmail } from "@pawpost/core";
import { campaigns, enrollments, mailboxes, messages, type Executor, type Mailbox, type Message } from "@pawpost/db";
import { classifyInbound, type InboundMessage } from "@pawpost/mail";
import { and, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";

import type { AiService } from "./ai";
import type { EngineContext } from "./context";
import { recordEvent } from "./events";
import type { MailboxService } from "./mailboxes";
import { suppressEmail } from "./suppressions";

export interface InboxSyncSummary {
  mailboxes: number;
  processed: number;
  replies: number;
  bounces: number;
  errors: number;
}

const DEFAULT_SYNC_INTERVAL_MS = 2 * 60 * 1000;
const STOPPABLE = ["active", "sending", "completed"] as const;

export function createInboxSync(ctx: EngineContext, mailboxService: MailboxService, ai: AiService) {
  const { db, logger } = ctx;

  async function findOriginal(tx: Executor, mailbox: Mailbox, ids: string[], fallbackEmails: string[]): Promise<Message | null> {
    if (ids.length) {
      const [byId] = await tx
        .select()
        .from(messages)
        .where(inArray(messages.rfcMessageId, ids))
        .orderBy(desc(messages.sentAt))
        .limit(1);
      if (byId) return byId;
    }
    // Some clients drop In-Reply-To; fall back to the latest email we sent that address from this mailbox.
    if (fallbackEmails.length) {
      const [byAddress] = await tx
        .select()
        .from(messages)
        .where(and(eq(messages.mailboxId, mailbox.id), inArray(messages.toEmail, fallbackEmails)))
        .orderBy(desc(messages.sentAt))
        .limit(1);
      if (byAddress) return byAddress;
    }
    return null;
  }

  async function processMessage(mailbox: Mailbox, inbound: InboundMessage): Promise<"reply" | "bounce" | "ignored"> {
    const classification = classifyInbound(inbound);

    // AI runs outside the transaction: it's slow and must not hold row locks.
    let triage = null;
    if (classification.kind === "reply") {
      const original = await findOriginal(db, mailbox, classification.referencedMessageIds, inbound.from ? [inbound.from] : []);
      if (original) triage = await ai.classifyReply({ originalSubject: original.subject, text: inbound.text });
    }

    return db.transaction(async (tx) => {
      let outcome: "reply" | "bounce" | "ignored" = "ignored";

      if (classification.kind === "bounce") {
        if (classification.permanent) {
          const original = await findOriginal(tx, mailbox, classification.referencedMessageIds, classification.recipients);
          if (original) {
            await tx.update(messages).set({ status: "bounced" }).where(eq(messages.id, original.id));
            await tx
              .update(enrollments)
              .set({ status: "bounced" })
              .where(and(eq(enrollments.id, original.enrollmentId), inArray(enrollments.status, [...STOPPABLE])));
            await suppressEmail(tx, original.toEmail, "bounced", inbound.subject.slice(0, 200));
            await recordEvent(tx, {
              type: "bounce",
              campaignId: original.campaignId,
              enrollmentId: original.enrollmentId,
              mailboxId: mailbox.id,
              email: original.toEmail,
              detail: { stage: "dsn", subject: inbound.subject },
            });
            outcome = "bounce";
          }
        }
      } else {
        const original = await findOriginal(tx, mailbox, classification.referencedMessageIds, inbound.from ? [inbound.from] : []);
        if (original) {
          const base = {
            campaignId: original.campaignId,
            enrollmentId: original.enrollmentId,
            mailboxId: mailbox.id,
            email: original.toEmail,
          };
          const snippet = inbound.text.replace(/\s+/g, " ").trim().slice(0, 280);

          if (classification.kind === "auto_reply" || triage?.intent === "out_of_office") {
            await recordEvent(tx, { type: "auto_reply", ...base, detail: { subject: inbound.subject } });
          } else {
            const campaign = await tx.query.campaigns.findFirst({ where: eq(campaigns.id, original.campaignId) });
            if (campaign?.stopOnReply !== false) {
              await tx
                .update(enrollments)
                .set({ status: "replied" })
                .where(and(eq(enrollments.id, original.enrollmentId), inArray(enrollments.status, [...STOPPABLE])));
            }
            await recordEvent(tx, {
              type: "reply",
              ...base,
              detail: {
                subject: inbound.subject,
                snippet,
                from: inbound.from,
                intent: triage?.intent ?? null,
                summary: triage?.summary ?? null,
              },
            });

            const wantsOut = triage ? triage.intent === "unsubscribe" : isOptOutReply(inbound.text);
            if (wantsOut) {
              const { added } = await suppressEmail(tx, original.toEmail, "unsubscribed", "asked by reply");
              await tx.update(enrollments).set({ status: "unsubscribed" }).where(eq(enrollments.id, original.enrollmentId));
              if (added) await recordEvent(tx, { type: "unsubscribe", ...base, detail: { via: "reply" } });
            }
            outcome = "reply";
          }
        }
      }

      await tx.update(mailboxes).set({ imapLastUid: inbound.uid }).where(eq(mailboxes.id, mailbox.id));
      return outcome;
    });
  }

  async function syncMailbox(mailbox: Mailbox, summary: InboxSyncSummary): Promise<void> {
    const log = logger.child({ mailboxId: mailbox.id });
    const cursor =
      mailbox.imapUidValidity !== null && mailbox.imapLastUid !== null
        ? { uidValidity: mailbox.imapUidValidity, lastUid: mailbox.imapLastUid }
        : null;

    const result = await ctx.inbox.fetchNew(mailboxService.credentials(mailbox).imap, cursor);
    if (result.reset) {
      await db
        .update(mailboxes)
        .set({
          imapUidValidity: result.cursor.uidValidity,
          imapLastUid: result.cursor.lastUid,
          lastSyncedAt: ctx.now(),
          ...(mailbox.lastError?.startsWith("IMAP:") ? { lastError: null } : {}),
        })
        .where(eq(mailboxes.id, mailbox.id));
      log.info("inbox cursor initialised", { lastUid: result.cursor.lastUid });
      return;
    }

    for (const inbound of result.messages) {
      try {
        const outcome = await processMessage(mailbox, { ...inbound, from: inbound.from ? normalizeEmail(inbound.from) : null });
        summary.processed += 1;
        if (outcome === "reply") summary.replies += 1;
        if (outcome === "bounce") summary.bounces += 1;
      } catch (error) {
        // Skip a message we can't process rather than stalling this inbox forever.
        summary.errors += 1;
        log.error("inbound message skipped", { uid: inbound.uid, error });
        await db.update(mailboxes).set({ imapLastUid: inbound.uid }).where(eq(mailboxes.id, mailbox.id));
      }
    }
    await db
      .update(mailboxes)
      .set({
        imapLastUid: result.cursor.lastUid,
        lastSyncedAt: ctx.now(),
        // A successful sync clears an earlier IMAP failure (SMTP errors are left alone).
        ...(mailbox.lastError?.startsWith("IMAP:") ? { lastError: null } : {}),
      })
      .where(eq(mailboxes.id, mailbox.id));
  }

  return async function runInboxSyncCycle(options: { intervalMs?: number } = {}): Promise<InboxSyncSummary> {
    const due = new Date(ctx.now().getTime() - (options.intervalMs ?? DEFAULT_SYNC_INTERVAL_MS));
    // Error-state mailboxes are still read: their SMTP may be broken while replies keep arriving.
    const rows = await db
      .select()
      .from(mailboxes)
      .where(or(isNull(mailboxes.lastSyncedAt), lt(mailboxes.lastSyncedAt, due)));
    const summary: InboxSyncSummary = { mailboxes: rows.length, processed: 0, replies: 0, bounces: 0, errors: 0 };

    for (const mailbox of rows) {
      try {
        await syncMailbox(mailbox, summary);
      } catch (error) {
        summary.errors += 1;
        const message = error instanceof Error ? error.message : String(error);
        logger.warn("inbox sync failed", { mailboxId: mailbox.id, error: message });
        await db
          .update(mailboxes)
          .set({ lastError: `IMAP: ${message}`.slice(0, 500), lastSyncedAt: ctx.now() })
          .where(eq(mailboxes.id, mailbox.id));
      }
    }
    return summary;
  };
}
