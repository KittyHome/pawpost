import {
  checkPublicUrl,
  DomainError,
  formatMinuteOfDay,
  lintTemplate,
  parseTimeOfDay,
  STANDARD_VARIABLES,
  toCsv,
  validateSendWindow,
} from "@pawpost/core";
import {
  campaignMailboxes,
  campaigns,
  campaignSteps,
  contactLists,
  contacts,
  enrollments,
  mailboxes,
  messages,
  type Campaign,
  type CampaignStatus,
  type CampaignStep,
} from "@pawpost/db";
import { and, asc, count, desc, eq, isNull, max, notInArray, sql } from "drizzle-orm";

import { writeAudit } from "./audit";
import type { Actor, EngineContext } from "./context";
import { recordEvent } from "./events";
import { requirePermission } from "./guard";
import { slugify } from "./lists";
import { campaignStats, type CampaignStats } from "./stats";
import { campaignCreateInput, campaignSettingsInput, stepsInput } from "./validation";

export interface CampaignDetail extends Campaign {
  listName: string;
  steps: CampaignStep[];
  mailboxIds: string[];
  stats: CampaignStats;
  windowStart: string;
  windowEnd: string;
}

export interface Preflight {
  errors: string[];
  warnings: string[];
}

const EDITABLE: CampaignStatus[] = ["draft", "paused"];
const CAMPAIGN_STATUSES: CampaignStatus[] = ["draft", "active", "paused", "completed"];

const DEFAULT_STEPS = [
  {
    position: 0,
    waitDays: 0,
    subject: "Quick question, {{firstName|there}}",
    body: "Hi {{firstName|there}},\n\n<one or two sentences on why you're writing to them specifically>\n\n<one clear, low-effort ask>\n\nThanks,\n{{senderFirstName}}",
  },
  {
    position: 1,
    waitDays: 4,
    subject: "",
    body: "Hi {{firstName|there}}, just bumping this in case it got buried. Happy to send more detail if useful.\n\n{{senderFirstName}}",
  },
];

