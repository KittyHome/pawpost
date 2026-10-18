/**
 * Trash: lists, campaigns and contacts are soft-deleted first, restorable for
 * TRASH_RETENTION_DAYS, then purged automatically by the worker.
 *
 * Rules
 *  - A campaign can only be restored while its list is live.
 *  - A contact can only be restored while its list is live and the address isn't back in that list.
 *  - A list can be purged only when no campaign (even a trashed one) still uses it;
 *    automatic purges run campaigns first, so this resolves itself over time.
 */
import { DomainError } from "@pawpost/core";
import { campaigns, contactLists, contacts, users } from "@pawpost/db";
import { and, count, desc, eq, inArray, isNotNull, isNull, lt, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { writeAudit } from "./audit";
import type { Actor, EngineContext } from "./context";
import { requirePermission } from "./guard";

export const TRASH_RETENTION_DAYS = 30;
export type TrashKind = "campaign" | "list" | "contact";

export function createTrashService(ctx: EngineContext) {
  const { db } = ctx;
  const deleter = alias(users, "deleter");

  const purgeLabel = { campaign: "campaign", list: "list", contact: "contact" } as const;

  async function purgeCampaigns(ids: string[]): Promise<number> {
    if (!ids.length) return 0;
    const removed = await db
      .delete(campaigns)
      .where(and(inArray(campaigns.id, ids), isNotNull(campaigns.deletedAt)))
      .returning({ id: campaigns.id });
    return removed.length;
  }

  async function purgeContacts(ids: string[]): Promise<number> {
    if (!ids.length) return 0;
    const removed = await db
      .delete(contacts)
      .where(and(inArray(contacts.id, ids), isNotNull(contacts.deletedAt)))
      .returning({ id: contacts.id });
    return removed.length;
  }

  /** Purges trashed lists that no campaign references any more. */
  async function purgeLists(ids: string[]): Promise<number> {
    if (!ids.length) return 0;
    const removed = await db
      .delete(contactLists)
      .where(
        and(
          inArray(contactLists.id, ids),
          isNotNull(contactLists.deletedAt),
          notExists(
            db
              .select({ one: sql`1` })
              .from(campaigns)
              .where(eq(campaigns.listId, contactLists.id)),
          ),
        ),
      )
      .returning({ id: contactLists.id });
    return removed.length;
  }

  return {
    retentionDays: TRASH_RETENTION_DAYS,

    async list() {
      const [campaignRows, listRows, contactRows] = await Promise.all([
        db
          .select({
            id: campaigns.id,
            name: campaigns.name,
            status: campaigns.status,
            deletedAt: campaigns.deletedAt,
            deletedBy: deleter.name,
          })
          .from(campaigns)
          .leftJoin(deleter, eq(deleter.id, campaigns.deletedById))
          .where(isNotNull(campaigns.deletedAt))
          .orderBy(desc(campaigns.deletedAt)),
        db
          .select({
            id: contactLists.id,
            name: contactLists.name,
            deletedAt: contactLists.deletedAt,
            deletedBy: deleter.name,
            // Outer column written in full: Drizzle renders select-list columns unqualified.
            contactCount: sql<number>`(select count(*)::int from contacts c where c.list_id = "contact_lists"."id" and c.deleted_at is null)`,
          })
          .from(contactLists)
          .leftJoin(deleter, eq(deleter.id, contactLists.deletedById))
          .where(isNotNull(contactLists.deletedAt))
          .orderBy(desc(contactLists.deletedAt)),
        // Contacts trashed individually from a list that is still live.
        db
          .select({
            id: contacts.id,
            email: contacts.email,
            firstName: contacts.firstName,
            lastName: contacts.lastName,
            listName: contactLists.name,
            deletedAt: contacts.deletedAt,
            deletedBy: deleter.name,
          })
          .from(contacts)
          .innerJoin(contactLists, eq(contactLists.id, contacts.listId))
          .leftJoin(deleter, eq(deleter.id, contacts.deletedById))
          .where(and(isNotNull(contacts.deletedAt), isNull(contactLists.deletedAt)))
          .orderBy(desc(contacts.deletedAt))
          .limit(1000),
      ]);
      const purgeAt = (d: Date | null) => (d ? new Date(d.getTime() + TRASH_RETENTION_DAYS * 86_400_000) : null);
      return {
        campaigns: campaignRows.map((r) => ({ ...r, purgeAt: purgeAt(r.deletedAt) })),
        lists: listRows.map((r) => ({ ...r, purgeAt: purgeAt(r.deletedAt) })),
        contacts: contactRows.map((r) => ({ ...r, purgeAt: purgeAt(r.deletedAt) })),
      };
    },

    async count(): Promise<number> {
      const [[a], [b], [c]] = await Promise.all([
        db.select({ n: count() }).from(campaigns).where(isNotNull(campaigns.deletedAt)),
        db.select({ n: count() }).from(contactLists).where(isNotNull(contactLists.deletedAt)),
        db
          .select({ n: count() })
          .from(contacts)
          .innerJoin(contactLists, eq(contactLists.id, contacts.listId))
          .where(and(isNotNull(contacts.deletedAt), isNull(contactLists.deletedAt))),
      ]);
      return (a?.n ?? 0) + (b?.n ?? 0) + (c?.n ?? 0);
    },

    async restore(actor: Actor, kind: TrashKind, id: string): Promise<void> {
      if (kind === "campaign") {
        const campaign = await db.query.campaigns.findFirst({ where: and(eq(campaigns.id, id), isNotNull(campaigns.deletedAt)) });
        if (!campaign) throw new DomainError("not_found", "That campaign isn't in the trash.");
        const list = await db.query.contactLists.findFirst({ where: eq(contactLists.id, campaign.listId) });
        if (list?.deletedAt) throw new DomainError("list_trashed", `Restore its contact list "${list.name}" first.`);
        await db.update(campaigns).set({ deletedAt: null, deletedById: null }).where(eq(campaigns.id, id));
        await writeAudit(db, actor, {
          action: "campaign.restored",
          summary: `${actor.email} restored campaign "${campaign.name}" from the trash`,
          entityType: "campaign",
          entityId: id,
        });
        return;
      }
      if (kind === "list") {
        const list = await db.query.contactLists.findFirst({
          where: and(eq(contactLists.id, id), isNotNull(contactLists.deletedAt)),
        });
        if (!list) throw new DomainError("not_found", "That list isn't in the trash.");
        await db.update(contactLists).set({ deletedAt: null, deletedById: null }).where(eq(contactLists.id, id));
        await writeAudit(db, actor, {
          action: "list.restored",
          summary: `${actor.email} restored list "${list.name}" from the trash`,
          entityType: "list",
          entityId: id,
        });
        return;
      }
      const contact = await db.query.contacts.findFirst({ where: and(eq(contacts.id, id), isNotNull(contacts.deletedAt)) });
      if (!contact) throw new DomainError("not_found", "That contact isn't in the trash.");
      const list = await db.query.contactLists.findFirst({ where: eq(contactLists.id, contact.listId) });
      if (!list || list.deletedAt) throw new DomainError("list_trashed", "Restore the contact's list first.");
      const duplicate = await db.query.contacts.findFirst({
        where: and(eq(contacts.listId, contact.listId), eq(contacts.email, contact.email), isNull(contacts.deletedAt)),
      });
      if (duplicate) throw new DomainError("duplicate", `${contact.email} is already back in "${list.name}".`);
      await db.update(contacts).set({ deletedAt: null, deletedById: null }).where(eq(contacts.id, id));
      await writeAudit(db, actor, {
        action: "contact.restored",
        summary: `${actor.email} restored ${contact.email} to "${list.name}"`,
        entityType: "contact",
        entityId: id,
      });
    },

    /** Deletes one trashed item permanently. */
    async purge(actor: Actor, kind: TrashKind, id: string): Promise<void> {
      requirePermission(actor, "trash.purge");
      const removed =
        kind === "campaign"
          ? await purgeCampaigns([id])
          : kind === "contact"
            ? await purgeContacts([id])
            : await purgeLists([id]);
      if (!removed) {
        if (kind === "list") {
          const inUse = await db.query.campaigns.findFirst({ where: eq(campaigns.listId, id) });
          if (inUse)
            throw new DomainError(
              "in_use",
              `This list is still used by the campaign "${inUse.name}". Delete that campaign permanently first.`,
            );
        }
        throw new DomainError("not_found", `That ${purgeLabel[kind]} isn't in the trash.`);
      }
      await writeAudit(db, actor, {
        action: `${kind}.purged`,
        summary: `${actor.email} permanently deleted a ${purgeLabel[kind]} from the trash`,
        entityType: kind,
        entityId: id,
      });
    },

    /** Permanently deletes everything in the trash (campaigns first, then contacts, then lists). */
    async empty(actor: Actor): Promise<{ campaigns: number; contacts: number; lists: number }> {
      requirePermission(actor, "trash.purge");
      const result = await purgeEverything();
      await writeAudit(db, actor, {
        action: "trash.emptied",
        summary: `${actor.email} emptied the trash (${result.campaigns} campaigns, ${result.lists} lists, ${result.contacts} contacts)`,
        metadata: result,
      });
      return result;
    },

    /** Worker job: permanently deletes items trashed more than TRASH_RETENTION_DAYS ago. */
    async purgeExpired(): Promise<{ campaigns: number; contacts: number; lists: number }> {
      const cutoff = new Date(ctx.now().getTime() - TRASH_RETENTION_DAYS * 86_400_000);
      const result = await purgeEverything(cutoff);
      if (result.campaigns + result.contacts + result.lists > 0) {
        await writeAudit(db, null, {
          action: "trash.auto_purged",
          summary: `Automatically deleted items older than ${TRASH_RETENTION_DAYS} days from the trash (${result.campaigns} campaigns, ${result.lists} lists, ${result.contacts} contacts)`,
          metadata: result,
        });
      }
      return result;
    },
  };

  async function purgeEverything(olderThan?: Date) {
    const before = <T extends typeof campaigns.deletedAt | typeof contacts.deletedAt | typeof contactLists.deletedAt>(
      column: T,
    ) => (olderThan ? lt(column, olderThan) : isNotNull(column));
    const campaignIds = (await db.select({ id: campaigns.id }).from(campaigns).where(before(campaigns.deletedAt))).map(
      (r) => r.id,
    );
    const purgedCampaigns = await purgeCampaigns(campaignIds);
    const contactIds = (await db.select({ id: contacts.id }).from(contacts).where(before(contacts.deletedAt))).map((r) => r.id);
    let purgedContacts = 0;
    for (let i = 0; i < contactIds.length; i += 5000) purgedContacts += await purgeContacts(contactIds.slice(i, i + 5000));
    const listIds = (await db.select({ id: contactLists.id }).from(contactLists).where(before(contactLists.deletedAt))).map(
      (r) => r.id,
    );
    const purgedLists = await purgeLists(listIds);
    return { campaigns: purgedCampaigns, contacts: purgedContacts, lists: purgedLists };
  }
}

export type TrashService = ReturnType<typeof createTrashService>;
