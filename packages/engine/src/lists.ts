import { CsvFormatError, DomainError, emailDomain, parseContactsCsv, type RejectReason } from "@pawpost/core";
import { campaigns, contactLists, contacts, suppressions, type ContactList } from "@pawpost/db";
import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";

import type { EngineContext } from "./context";
import { importContactsInput, listInput } from "./validation";

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

const INSERT_CHUNK = 1000;

export function createListService(ctx: EngineContext) {
  const { db } = ctx;

  async function find(id: string): Promise<ContactList> {
    const list = await db.query.contactLists.findFirst({ where: eq(contactLists.id, id) });
    if (!list) throw new DomainError("not_found", "List not found.");
    return list;
  }

  return {
    async list(): Promise<ListSummary[]> {
      const rows = await db
        .select({ list: contactLists, contactCount: count(contacts.id) })
        .from(contactLists)
        .leftJoin(contacts, eq(contacts.listId, contactLists.id))
        .groupBy(contactLists.id)
        .orderBy(desc(contactLists.createdAt));
      return rows.map((r) => ({ ...r.list, contactCount: r.contactCount }));
    },

    async get(id: string): Promise<ListSummary> {
      const list = await find(id);
      const [row] = await db.select({ n: count() }).from(contacts).where(eq(contacts.listId, id));
      return { ...list, contactCount: row?.n ?? 0 };
    },

    async create(raw: unknown): Promise<ContactList> {
      const { name } = listInput.parse(raw);
      const [list] = await db.insert(contactLists).values({ name }).returning();
      return list!;
    },

    async rename(id: string, raw: unknown): Promise<void> {
      const { name } = listInput.parse(raw);
      await find(id);
      await db.update(contactLists).set({ name }).where(eq(contactLists.id, id));
    },

    async remove(id: string): Promise<void> {
      await find(id);
      const [used] = await db.select({ n: count() }).from(campaigns).where(eq(campaigns.listId, id));
      if (used && used.n > 0) {
        throw new DomainError("in_use", "This list is used by a campaign. Delete the campaign first.");
      }
      await db.delete(contactLists).where(eq(contactLists.id, id));
    },

    async contacts(listId: string, options: { page?: number; pageSize?: number; search?: string } = {}) {
      const pageSize = Math.min(options.pageSize ?? 50, 200);
      const page = Math.max(options.page ?? 1, 1);
      const search = options.search?.trim();
      const where = search
        ? and(
            eq(contacts.listId, listId),
            or(
              ilike(contacts.email, `%${search}%`),
              ilike(contacts.firstName, `%${search}%`),
              ilike(contacts.lastName, `%${search}%`),
            ),
          )
        : eq(contacts.listId, listId);

      const [rows, [total]] = await Promise.all([
        db
          .select({
            contact: contacts,
            suppressed: sql<boolean>`exists (select 1 from ${suppressions} where ${suppressions.email} = ${contacts.email})`,
          })
          .from(contacts)
          .where(where)
          .orderBy(contacts.email)
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db.select({ n: count() }).from(contacts).where(where),
      ]);
      return {
        rows: rows.map((r) => ({ ...r.contact, suppressed: r.suppressed })),
        total: total?.n ?? 0,
        page,
        pageSize,
      };
    },

    /**
     * Imports a CSV into a list. Rows are rejected (never silently dropped) when the
     * address is malformed, duplicated, a role inbox, on the suppression list, or on
     * a domain that cannot receive mail.
     */
    async importCsv(listId: string, csvText: string, rawOptions: unknown = {}): Promise<ImportReport> {
      const options = importContactsInput.parse(rawOptions);
      const list = await find(listId);

      let parsed;
      try {
        parsed = parseContactsCsv(csvText, { skipRoleAddresses: options.skipRoleAddresses });
      } catch (error) {
        if (error instanceof CsvFormatError) throw new DomainError("invalid_csv", error.message);
        throw error;
      }

      const rejected: ImportReport["rejectedSample"] = parsed.rejected.map((r) => ({ ...r }));
      let candidates = parsed.contacts;

      // Suppressed addresses never enter a list.
      const suppressed = new Set<string>();
      for (const chunk of chunks(
        candidates.map((c) => c.email),
        INSERT_CHUNK,
      )) {
        const rows = await db.select({ email: suppressions.email }).from(suppressions).where(inArray(suppressions.email, chunk));
        rows.forEach((r) => suppressed.add(r.email));
      }

      const domainStatus = options.checkDomains
        ? await ctx.checkDomains(candidates.map((c) => emailDomain(c.email)))
        : new Map<string, string>();

      candidates = candidates.filter((c) => {
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

      let imported = 0;
      for (const chunk of chunks(candidates, INSERT_CHUNK)) {
        const inserted = await db
          .insert(contacts)
          .values(chunk.map(({ line: _line, ...c }) => ({ ...c, listId })))
          .onConflictDoNothing({ target: [contacts.listId, contacts.email] })
          .returning({ id: contacts.id });
        imported += inserted.length;
      }

      const attributeColumns = [...new Set([...list.attributeColumns, ...parsed.attributeColumns])];
      await db.update(contactLists).set({ attributeColumns }).where(eq(contactLists.id, listId));

      const counts = Object.fromEntries(
        (["invalid_email", "duplicate", "role_address", "missing_email", "suppressed", "no_mail_domain"] as const).map((r) => [
          r,
          rejected.filter((x) => x.reason === r).length,
        ]),
      ) as Record<ImportRejectReason, number>;

      const report: ImportReport = {
        listId,
        totalRows: parsed.contacts.length + parsed.rejected.length,
        imported,
        alreadyInList: candidates.length - imported,
        rejected: counts,
        rejectedSample: rejected.sort((a, b) => a.line - b.line).slice(0, 50),
        attributeColumns,
      };
      ctx.logger.info("contacts imported", { listId, imported, rejected: rejected.length });
      return report;
    },
  };
}

export type ListService = ReturnType<typeof createListService>;

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
