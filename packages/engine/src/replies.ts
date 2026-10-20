import { REPLY_INTENTS, type ReplyIntent } from "@pawpost/ai";
import { DomainError } from "@pawpost/core";
import { campaigns, contacts, enrollments, events, mailboxes } from "@pawpost/db";
import { and, count, desc, eq, sql, type SQL } from "drizzle-orm";

import { writeAudit } from "./audit";
import type { Actor, EngineContext } from "./context";
import { suppressEmail } from "./suppressions";

export const REPLY_TABS = ["needs_attention", "all", "done"] as const;
export type ReplyTab = (typeof REPLY_TABS)[number];

export interface ReplyRow {
  id: number;
  email: string;
  from: string | null;
  subject: string;
  snippet: string;
  intent: ReplyIntent | null;
  summary: string | null;
  handledAt: string | null;
  handledBy: string | null;
  createdAt: Date;
  campaignId: string | null;
  campaignName: string | null;
  mailboxEmail: string | null;
  enrollmentId: string | null;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
}

export interface ReplyCounts {
  all: number;
  needsAttention: number;
  done: number;
}

export interface ReplyQuery {
  tab?: string;
  campaignId?: string;
  page?: number;
  pageSize?: number;
}

const handledSql = sql`coalesce(${events.detail}->>'handledAt', '') <> ''`;
const needsLookSql = sql`(
  coalesce(${events.detail}->>'handledAt', '') = ''
  and coalesce(${events.detail}->>'intent', '') in ('interested', 'question', 'referral', '')
)`;

function tabOf(value: string | undefined): ReplyTab {
  return REPLY_TABS.find((tab) => tab === value) ?? "needs_attention";
}

function asText(detail: Record<string, unknown>, key: string): string | null {
  const value = detail[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function parseDetail(detail: Record<string, unknown>) {
  const intent = asText(detail, "intent");
  return {
    subject: asText(detail, "subject") ?? "",
    snippet: asText(detail, "snippet") ?? "",
    from: asText(detail, "from"),
    intent: intent && REPLY_INTENTS.includes(intent as ReplyIntent) ? (intent as ReplyIntent) : null,
    summary: asText(detail, "summary"),
    handledAt: asText(detail, "handledAt"),
    handledBy: asText(detail, "handledBy"),
  };
}

function toRow(row: {
  id: number;
  email: string | null;
  detail: Record<string, unknown>;
  createdAt: Date;
  campaignId: string | null;
  campaignName: string | null;
  mailboxEmail: string | null;
  enrollmentId: string | null;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
}): ReplyRow {
  return {
    id: row.id,
    email: row.email ?? "",
    createdAt: row.createdAt,
    campaignId: row.campaignId,
    campaignName: row.campaignName,
    mailboxEmail: row.mailboxEmail,
    enrollmentId: row.enrollmentId,
    firstName: row.firstName,
    lastName: row.lastName,
    company: row.company,
    ...parseDetail(row.detail),
  };
}

export function createReplyService(ctx: EngineContext) {
  const { db } = ctx;

  function scope(campaignId?: string): SQL {
    return campaignId ? and(eq(events.type, "reply"), eq(events.campaignId, campaignId))! : eq(events.type, "reply");
  }

  async function findReply(id: number) {
    const [row] = await db
      .select({
        id: events.id,
        email: events.email,
        detail: events.detail,
        campaignId: events.campaignId,
      })
      .from(events)
      .where(and(eq(events.id, id), eq(events.type, "reply")))
      .limit(1);
    if (!row?.email) throw new DomainError("not_found", "Reply not found.");
    return { ...row, email: row.email, ...parseDetail(row.detail) };
  }

  async function mark(actor: Actor, id: number): Promise<void> {
    const reply = await findReply(id);
    if (reply.handledAt) return;
    const detail = {
      ...reply.detail,
      handledAt: ctx.now().toISOString(),
      handledBy: actor.email,
    };
    await db.transaction(async (tx) => {
      await tx.update(events).set({ detail }).where(eq(events.id, id));
      await writeAudit(tx, actor, {
        action: "reply.handled",
        summary: `${actor.email} marked a reply from ${reply.email} as done`,
        entityType: "reply",
        entityId: String(id),
        metadata: { email: reply.email, campaignId: reply.campaignId },
      });
    });
  }

  async function counts(campaignId?: string): Promise<ReplyCounts> {
    const [row] = await db
      .select({
        all: count(),
        done: sql<number>`count(*) filter (where ${handledSql})`,
        needsAttention: sql<number>`count(*) filter (where ${needsLookSql})`,
      })
      .from(events)
      .where(scope(campaignId));
    return {
      all: Number(row?.all ?? 0),
      done: Number(row?.done ?? 0),
      needsAttention: Number(row?.needsAttention ?? 0),
    };
  }

  return {
    counts,

    async list(options: ReplyQuery = {}) {
      const tab = tabOf(options.tab);
      const pageSize = Math.min(options.pageSize ?? 25, 100);
      const page = Math.max(options.page ?? 1, 1);
      const campaignId = options.campaignId?.trim() || undefined;
      const conditions = [scope(campaignId)];
      if (tab === "needs_attention") conditions.push(needsLookSql);
      else if (tab === "done") conditions.push(handledSql);
      const where = and(...conditions);

      const [rows, [total], tabCounts] = await Promise.all([
        db
          .select({
            id: events.id,
            email: events.email,
            detail: events.detail,
            createdAt: events.createdAt,
            campaignId: events.campaignId,
            campaignName: campaigns.name,
            mailboxEmail: mailboxes.email,
            enrollmentId: events.enrollmentId,
            firstName: contacts.firstName,
            lastName: contacts.lastName,
            company: contacts.company,
          })
          .from(events)
          .leftJoin(campaigns, eq(campaigns.id, events.campaignId))
          .leftJoin(mailboxes, eq(mailboxes.id, events.mailboxId))
          .leftJoin(enrollments, eq(enrollments.id, events.enrollmentId))
          .leftJoin(contacts, eq(contacts.id, enrollments.contactId))
          .where(where)
          .orderBy(desc(events.createdAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db.select({ n: count() }).from(events).where(where),
        counts(campaignId),
      ]);

      return {
        rows: rows.map(toRow),
        total: total?.n ?? 0,
        page,
        pageSize,
        tab,
        counts: tabCounts,
      };
    },

    markHandled: mark,

    async suppress(actor: Actor, id: number): Promise<void> {
      const reply = await findReply(id);
      await db.transaction(async (tx) => {
        const { added } = await suppressEmail(tx, reply.email, "manual", "from reply inbox");
        if (added) {
          await writeAudit(tx, actor, {
            action: "suppression.added",
            summary: `${actor.email} suppressed ${reply.email}`,
            entityType: "suppression",
            entityId: reply.email,
          });
        }
        if (!reply.handledAt) {
          await tx
            .update(events)
            .set({
              detail: {
                ...reply.detail,
                handledAt: ctx.now().toISOString(),
                handledBy: actor.email,
              },
            })
            .where(eq(events.id, id));
          await writeAudit(tx, actor, {
            action: "reply.handled",
            summary: `${actor.email} marked a reply from ${reply.email} as done`,
            entityType: "reply",
            entityId: String(id),
            metadata: { email: reply.email, campaignId: reply.campaignId, suppressed: true },
          });
        }
      });
    },
  };
}
