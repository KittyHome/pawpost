/**
 * The dispatcher: decides what to send, claims it, sends it, records the result.
 *
 * Guarantees
 *  - At most once: an enrollment is claimed ("sending") in a row-locked transaction
 *    before SMTP. A crash mid-send leaves it "sending"; it is later marked failed,
 *    never re-sent. Duplicate cold emails are worse than a missed one.
 *  - Safe with several worker processes: claims use FOR UPDATE SKIP LOCKED, and a
 *    mailbox's send slot (next_send_at) is advanced atomically in the same transaction.
 *  - Polite pacing: per-mailbox rolling 24h cap, minimum gap plus jitter, one email
 *    per mailbox per cycle, and only inside each campaign's send window.
 */
import {
  buildTemplateContext,
  composeEmail,
  evaluateCampaignHealth,
  followUpDueAt,
  isDomainError,
  isWithinSendWindow,
  nextSendGapMs,
} from "@pawpost/core";
import {
  campaignMailboxes,
  campaigns,
  campaignSteps,
  contacts,
  enrollments,
  mailboxes,
  messages,
  type Campaign,
  type Mailbox,
} from "@pawpost/db";
import { generateMessageId, SmtpSendError } from "@pawpost/mail";
import { and, asc, count, eq, gt, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";

import type { EngineContext } from "./context";
import { recordEvent } from "./events";
import type { MailboxService } from "./mailboxes";
import { campaignStats, toHealthCounters } from "./stats";
import { suppressEmail } from "./suppressions";

export interface DispatchSummary {
  sent: number;
  failed: number;
  bounced: number;
  deferred: number;
  recoveredStale: number;
  pausedCampaigns: string[];
  completedCampaigns: string[];
}

type Outcome = "sent" | "failed" | "bounced" | "deferred" | "idle";

const STALE_CLAIM_MS = 10 * 60 * 1000;
const NOT_SENT_BACKOFF_MS = 5 * 60 * 1000;
const MAILBOX_CONCURRENCY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export function createDispatcher(ctx: EngineContext, mailboxService: MailboxService) {
  const { db, logger } = ctx;

  async function recoverStaleClaims(now: Date): Promise<number> {
    const stale = await db
      .update(enrollments)
      .set({
        status: "failed",
        claimedAt: null,
        lastError: "Interrupted while sending. Not retried, because the email may already have gone out.",
      })
      .where(and(eq(enrollments.status, "sending"), lt(enrollments.claimedAt, new Date(now.getTime() - STALE_CLAIM_MS))))
      .returning({ id: enrollments.id, campaignId: enrollments.campaignId, mailboxId: enrollments.mailboxId });
    for (const e of stale) {
      await recordEvent(db, {
        type: "send_failed",
        campaignId: e.campaignId,
        enrollmentId: e.id,
        mailboxId: e.mailboxId,
        detail: { reason: "interrupted" },
      });
    }
    if (stale.length) logger.warn("recovered stale claims", { count: stale.length });
    return stale.length;
  }

  /** Pauses unhealthy campaigns and completes finished ones. Returns those still running. */
  async function reviewActiveCampaigns(summary: DispatchSummary): Promise<Campaign[]> {
    const active = await db.select().from(campaigns).where(eq(campaigns.status, "active"));
    const stats = await campaignStats(
      db,
      active.map((c) => c.id),
    );
    const running: Campaign[] = [];

    for (const campaign of active) {
      const s = stats.get(campaign.id)!;
      const verdict = evaluateCampaignHealth(toHealthCounters(s));
      if (!verdict.ok) {
        await db.update(campaigns).set({ status: "paused", pauseReason: verdict.reason }).where(eq(campaigns.id, campaign.id));
        await recordEvent(db, {
          type: "campaign_paused",
          campaignId: campaign.id,
          detail: { reason: verdict.reason, automatic: true },
        });
        logger.warn("campaign auto-paused", { campaignId: campaign.id, reason: verdict.reason });
        summary.pausedCampaigns.push(campaign.id);
        continue;
      }
      if (s.byStatus.active + s.byStatus.sending === 0) {
        await db.update(campaigns).set({ status: "completed", completedAt: ctx.now() }).where(eq(campaigns.id, campaign.id));
        await recordEvent(db, { type: "campaign_completed", campaignId: campaign.id, detail: { emailsSent: s.emailsSent } });
        summary.completedCampaigns.push(campaign.id);
        continue;
      }
      running.push(campaign);
    }
    return running;
  }

  async function eligibleMailboxes(campaignIds: string[], now: Date) {
    const rows = await db
      .select({ mailbox: mailboxes, campaignId: campaignMailboxes.campaignId })
      .from(campaignMailboxes)
      .innerJoin(mailboxes, eq(mailboxes.id, campaignMailboxes.mailboxId))
      .where(
        and(
          inArray(campaignMailboxes.campaignId, campaignIds),
          eq(mailboxes.status, "active"),
          or(isNull(mailboxes.nextSendAt), lte(mailboxes.nextSendAt, now)),
        ),
      );
    const byMailbox = new Map<string, { mailbox: Mailbox; campaignIds: string[] }>();
    for (const row of rows) {
      const entry = byMailbox.get(row.mailbox.id) ?? { mailbox: row.mailbox, campaignIds: [] };
      entry.campaignIds.push(row.campaignId);
      byMailbox.set(row.mailbox.id, entry);
    }
    if (!byMailbox.size) return [];

    const sent = await db
      .select({ mailboxId: messages.mailboxId, n: count() })
      .from(messages)
      .where(and(inArray(messages.mailboxId, [...byMailbox.keys()]), gt(messages.sentAt, new Date(now.getTime() - DAY_MS))))
      .groupBy(messages.mailboxId);
    const sentById = new Map(sent.map((s) => [s.mailboxId, s.n]));
    return [...byMailbox.values()].filter(({ mailbox }) => (sentById.get(mailbox.id) ?? 0) < mailbox.dailyLimit);
  }

  /** Atomically picks the next due contact for this mailbox and reserves the mailbox's send slot. */
  async function claim(mailbox: Mailbox, campaignIds: string[], now: Date) {
    return db.transaction(async (tx) => {
      const [candidate] = await tx
        .select({ id: enrollments.id, mailboxId: enrollments.mailboxId })
        .from(enrollments)
        .innerJoin(contacts, eq(contacts.id, enrollments.contactId))
        .where(
          and(
            eq(enrollments.status, "active"),
            lte(enrollments.nextSendAt, now),
            inArray(enrollments.campaignId, campaignIds),
            or(eq(enrollments.mailboxId, mailbox.id), isNull(enrollments.mailboxId)),
            sql`not exists (select 1 from suppressions s where s.email = ${contacts.email})`,
          ),
        )
        // Follow-ups already pinned to this mailbox first, then the oldest due.
        .orderBy(sql`${enrollments.mailboxId} is null`, asc(enrollments.nextSendAt), asc(enrollments.id))
        .limit(1)
        .for("update", { of: enrollments, skipLocked: true });
      if (!candidate) return null;

      const slot = await tx
        .update(mailboxes)
        .set({ nextSendAt: new Date(now.getTime() + nextSendGapMs(mailbox.minIntervalSeconds)) })
        .where(
          and(
            eq(mailboxes.id, mailbox.id),
            eq(mailboxes.status, "active"),
            or(isNull(mailboxes.nextSendAt), lte(mailboxes.nextSendAt, now)),
          ),
        )
        .returning({ id: mailboxes.id });
      if (!slot.length) return null;

      await tx
        .update(enrollments)
        .set({ status: "sending", claimedAt: now, mailboxId: mailbox.id })
        .where(eq(enrollments.id, candidate.id));
      return { enrollmentId: candidate.id, previousMailboxId: candidate.mailboxId };
    });
  }

  async function release(enrollmentId: string, previousMailboxId: string | null, error: string | null, retryAt?: Date) {
    await db
      .update(enrollments)
      .set({
        status: "active",
        claimedAt: null,
        mailboxId: previousMailboxId,
        lastError: error,
        ...(retryAt ? { nextSendAt: retryAt } : {}),
      })
      .where(eq(enrollments.id, enrollmentId));
  }

  async function fail(enrollmentId: string, campaignId: string, mailboxId: string, error: string) {
    await db
      .update(enrollments)
      .set({ status: "failed", claimedAt: null, lastError: error })
      .where(eq(enrollments.id, enrollmentId));
    await recordEvent(db, { type: "send_failed", campaignId, enrollmentId, mailboxId, detail: { error } });
  }

  async function deliver(mailbox: Mailbox, enrollmentId: string, previousMailboxId: string | null): Promise<Outcome> {
    const enrollment = await db.query.enrollments.findFirst({ where: eq(enrollments.id, enrollmentId) });
    if (!enrollment) return "idle";
    const [campaign, contact, steps, prior] = await Promise.all([
      db.query.campaigns.findFirst({ where: eq(campaigns.id, enrollment.campaignId) }),
      db.query.contacts.findFirst({ where: eq(contacts.id, enrollment.contactId) }),
      db
        .select()
        .from(campaignSteps)
        .where(eq(campaignSteps.campaignId, enrollment.campaignId))
        .orderBy(asc(campaignSteps.position)),
      db.select().from(messages).where(eq(messages.enrollmentId, enrollmentId)).orderBy(asc(messages.stepPosition)),
    ]);
    if (!campaign || !contact) return "idle";
    const log = logger.child({ campaignId: campaign.id, enrollmentId, mailboxId: mailbox.id });

    if (campaign.status !== "active") {
      await release(enrollmentId, previousMailboxId, null);
      return "deferred";
    }

    const step = steps.find((s) => s.position === enrollment.nextStep);
    if (!step) {
      // Steps were removed while paused; nothing left to send.
      await db.update(enrollments).set({ status: "completed", claimedAt: null }).where(eq(enrollments.id, enrollmentId));
      return "idle";
    }

    let composed;
    try {
      composed = composeEmail({
        step,
        threadSubject: prior[0]?.subject ?? null,
        context: buildTemplateContext(contact, mailbox),
        postalAddress: campaign.postalAddress,
        unsubscribeUrl: `${ctx.appUrl}/u/${enrollment.unsubscribeToken}`,
        oneClickUnsubscribeUrl: `${ctx.appUrl}/api/unsubscribe/${enrollment.unsubscribeToken}`,
        senderEmail: mailbox.email,
        threadMessageIds: prior.map((m) => m.rfcMessageId),
      });
    } catch (error) {
      if (!isDomainError(error)) throw error;
      await fail(enrollmentId, campaign.id, mailbox.id, error.message);
      return "failed";
    }

    let credentials;
    try {
      credentials = mailboxService.credentials(mailbox).smtp;
    } catch {
      await release(enrollmentId, previousMailboxId, null);
      await mailboxService.markError(mailbox.id, "Stored password can't be decrypted (was APP_SECRET changed?). Re-enter it.");
      return "deferred";
    }

    const messageId = generateMessageId(mailbox.email);
    try {
      await ctx.sender.send(credentials, {
        from: { name: mailbox.fromName, address: mailbox.email },
        to: contact.email,
        subject: composed.subject,
        text: composed.text,
        messageId,
        headers: composed.headers,
      });
    } catch (error) {
      const smtpError = error instanceof SmtpSendError ? error : new SmtpSendError("unknown", String(error));
      log.warn("send failed", { kind: smtpError.kind, error: smtpError.message });

      switch (smtpError.kind) {
        case "recipient_rejected":
          await db.transaction(async (tx) => {
            await tx
              .update(enrollments)
              .set({ status: "bounced", claimedAt: null, lastError: smtpError.message })
              .where(eq(enrollments.id, enrollmentId));
            await suppressEmail(tx, contact.email, "bounced", smtpError.message.slice(0, 300));
            await recordEvent(tx, {
              type: "bounce",
              campaignId: campaign.id,
              enrollmentId,
              mailboxId: mailbox.id,
              email: contact.email,
              detail: { stage: "smtp", error: smtpError.message },
            });
          });
          return "bounced";
        case "mailbox_problem":
          await release(enrollmentId, previousMailboxId, null);
          await mailboxService.markError(mailbox.id, smtpError.message);
          return "deferred";
        case "not_sent":
          await release(enrollmentId, previousMailboxId, smtpError.message, new Date(ctx.now().getTime() + NOT_SENT_BACKOFF_MS));
          return "deferred";
        case "unknown":
          await fail(enrollmentId, campaign.id, mailbox.id, smtpError.message);
          return "failed";
      }
    }

    const sentAt = ctx.now();
    const nextStep = steps.find((s) => s.position === step.position + 1);
    await db.transaction(async (tx) => {
      await tx.insert(messages).values({
        enrollmentId,
        campaignId: campaign.id,
        stepId: step.id,
        mailboxId: mailbox.id,
        stepPosition: step.position,
        rfcMessageId: messageId,
        toEmail: contact.email,
        subject: composed.subject,
        sentAt,
      });
      await tx
        .update(enrollments)
        .set({
          nextStep: step.position + 1,
          status: nextStep ? "active" : "completed",
          nextSendAt: nextStep ? followUpDueAt(sentAt, nextStep.waitDays) : enrollment.nextSendAt,
          claimedAt: null,
          lastError: null,
        })
        .where(eq(enrollments.id, enrollmentId));
      await recordEvent(tx, {
        type: "sent",
        campaignId: campaign.id,
        enrollmentId,
        mailboxId: mailbox.id,
        email: contact.email,
        detail: { step: step.position, subject: composed.subject },
      });
    });
    log.info("sent", { step: step.position });
    return "sent";
  }

  return async function runDispatchCycle(): Promise<DispatchSummary> {
    const now = ctx.now();
    const summary: DispatchSummary = {
      sent: 0,
      failed: 0,
      bounced: 0,
      deferred: 0,
      recoveredStale: 0,
      pausedCampaigns: [],
      completedCampaigns: [],
    };

    summary.recoveredStale = await recoverStaleClaims(now);
    const running = await reviewActiveCampaigns(summary);
    const inWindow = running.filter((c) =>
      isWithinSendWindow(now, {
        timezone: c.timezone,
        days: c.sendDays,
        startMinute: c.windowStartMinute,
        endMinute: c.windowEndMinute,
      }),
    );
    if (!inWindow.length) return summary;

    const candidates = await eligibleMailboxes(
      inWindow.map((c) => c.id),
      now,
    );
    const outcomes = await mapWithConcurrency(candidates, MAILBOX_CONCURRENCY, async ({ mailbox, campaignIds }) => {
      const claimed = await claim(mailbox, campaignIds, now);
      if (!claimed) return "idle" as const;
      try {
        return await deliver(mailbox, claimed.enrollmentId, claimed.previousMailboxId);
      } catch (error) {
        // Unexpected bug: never leave the claim dangling in a retryable state.
        logger.error("dispatch error", { enrollmentId: claimed.enrollmentId, error });
        await db
          .update(enrollments)
          .set({ status: "failed", claimedAt: null, lastError: `Internal error: ${(error as Error).message}` })
          .where(eq(enrollments.id, claimed.enrollmentId));
        return "failed" as const;
      }
    });

    for (const outcome of outcomes) if (outcome !== "idle") summary[outcome] += 1;
    return summary;
  };
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]!);
    }
  });
  await Promise.all(workers);
  return results;
}
