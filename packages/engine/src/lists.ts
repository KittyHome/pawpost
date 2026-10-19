import {
  CsvFormatError,
  DomainError,
  emailDomain,
  isValidEmail,
  parseContactsCsv,
  toCsv,
  type ParsedContact,
  type RejectReason,
} from "@pawpost/core";
import {
  campaigns,
  contactLists,
  contacts,
  liveContactPredicate,
  suppressions,
  type Contact,
  type ContactList,
  type Executor,
} from "@pawpost/db";
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";

import { writeAudit } from "./audit";
import type { Actor, EngineContext } from "./context";
import { requirePermission } from "./guard";
import { suppressEmail } from "./suppressions";
import {
  contactInput,
  contactSort,
  importContactsInput,
  listInput,
  sortDirection,
  type ImportContactsOptions,
} from "./validation";

export type ImportRejectReason = RejectReason | "suppressed" | "no_mail_domain";

export interface ImportReport {
  listId: string;
  totalRows: number;
  imported: number;
  /** Already in this list from an earlier import. */
  alreadyInList: number;
  rejected: Record<ImportRejectReason, number>;
  /** First rejected rows, for display. */
  rejectedSample: { line: number; email: string; reason: ImportRejectReason }[];
  attributeColumns: string[];
}

export interface ListSummary extends ContactList {
  contactCount: number;
}

export interface ContactQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  /** "email" | "name" | "company" | "created" */
  sort?: string;
  dir?: string;
  status?: "all" | "active" | "suppressed";
}

export interface BulkResult {
  affected: number;
  skipped: number;
}

const INSERT_CHUNK = 1000;
/**
 * Whether a contact's address is suppressed. The outer column is written out in
 * full: in a select list Drizzle renders columns unqualified, and a bare "email"
 * inside the subquery would resolve to suppressions.email instead.
 */
const isSuppressed = sql<boolean>`exists (select 1 from suppressions s where s.email = "contacts"."email")`;