export function createCampaignService(ctx: EngineContext) {
  const { db } = ctx;

  async function find(id: string): Promise<Campaign> {
    const campaign = await db.query.campaigns.findFirst({ where: and(eq(campaigns.id, id), isNull(campaigns.deletedAt)) });
    if (!campaign) throw new DomainError("not_found", "Campaign not found.");
    return campaign;
  }

  async function liveList(listId: string) {
    const list = await db.query.contactLists.findFirst({
      where: and(eq(contactLists.id, listId), isNull(contactLists.deletedAt)),
    });
    if (!list) throw new DomainError("not_found", "Contact list not found.");
    return list;
  }

  function assertEditable(campaign: Campaign): void {
    if (!EDITABLE.includes(campaign.status)) {
      throw new DomainError("invalid_state", "Pause the campaign before editing it.");
    }
  }

  async function preflight(id: string): Promise<Preflight> {
    const campaign = await find(id);
    const errors: string[] = [];
    const warnings: string[] = [];

    const [steps, list, attached, [contactCount]] = await Promise.all([
      db.select().from(campaignSteps).where(eq(campaignSteps.campaignId, id)).orderBy(asc(campaignSteps.position)),
      db.query.contactLists.findFirst({ where: and(eq(contactLists.id, campaign.listId), isNull(contactLists.deletedAt)) }),
      db
        .select({ status: mailboxes.status, email: mailboxes.email })
        .from(campaignMailboxes)
        .innerJoin(mailboxes, eq(mailboxes.id, campaignMailboxes.mailboxId))
        .where(eq(campaignMailboxes.campaignId, id)),
      db
        .select({ n: count() })
        .from(contacts)
        .where(and(eq(contacts.listId, campaign.listId), isNull(contacts.deletedAt))),
    ]);

    if (!list) errors.push("The contact list is in the trash. Restore it or choose another list.");
    if (!steps.length) errors.push("Add at least one email to the sequence.");
    if (steps[0] && !steps[0].subject.trim()) errors.push("The first email needs a subject.");

    const known = [...STANDARD_VARIABLES, ...(list?.attributeColumns ?? [])];
    steps.forEach((step, i) => {
      for (const issue of [...lintTemplate(step.subject, known), ...lintTemplate(step.body, known)]) {
        (issue.severity === "error" ? errors : warnings).push(`Email ${i + 1}: ${issue.message}`);
      }
      if (/<[^>]+>/.test(step.body) && /<(one|your|add|insert)\b/i.test(step.body)) {
        errors.push(`Email ${i + 1} still contains placeholder text in <angle brackets>.`);
      }
      if ((step.body.match(/https?:\/\//g) ?? []).length > 1) {
        warnings.push(`Email ${i + 1} has more than one link; cold emails land in the inbox more often with one or none.`);
      }
    });

    if (!campaign.postalAddress.trim()) {
      errors.push("Add a postal address. Anti-spam laws (e.g. CAN-SPAM) require one in every commercial email.");
    }

    const windowError = validateSendWindow({
      timezone: campaign.timezone,
      days: campaign.sendDays,
      startMinute: campaign.windowStartMinute,
      endMinute: campaign.windowEndMinute,
    });
    if (windowError) errors.push(windowError);

    if (!attached.length) errors.push("Attach at least one mailbox to send from.");
    else if (!attached.some((m) => m.status === "active")) errors.push("None of the attached mailboxes is active.");
    for (const m of attached.filter((m) => m.status === "error"))
      warnings.push(`${m.email} has a connection error and won't send.`);

    if (list && !contactCount?.n) errors.push("The contact list is empty.");

    const publicUrl = checkPublicUrl(ctx.appUrl);
    if (publicUrl.message) warnings.push(publicUrl.message);

    return { errors, warnings };
  }

  /** Enrolls every live list contact not suppressed and not already in another running sequence. */
  async function enrollContacts(campaign: Campaign): Promise<number> {
    const result = await db.execute<{ id: string }>(sql`
      insert into ${enrollments} (campaign_id, contact_id, unsubscribe_token, next_send_at)
      select ${campaign.id}, c.id,
             replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
             ${ctx.now().toISOString()}::timestamptz
      from ${contacts} c
      where c.list_id = ${campaign.listId}
        and c.deleted_at is null
        and not exists (select 1 from suppressions s where s.email = c.email)
        and not exists (
          select 1 from enrollments e2
          join contacts c2 on c2.id = e2.contact_id
          where c2.email = c.email
            and e2.campaign_id <> ${campaign.id}
            and e2.status in ('active', 'sending')
        )
      on conflict (campaign_id, contact_id) do nothing
      returning id
    `);
    return result.length;
  }

  return {
    preflight,

    async list(options: { status?: string } = {}) {
      const status = CAMPAIGN_STATUSES.find((s) => s === options.status);
      const rows = await db
        .select({ campaign: campaigns, listName: contactLists.name })
        .from(campaigns)
        .innerJoin(contactLists, eq(contactLists.id, campaigns.listId))
        .where(and(isNull(campaigns.deletedAt), status ? eq(campaigns.status, status) : undefined))
        .orderBy(desc(campaigns.createdAt));
      const stats = await campaignStats(
        db,
        rows.map((r) => r.campaign.id),
      );
      return rows.map((r) => ({ ...r.campaign, listName: r.listName, stats: stats.get(r.campaign.id)! }));
    },

    async statusCounts(): Promise<Record<CampaignStatus | "all", number>> {
      const rows = await db
        .select({ status: campaigns.status, n: count() })
        .from(campaigns)
        .where(isNull(campaigns.deletedAt))
        .groupBy(campaigns.status);
      const counts = { all: 0, draft: 0, active: 0, paused: 0, completed: 0 };
      for (const r of rows) {
        counts[r.status] = r.n;
        counts.all += r.n;
      }
      return counts;
    },

    async get(id: string): Promise<CampaignDetail> {
      const campaign = await find(id);
      const [steps, attached, list, stats] = await Promise.all([
        db.select().from(campaignSteps).where(eq(campaignSteps.campaignId, id)).orderBy(asc(campaignSteps.position)),
        db.select({ mailboxId: campaignMailboxes.mailboxId }).from(campaignMailboxes).where(eq(campaignMailboxes.campaignId, id)),
        db.query.contactLists.findFirst({ where: eq(contactLists.id, campaign.listId) }),
        campaignStats(db, [id]),
      ]);
      return {
        ...campaign,
        listName: list ? `${list.name}${list.deletedAt ? " (in trash)" : ""}` : "(deleted list)",
        steps,
        mailboxIds: attached.map((a) => a.mailboxId),
        stats: stats.get(id)!,
        windowStart: formatMinuteOfDay(campaign.windowStartMinute),
        windowEnd: formatMinuteOfDay(campaign.windowEndMinute),
      };
    },

    async create(actor: Actor, raw: unknown): Promise<Campaign> {
      const input = campaignCreateInput.parse(raw);
      const list = await liveList(input.listId);

      return db.transaction(async (tx) => {
        const [campaign] = await tx.insert(campaigns).values({ name: input.name, listId: input.listId }).returning();
        await tx.insert(campaignSteps).values(DEFAULT_STEPS.map((s) => ({ ...s, campaignId: campaign!.id })));
        // Start with every active mailbox attached; the user can narrow it down.
        const active = await tx.select({ id: mailboxes.id }).from(mailboxes).where(eq(mailboxes.status, "active"));
        if (active.length) {
          await tx.insert(campaignMailboxes).values(active.map((m) => ({ campaignId: campaign!.id, mailboxId: m.id })));
        }
        await writeAudit(tx, actor, {
          action: "campaign.created",
          summary: `${actor.email} created campaign "${input.name}" for list "${list.name}"`,
          entityType: "campaign",
          entityId: campaign!.id,
        });
        return campaign!;
      });
    },

    /** Copies a campaign's sequence, schedule and mailboxes into a new draft. */
    async duplicate(actor: Actor, id: string): Promise<Campaign> {
      const source = await find(id);
      return db.transaction(async (tx) => {
        const [copy] = await tx
          .insert(campaigns)
          .values({
            name: `${source.name} (copy)`.slice(0, 120),
            listId: source.listId,
            timezone: source.timezone,
            sendDays: source.sendDays,
            windowStartMinute: source.windowStartMinute,
            windowEndMinute: source.windowEndMinute,
            postalAddress: source.postalAddress,
            stopOnReply: source.stopOnReply,
          })
          .returning();
        const steps = await tx.select().from(campaignSteps).where(eq(campaignSteps.campaignId, id));
        if (steps.length) {
          await tx.insert(campaignSteps).values(
            steps.map((s) => ({
              campaignId: copy!.id,
              position: s.position,
              waitDays: s.waitDays,
              subject: s.subject,
              body: s.body,
            })),
          );
        }
        const attached = await tx.select().from(campaignMailboxes).where(eq(campaignMailboxes.campaignId, id));
        if (attached.length) {
          await tx.insert(campaignMailboxes).values(attached.map((a) => ({ campaignId: copy!.id, mailboxId: a.mailboxId })));
        }
        await writeAudit(tx, actor, {
          action: "campaign.duplicated",
          summary: `${actor.email} duplicated campaign "${source.name}"`,
          entityType: "campaign",
          entityId: copy!.id,
          metadata: { sourceId: id },
        });
        return copy!;
      });
    },

    async updateSettings(actor: Actor, id: string, raw: unknown): Promise<void> {
      const input = campaignSettingsInput.parse(raw);
      const campaign = await find(id);
      assertEditable(campaign);

      const windowStartMinute = parseTimeOfDay(input.windowStart);
      const windowEndMinute = parseTimeOfDay(input.windowEnd);
      if (windowStartMinute === null || windowEndMinute === null)
        throw new DomainError("validation", "Use HH:MM for the sending window.");
      const windowError = validateSendWindow({
        timezone: input.timezone,
        days: input.sendDays,
        startMinute: windowStartMinute,
        endMinute: windowEndMinute,
      });
      if (windowError) throw new DomainError("validation", windowError);
      if (input.listId !== campaign.listId) {
        if (campaign.status !== "draft") {
          throw new DomainError("invalid_state", "The contact list can only be changed before the campaign starts.");
        }
        await liveList(input.listId);
      }
      const mailboxIds = [...new Set(input.mailboxIds)];

      await db.transaction(async (tx) => {
        await tx
          .update(campaigns)
          .set({
            name: input.name,
            listId: input.listId,
            timezone: input.timezone,
            sendDays: [...new Set(input.sendDays)].sort(),
            windowStartMinute,
            windowEndMinute,
            postalAddress: input.postalAddress,
            stopOnReply: input.stopOnReply,
          })
          .where(eq(campaigns.id, id));

        await tx.delete(campaignMailboxes).where(eq(campaignMailboxes.campaignId, id));
        if (mailboxIds.length) {
          await tx.insert(campaignMailboxes).values(mailboxIds.map((mailboxId) => ({ campaignId: id, mailboxId })));
        }
        // Contacts pinned to a removed mailbox get re-assigned on their next send.
        await tx
          .update(enrollments)
          .set({ mailboxId: null })
          .where(
            and(
              eq(enrollments.campaignId, id),
              eq(enrollments.status, "active"),
              mailboxIds.length ? notInArray(enrollments.mailboxId, mailboxIds) : sql`true`,
            ),
          );
        await writeAudit(tx, actor, {
          action: "campaign.settings_updated",
          summary: `${actor.email} updated the settings of "${input.name}"`,
          entityType: "campaign",
          entityId: id,
        });
      });
    },

    async saveSteps(actor: Actor, id: string, raw: unknown): Promise<void> {
      const steps = stepsInput.parse(raw);
      const campaign = await find(id);
      assertEditable(campaign);
      if (!steps[0]!.subject) throw new DomainError("validation", "The first email needs a subject.");

      await db.transaction(async (tx) => {
        await tx.delete(campaignSteps).where(eq(campaignSteps.campaignId, id));
        await tx.insert(campaignSteps).values(
          steps.map((s, position) => ({
            campaignId: id,
            position,
            waitDays: position === 0 ? 0 : s.waitDays,
            subject: s.subject,
            body: s.body.replace(/\r\n?/g, "\n"),
          })),
        );
        await writeAudit(tx, actor, {
          action: "campaign.sequence_updated",
          summary: `${actor.email} edited the sequence of "${campaign.name}" (${steps.length} email${steps.length === 1 ? "" : "s"})`,
          entityType: "campaign",
          entityId: id,
        });
      });
    },

    async start(actor: Actor, id: string): Promise<{ enrolled: number }> {
      const campaign = await find(id);
      if (campaign.status !== "draft") throw new DomainError("invalid_state", "Only draft campaigns can be started.");
      const check = await preflight(id);
      if (check.errors.length) throw new DomainError("preflight_failed", check.errors.join("\n"));

      const enrolled = await enrollContacts(campaign);
      if (!enrolled) {
        throw new DomainError(
          "nothing_to_send",
          "No contacts could be enrolled: all are suppressed or already in another active campaign.",
        );
      }
      await db.update(campaigns).set({ status: "active", startedAt: ctx.now(), pauseReason: null }).where(eq(campaigns.id, id));
      await writeAudit(db, actor, {
        action: "campaign.started",
        summary: `${actor.email} started "${campaign.name}" with ${enrolled} contact(s)`,
        entityType: "campaign",
        entityId: id,
      });
      ctx.logger.info("campaign started", { campaignId: id, enrolled });
      return { enrolled };
    },

    async pause(actor: Actor, id: string): Promise<void> {
      const campaign = await find(id);
      if (campaign.status !== "active") throw new DomainError("invalid_state", "Only running campaigns can be paused.");
      await db.update(campaigns).set({ status: "paused", pauseReason: null }).where(eq(campaigns.id, id));
      await recordEvent(db, { type: "campaign_paused", campaignId: id, detail: { reason: `Paused by ${actor.name}` } });
      await writeAudit(db, actor, {
        action: "campaign.paused",
        summary: `${actor.email} paused "${campaign.name}"`,
        entityType: "campaign",
        entityId: id,
      });
    },

    /** Resuming also enrolls contacts added to the list since the campaign started. */
    async resume(actor: Actor, id: string): Promise<{ newlyEnrolled: number }> {
      const campaign = await find(id);
      if (campaign.status !== "paused") throw new DomainError("invalid_state", "Only paused campaigns can be resumed.");
      const check = await preflight(id);
      if (check.errors.length) throw new DomainError("preflight_failed", check.errors.join("\n"));
      const newlyEnrolled = await enrollContacts(campaign);
      await db.update(campaigns).set({ status: "active", pauseReason: null }).where(eq(campaigns.id, id));
      await writeAudit(db, actor, {
        action: "campaign.resumed",
        summary: `${actor.email} resumed "${campaign.name}"${newlyEnrolled ? ` and enrolled ${newlyEnrolled} new contact(s)` : ""}`,
        entityType: "campaign",
        entityId: id,
      });
      return { newlyEnrolled };
    },

    /** Moves a campaign to the trash. Running campaigns must be paused first. */
    async trash(actor: Actor, id: string): Promise<void> {
      const campaign = await find(id);
      if (campaign.status === "active") throw new DomainError("invalid_state", "Pause the campaign before deleting it.");
      await db.transaction(async (tx) => {
        await tx.update(campaigns).set({ deletedAt: ctx.now(), deletedById: actor.id }).where(eq(campaigns.id, id));
        await writeAudit(tx, actor, {
          action: "campaign.trashed",
          summary: `${actor.email} moved "${campaign.name}" to the trash`,
          entityType: "campaign",
          entityId: id,
        });
      });
    },

    async enrollments(id: string, options: { page?: number; pageSize?: number; status?: string } = {}) {
      const pageSize = Math.min(options.pageSize ?? 50, 200);
      const page = Math.max(options.page ?? 1, 1);
      const status = options.status as (typeof enrollments.status.enumValues)[number] | undefined;
      const where = and(
        eq(enrollments.campaignId, id),
        status && enrollments.status.enumValues.includes(status) ? eq(enrollments.status, status) : undefined,
      );
      const [rows, [total]] = await Promise.all([
        db
          .select({
            id: enrollments.id,
            status: enrollments.status,
            nextStep: enrollments.nextStep,
            nextSendAt: enrollments.nextSendAt,
            lastError: enrollments.lastError,
            email: contacts.email,
            firstName: contacts.firstName,
            lastName: contacts.lastName,
            contactTrashed: sql<boolean>`${contacts.deletedAt} is not null`,
            mailboxEmail: mailboxes.email,
          })
          .from(enrollments)
          .innerJoin(contacts, eq(contacts.id, enrollments.contactId))
          .leftJoin(mailboxes, eq(mailboxes.id, enrollments.mailboxId))
          .where(where)
          .orderBy(asc(enrollments.nextSendAt), asc(contacts.email))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db.select({ n: count() }).from(enrollments).where(where),
      ]);
      return { rows, total: total?.n ?? 0, page, pageSize };
    },

    /** Every enrolled contact with their outcome, as CSV. */
    async exportResults(actor: Actor, id: string): Promise<{ filename: string; csv: string }> {
      requirePermission(actor, "data.export");
      const campaign = await find(id);
      const rows = await db
        .select({
          email: contacts.email,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          company: contacts.company,
          status: enrollments.status,
          emailsSent: count(messages.id),
          lastSentAt: max(messages.sentAt),
          mailbox: mailboxes.email,
          lastError: enrollments.lastError,
        })
        .from(enrollments)
        .innerJoin(contacts, eq(contacts.id, enrollments.contactId))
        .leftJoin(messages, eq(messages.enrollmentId, enrollments.id))
        .leftJoin(mailboxes, eq(mailboxes.id, enrollments.mailboxId))
        .where(eq(enrollments.campaignId, id))
        .groupBy(enrollments.id, contacts.id, mailboxes.email)
        .orderBy(asc(contacts.email));
      const csv = toCsv(rows, [
        { header: "email", value: (r) => r.email },
        { header: "first_name", value: (r) => r.firstName },
        { header: "last_name", value: (r) => r.lastName },
        { header: "company", value: (r) => r.company },
        { header: "status", value: (r) => r.status },
        { header: "emails_sent", value: (r) => r.emailsSent },
        { header: "last_sent_at", value: (r) => r.lastSentAt },
        { header: "mailbox", value: (r) => r.mailbox },
        { header: "error", value: (r) => r.lastError },
      ]);
      await writeAudit(db, actor, {
        action: "campaign.exported",
        summary: `${actor.email} exported the results of "${campaign.name}" (${rows.length} contacts)`,
        entityType: "campaign",
        entityId: id,
      });
      return { filename: `${slugify(campaign.name)}-results.csv`, csv };
    },
  };
}

export type CampaignService = ReturnType<typeof createCampaignService>;
