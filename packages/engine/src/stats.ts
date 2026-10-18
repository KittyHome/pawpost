import type { CampaignCounters } from "@pawpost/core";
import { campaigns, enrollments, events, mailboxes, messages, type EnrollmentStatus, type Executor } from "@pawpost/db";
import { and, count, desc, eq, gt, inArray, sql } from "drizzle-orm";

import type { EngineContext } from "./context";

export interface CampaignStats {
  enrolled: number;
  byStatus: Record<EnrollmentStatus, number>;
  emailsSent: number;
  replies: number;
  bounces: number;
  unsubscribes: number;
  /** Emails handed to SMTP, including ones rejected at RCPT. Denominator for health rates. */
  attempts: number;
}

const EMPTY_STATUS: Record<EnrollmentStatus, number> = {
  active: 0,
  sending: 0,
  completed: 0,
  replied: 0,
  bounced: 0,
  unsubscribed: 0,
  suppressed: 0,
  failed: 0,
};

export async function campaignStats(db: Executor, campaignIds: string[]): Promise<Map<string, CampaignStats>> {
  const result = new Map<string, CampaignStats>();
  if (!campaignIds.length) return result;
  for (const id of campaignIds) {
    result.set(id, {
      enrolled: 0,
      byStatus: { ...EMPTY_STATUS },
      emailsSent: 0,
      replies: 0,
      bounces: 0,
      unsubscribes: 0,
      attempts: 0,
    });
  }

  const [statusRows, messageRows, eventRows] = await Promise.all([
    db
      .select({ campaignId: enrollments.campaignId, status: enrollments.status, n: count() })
      .from(enrollments)
      .where(inArray(enrollments.campaignId, campaignIds))
      .groupBy(enrollments.campaignId, enrollments.status),
    db
      .select({ campaignId: messages.campaignId, n: count() })
      .from(messages)
      .where(inArray(messages.campaignId, campaignIds))
      .groupBy(messages.campaignId),
    db
      .select({
        campaignId: events.campaignId,
        type: events.type,
        n: count(),
        smtpRejects: sql<number>`count(*) filter (where ${events.detail}->>'stage' = 'smtp')`.mapWith(Number),
      })
      .from(events)
      .where(and(inArray(events.campaignId, campaignIds), inArray(events.type, ["reply", "bounce", "unsubscribe"])))
      .groupBy(events.campaignId, events.type),
  ]);

  for (const row of statusRows) {
    const stats = result.get(row.campaignId)!;
    stats.byStatus[row.status] = row.n;
    stats.enrolled += row.n;
  }
  for (const row of messageRows) {
    const stats = result.get(row.campaignId)!;
    stats.emailsSent = row.n;
    stats.attempts += row.n;
  }
  for (const row of eventRows) {
    const stats = row.campaignId ? result.get(row.campaignId) : undefined;
    if (!stats) continue;
    if (row.type === "reply") stats.replies = row.n;
    if (row.type === "unsubscribe") stats.unsubscribes = row.n;
    if (row.type === "bounce") {
      stats.bounces = row.n;
      stats.attempts += row.smtpRejects;
    }
  }
  return result;
}

export function toHealthCounters(stats: CampaignStats): CampaignCounters {
  return { sent: stats.attempts, bounced: stats.bounces, unsubscribed: stats.unsubscribes };
}

export function createStatsService(ctx: EngineContext) {
  const { db } = ctx;

  return {
    async overview() {
      const now = ctx.now();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [[sent24h], weekly, [activeCampaigns], mailboxStatus] = await Promise.all([
        db.select({ n: count() }).from(messages).where(gt(messages.sentAt, dayAgo)),
        db
          .select({ type: events.type, n: count() })
          .from(events)
          .where(and(gt(events.createdAt, weekAgo), inArray(events.type, ["sent", "reply", "bounce", "unsubscribe"])))
          .groupBy(events.type),
        db.select({ n: count() }).from(campaigns).where(eq(campaigns.status, "active")),
        db.select({ status: mailboxes.status, n: count() }).from(mailboxes).groupBy(mailboxes.status),
      ]);
      const week = Object.fromEntries(weekly.map((w) => [w.type, w.n])) as Partial<Record<string, number>>;

      return {
        sentLast24h: sent24h?.n ?? 0,
        last7Days: {
          sent: week.sent ?? 0,
          replies: week.reply ?? 0,
          bounces: week.bounce ?? 0,
          unsubscribes: week.unsubscribe ?? 0,
        },
        activeCampaigns: activeCampaigns?.n ?? 0,
        mailboxes: Object.fromEntries(mailboxStatus.map((m) => [m.status, m.n])) as Partial<Record<string, number>>,
      };
    },

    async recentActivity(options: { campaignId?: string; limit?: number } = {}) {
      return db
        .select({
          id: events.id,
          type: events.type,
          email: events.email,
          detail: events.detail,
          createdAt: events.createdAt,
          campaignId: events.campaignId,
          campaignName: campaigns.name,
          mailboxEmail: mailboxes.email,
        })
        .from(events)
        .leftJoin(campaigns, eq(campaigns.id, events.campaignId))
        .leftJoin(mailboxes, eq(mailboxes.id, events.mailboxId))
        .where(options.campaignId ? eq(events.campaignId, options.campaignId) : undefined)
        .orderBy(desc(events.id))
        .limit(Math.min(options.limit ?? 25, 200));
    },
  };
}

export type StatsService = ReturnType<typeof createStatsService>;