export function createListService(ctx: EngineContext) {
  const { db } = ctx;

  async function find(id: string, executor: Executor = db): Promise<ContactList> {
    const list = await executor.query.contactLists.findFirst({
      where: and(eq(contactLists.id, id), isNull(contactLists.deletedAt)),
    });
    if (!list) throw new DomainError("not_found", "List not found.");
    return list;
  }

  async function findContact(id: string): Promise<Contact> {
    const contact = await db.query.contacts.findFirst({ where: and(eq(contacts.id, id), isNull(contacts.deletedAt)) });
    if (!contact) throw new DomainError("not_found", "Contact not found.");
    return contact;
  }

  /** Live contacts among `ids`, restricted to live lists. */
  async function liveContacts(ids: string[]): Promise<Contact[]> {
    if (!ids.length) return [];
    return db
      .select({ contact: contacts })
      .from(contacts)
      .innerJoin(contactLists, eq(contactLists.id, contacts.listId))
      .where(and(inArray(contacts.id, ids.slice(0, 5000)), isNull(contacts.deletedAt), isNull(contactLists.deletedAt)))
      .then((rows) => rows.map((r) => r.contact));
  }

  return {
    async list(): Promise<ListSummary[]> {
      const rows = await db
        .select({ list: contactLists, contactCount: count(contacts.id) })
        .from(contactLists)
        .leftJoin(contacts, and(eq(contacts.listId, contactLists.id), isNull(contacts.deletedAt)))
        .where(isNull(contactLists.deletedAt))
        .groupBy(contactLists.id)
        .orderBy(desc(contactLists.createdAt));
      return rows.map((r) => ({ ...r.list, contactCount: r.contactCount }));
    },

    async get(id: string): Promise<ListSummary> {
      const list = await find(id);
      const [row] = await db
        .select({ n: count() })
        .from(contacts)
        .where(and(eq(contacts.listId, id), isNull(contacts.deletedAt)));
      return { ...list, contactCount: row?.n ?? 0 };
    },

    async rename(actor: Actor, id: string, raw: unknown): Promise<void> {
      const { name } = listInput.parse(raw);
      const list = await find(id);
      await db.transaction(async (tx) => {
        await tx.update(contactLists).set({ name }).where(eq(contactLists.id, id));
        await writeAudit(tx, actor, {
          action: "list.renamed",
          summary: `${actor.email} renamed list "${list.name}" to "${name}"`,
          entityType: "list",
          entityId: id,
        });
      });
    },

    /** Moves a list to the trash. Lists used by a campaign can't be trashed. */
    async trash(actor: Actor, id: string): Promise<void> {
      const list = await find(id);
      const [used] = await db
        .select({ n: count() })
        .from(campaigns)
        .where(and(eq(campaigns.listId, id), isNull(campaigns.deletedAt)));
      if (used && used.n > 0) {
        throw new DomainError("in_use", "This list is used by a campaign. Delete the campaign first.");
      }
      await db.transaction(async (tx) => {
        await tx.update(contactLists).set({ deletedAt: ctx.now(), deletedById: actor.id }).where(eq(contactLists.id, id));
        await writeAudit(tx, actor, {
          action: "list.trashed",
          summary: `${actor.email} moved list "${list.name}" to the trash`,
          entityType: "list",
          entityId: id,
        });
      });
    },

    async contacts(listId: string, query: ContactQuery = {}) {
      const pageSize = Math.min(query.pageSize ?? 50, 200);
      const page = Math.max(query.page ?? 1, 1);
      const search = query.search?.trim();
      const conditions: (SQL | undefined)[] = [eq(contacts.listId, listId), isNull(contacts.deletedAt)];
      if (search) {
        const term = `%${search.replace(/[%_]/g, "")}%`;
        conditions.push(
          or(
            ilike(contacts.email, term),
            ilike(contacts.firstName, term),
            ilike(contacts.lastName, term),
            ilike(contacts.company, term),
          ),
        );
      }
      if (query.status === "suppressed") conditions.push(isSuppressed);
      if (query.status === "active") conditions.push(sql`not ${isSuppressed}`);
      const where = and(...conditions);

      const sort = contactSort.parse(query.sort);
      const dir = sortDirection.parse(query.dir) === "desc" ? desc : asc;
      const order = {
        email: [dir(contacts.email)],
        name: [
          sql`${contacts.firstName} ${sql.raw(dir === desc ? "desc" : "asc")} nulls last`,
          dir(contacts.lastName),
          asc(contacts.email),
        ],
        company: [sql`${contacts.company} ${sql.raw(dir === desc ? "desc" : "asc")} nulls last`, asc(contacts.email)],
        created: [dir(contacts.createdAt), asc(contacts.email)],
      }[sort];

      const [rows, [total]] = await Promise.all([
        db
          .select({ contact: contacts, suppressed: isSuppressed })
          .from(contacts)
          .where(where)
          .orderBy(...order)
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db.select({ n: count() }).from(contacts).where(where),
      ]);
      return {
        rows: rows.map((r) => ({ ...r.contact, suppressed: r.suppressed })),
        total: total?.n ?? 0,
        page,
        pageSize,
        sort,
        dir: dir === desc ? ("desc" as const) : ("asc" as const),
      };
    },

    getContact: findContact,

    async addContact(actor: Actor, listId: string, raw: unknown): Promise<Contact> {
      const input = contactInput.parse(raw);
      const list = await find(listId);
      if (!isValidEmail(input.email)) throw new DomainError("validation", "Enter a valid email address.");
      const suppressed = await db.query.suppressions.findFirst({ where: eq(suppressions.email, input.email) });
      if (suppressed) throw new DomainError("suppressed", `${input.email} is on the suppression list and can't be added.`);

      return db.transaction(async (tx) => {
        const [contact] = await tx
          .insert(contacts)
          .values({ ...input, listId })
          .onConflictDoNothing({ target: [contacts.listId, contacts.email], where: liveContactPredicate })
          .returning();
        if (!contact) throw new DomainError("duplicate", `${input.email} is already in this list.`);
        const newColumns = Object.keys(input.attributes).filter((k) => !list.attributeColumns.includes(k));
        if (newColumns.length) {
          await tx
            .update(contactLists)
            .set({ attributeColumns: [...list.attributeColumns, ...newColumns] })
            .where(eq(contactLists.id, listId));
        }
        await writeAudit(tx, actor, {
          action: "contact.created",
          summary: `${actor.email} added ${input.email} to "${list.name}"`,
          entityType: "contact",
          entityId: contact.id,
        });
        return contact;
      });
    },

    async updateContact(actor: Actor, id: string, raw: unknown): Promise<Contact> {
      const input = contactInput.parse(raw);
      const current = await findContact(id);
      const list = await find(current.listId);
      if (!isValidEmail(input.email)) throw new DomainError("validation", "Enter a valid email address.");
      if (input.email !== current.email) {
        const clash = await db.query.contacts.findFirst({
          where: and(eq(contacts.listId, current.listId), eq(contacts.email, input.email), isNull(contacts.deletedAt)),
        });
        if (clash) throw new DomainError("duplicate", `${input.email} is already in this list.`);
      }
      return db.transaction(async (tx) => {
        const [contact] = await tx.update(contacts).set(input).where(eq(contacts.id, id)).returning();
        const newColumns = Object.keys(input.attributes).filter((k) => !list.attributeColumns.includes(k));
        if (newColumns.length) {
          await tx
            .update(contactLists)
            .set({ attributeColumns: [...list.attributeColumns, ...newColumns] })
            .where(eq(contactLists.id, list.id));
        }
        await writeAudit(tx, actor, {
          action: "contact.updated",
          summary: `${actor.email} edited contact ${input.email}`,
          entityType: "contact",
          entityId: id,
          metadata: input.email !== current.email ? { previousEmail: current.email } : {},
        });
        return contact!;
      });
    },

    /** Moves contacts to the trash. Their running sequences pause until they're restored. */
    async trashContacts(actor: Actor, ids: string[]): Promise<BulkResult> {
      const targets = await liveContacts(ids);
      if (!targets.length) return { affected: 0, skipped: ids.length };
      await db.transaction(async (tx) => {
        await tx
          .update(contacts)
          .set({ deletedAt: ctx.now(), deletedById: actor.id })
          .where(
            inArray(
              contacts.id,
              targets.map((c) => c.id),
            ),
          );
        await writeAudit(tx, actor, {
          action: "contact.trashed",
          summary: `${actor.email} moved ${describeContacts(targets)} to the trash`,
          entityType: "contact",
          entityId: targets.length === 1 ? targets[0]!.id : undefined,
          metadata: { count: targets.length },
        });
      });
      return { affected: targets.length, skipped: ids.length - targets.length };
    },

    /** Moves contacts to another list. Anyone already in the target list stays where they are. */
    async moveContacts(actor: Actor, ids: string[], targetListId: string): Promise<BulkResult> {
      const target = await find(targetListId);
      const candidates = (await liveContacts(ids)).filter((c) => c.listId !== targetListId);
      if (!candidates.length) return { affected: 0, skipped: ids.length };
      return db.transaction(async (tx) => {
        const existing = await tx
          .select({ email: contacts.email })
          .from(contacts)
          .where(
            and(
              eq(contacts.listId, targetListId),
              isNull(contacts.deletedAt),
              inArray(
                contacts.email,
                candidates.map((c) => c.email),
              ),
            ),
          );
        const taken = new Set(existing.map((e) => e.email));
        const movable = candidates.filter((c) => !taken.has(c.email));
        if (movable.length) {
          await tx
            .update(contacts)
            .set({ listId: targetListId })
            .where(
              inArray(
                contacts.id,
                movable.map((c) => c.id),
              ),
            );
          await mergeAttributeColumns(tx, target, movable);
          await writeAudit(tx, actor, {
            action: "contact.moved",
            summary: `${actor.email} moved ${describeContacts(movable)} to "${target.name}"`,
            entityType: "list",
            entityId: targetListId,
            metadata: { count: movable.length },
          });
        }
        return { affected: movable.length, skipped: ids.length - movable.length };
      });
    },

    /** Copies contacts into another list, skipping addresses already there. */
    async copyContacts(actor: Actor, ids: string[], targetListId: string): Promise<BulkResult> {
      const target = await find(targetListId);
      const sources = await liveContacts(ids);
      return db.transaction(async (tx) => {
        let copied = 0;
        for (const chunk of chunks(sources, INSERT_CHUNK)) {
          const inserted = await tx
            .insert(contacts)
            .values(
              chunk.map((c) => ({
                listId: targetListId,
                email: c.email,
                firstName: c.firstName,
                lastName: c.lastName,
                company: c.company,
                attributes: c.attributes,
              })),
            )
            .onConflictDoNothing({ target: [contacts.listId, contacts.email], where: liveContactPredicate })
            .returning({ id: contacts.id });
          copied += inserted.length;
        }
        if (copied) {
          await mergeAttributeColumns(tx, target, sources);
          await writeAudit(tx, actor, {
            action: "contact.copied",
            summary: `${actor.email} copied ${copied} contact(s) to "${target.name}"`,
            entityType: "list",
            entityId: targetListId,
            metadata: { count: copied },
          });
        }
        return { affected: copied, skipped: ids.length - copied };
      });
    },

    /** Adds the contacts' addresses to the suppression list, stopping any running sequences. */
    async suppressContacts(actor: Actor, ids: string[]): Promise<BulkResult> {
      const targets = await liveContacts(ids);
      return db.transaction(async (tx) => {
        let added = 0;
        for (const contact of targets) {
          if ((await suppressEmail(tx, contact.email, "manual", `suppressed by ${actor.email}`)).added) added++;
        }
        if (added) {
          await writeAudit(tx, actor, {
            action: "suppression.added",
            summary: `${actor.email} suppressed ${added === 1 ? targets[0]!.email : `${added} contacts`}`,
            entityType: "contact",
            metadata: { count: added },
          });
        }
        return { affected: added, skipped: ids.length - added };
      });
    },

    async exportCsv(actor: Actor, listId: string): Promise<{ filename: string; csv: string }> {
      requirePermission(actor, "data.export");
      const list = await find(listId);
      const rows = await db
        .select({ contact: contacts, suppressed: isSuppressed })
        .from(contacts)
        .where(and(eq(contacts.listId, listId), isNull(contacts.deletedAt)))
        .orderBy(asc(contacts.email));
      const csv = toCsv(rows, [
        { header: "email", value: (r) => r.contact.email },
        { header: "first_name", value: (r) => r.contact.firstName },
        { header: "last_name", value: (r) => r.contact.lastName },
        { header: "company", value: (r) => r.contact.company },
        ...list.attributeColumns.map((column) => ({
          header: column,
          value: (r: (typeof rows)[number]) => r.contact.attributes[column],
        })),
        { header: "suppressed", value: (r) => (r.suppressed ? "yes" : "no") },
        { header: "added_at", value: (r) => r.contact.createdAt },
      ]);
      await writeAudit(db, actor, {
        action: "list.exported",
        summary: `${actor.email} exported list "${list.name}" (${rows.length} contacts)`,
        entityType: "list",
        entityId: listId,
      });
      return { filename: `${slugify(list.name)}-contacts.csv`, csv };
    },

    /** Creates an empty list. Contacts are added later by hand or by CSV import. */
    async create(actor: Actor, raw: unknown): Promise<ContactList> {
      const { name } = listInput.parse(raw);
      return db.transaction(async (tx) => {
        const [list] = await tx.insert(contactLists).values({ name }).returning();
        await writeAudit(tx, actor, {
          action: "list.created",
          summary: `${actor.email} created empty list "${name}"`,
          entityType: "list",
          entityId: list!.id,
        });
        return list!;
      });
    },

    /**
     * Imports a CSV into an existing list. Rows are rejected (never silently dropped)
     * when the address is malformed, duplicated, a role inbox, on the suppression list,
     * or on a domain that cannot receive mail. All rows are written in one transaction.
     */
    async importCsv(actor: Actor, listId: string, csvText: string, rawOptions: unknown = {}): Promise<ImportReport> {
      const list = await find(listId);
      const prepared = await prepareImport(csvText, importContactsInput.parse(rawOptions));
      return db.transaction(async (tx) => {
        const report = await writeImport(tx, list, prepared);
        await writeAudit(tx, actor, {
          action: "list.imported",
          summary: `${actor.email} imported ${report.imported} contact(s) into "${list.name}"`,
          entityType: "list",
          entityId: list.id,
          metadata: { imported: report.imported, totalRows: report.totalRows },
        });
        return report;
      });
    },

    /** Creates a list and imports a CSV into it atomically: on any failure, no list is left behind. */
    async createFromCsv(actor: Actor, rawName: unknown, csvText: string, rawOptions: unknown = {}): Promise<ImportReport> {
      const { name } = listInput.parse({ name: rawName });
      // Parse and check before writing anything, so a bad file never creates a list.
      const prepared = await prepareImport(csvText, importContactsInput.parse(rawOptions));
      return db.transaction(async (tx) => {
        const [list] = await tx.insert(contactLists).values({ name }).returning();
        const report = await writeImport(tx, list!, prepared);
        await writeAudit(tx, actor, {
          action: "list.created",
          summary: `${actor.email} created list "${name}" with ${report.imported} contact(s)`,
          entityType: "list",
          entityId: list!.id,
          metadata: { imported: report.imported, totalRows: report.totalRows },
        });
        return report;
      });
    },
  };

  /** Read-only part of an import: parse, then filter out suppressed and undeliverable addresses. */
  async function prepareImport(csvText: string, options: ImportContactsOptions): Promise<PreparedImport> {
    let parsed;
    try {
      parsed = parseContactsCsv(csvText, { skipRoleAddresses: options.skipRoleAddresses });
    } catch (error) {
      if (error instanceof CsvFormatError) throw new DomainError("invalid_csv", error.message);
      throw error;
    }

    const rejected: ImportReport["rejectedSample"] = parsed.rejected.map((r) => ({ ...r }));

    // Suppressed addresses never enter a list.
    const suppressed = new Set<string>();
    for (const chunk of chunks(
      parsed.contacts.map((c) => c.email),
      INSERT_CHUNK,
    )) {
      const rows = await db.select({ email: suppressions.email }).from(suppressions).where(inArray(suppressions.email, chunk));
      rows.forEach((r) => suppressed.add(r.email));
    }

    const domainStatus = options.checkDomains
      ? await ctx.checkDomains(parsed.contacts.map((c) => emailDomain(c.email)))
      : new Map<string, string>();

    const candidates = parsed.contacts.filter((c) => {
      if (suppressed.has(c.email)) {
        rejected.push({ line: c.line, email: c.email, reason: "suppressed" });
        return false;
      }
      if (domainStatus.get(emailDomain(c.email)) === "no_mail") {
        rejected.push({ line: c.line, email: c.email, reason: "no_mail_domain" });
        return false;
      }
      return true;
    });

    return {
      candidates,
      rejected,
      attributeColumns: parsed.attributeColumns,
      totalRows: parsed.contacts.length + parsed.rejected.length,
    };
  }

  async function writeImport(tx: Executor, list: ContactList, prepared: PreparedImport): Promise<ImportReport> {
    let imported = 0;
    for (const chunk of chunks(prepared.candidates, INSERT_CHUNK)) {
      const inserted = await tx
        .insert(contacts)
        .values(chunk.map(({ line: _line, ...c }) => ({ ...c, listId: list.id })))
        .onConflictDoNothing({ target: [contacts.listId, contacts.email], where: liveContactPredicate })
        .returning({ id: contacts.id });
      imported += inserted.length;
    }

    const attributeColumns = [...new Set([...list.attributeColumns, ...prepared.attributeColumns])];
    await tx.update(contactLists).set({ attributeColumns }).where(eq(contactLists.id, list.id));

    const { rejected } = prepared;
    const counts = Object.fromEntries(
      (["invalid_email", "duplicate", "role_address", "missing_email", "suppressed", "no_mail_domain"] as const).map((r) => [
        r,
        rejected.filter((x) => x.reason === r).length,
      ]),
    ) as Record<ImportRejectReason, number>;

    ctx.logger.info("contacts imported", { listId: list.id, imported, rejected: rejected.length });
    return {
      listId: list.id,
      totalRows: prepared.totalRows,
      imported,
      alreadyInList: prepared.candidates.length - imported,
      rejected: counts,
      rejectedSample: [...rejected].sort((a, b) => a.line - b.line).slice(0, 50),
      attributeColumns,
    };
  }

  async function mergeAttributeColumns(tx: Executor, list: ContactList, from: Contact[]): Promise<void> {
    const columns = new Set(list.attributeColumns);
    from.forEach((c) => Object.keys(c.attributes).forEach((k) => columns.add(k)));
    if (columns.size !== list.attributeColumns.length) {
      await tx
        .update(contactLists)
        .set({ attributeColumns: [...columns] })
        .where(eq(contactLists.id, list.id));
    }
  }
}

interface PreparedImport {
  candidates: ParsedContact[];
  rejected: ImportReport["rejectedSample"];
  attributeColumns: string[];
  totalRows: number;
}

export type ListService = ReturnType<typeof createListService>;

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function describeContacts(list: Contact[]): string {
  return list.length === 1 ? list[0]!.email : `${list.length} contacts`;
}

export function slugify(name: string): string {
  return (
    name
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "export"
  );
}
