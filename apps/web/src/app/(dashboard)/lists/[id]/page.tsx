import { isDomainError } from "@pawpost/engine";
import { can } from "@pawpost/engine/permissions";
import { SearchIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ContactsTable } from "@/features/lists/contacts-table";
import { ListActions } from "@/features/lists/list-actions";
import { formatNumber } from "@/lib/format";
import { engine } from "@/server/engine";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "Contact list" };

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "suppressed", label: "Suppressed" },
] as const;

export default async function ListPage({ params, searchParams }: PageProps<"/lists/[id]">) {
  const { user } = await requireSession();
  const { id } = await params;
  const query = await searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const status = STATUS_FILTERS.find((f) => f.value === query.status)?.value ?? "all";
  const search = str(query.q) ?? "";

  const list = await engine()
    .lists.get(id)
    .catch((error: unknown) => {
      if (isDomainError(error)) notFound();
      throw error;
    });
  const [contacts, allLists] = await Promise.all([
    engine().lists.contacts(id, { page: Number(query.page) || 1, search, sort: str(query.sort), dir: str(query.dir), status }),
    engine().lists.list(),
  ]);

  const baseParams = { ...(search ? { q: search } : {}), sort: contacts.sort, dir: contacts.dir };
  const href = (p: number) =>
    `/lists/${id}?${new URLSearchParams({ ...baseParams, ...(status !== "all" ? { status } : {}), page: String(p) })}`;
  const statusHref = (s: string) =>
    `/lists/${id}?${new URLSearchParams({ ...baseParams, ...(s !== "all" ? { status: s } : {}) })}`;

  return (
    <>
      <PageHeader
        title={list.name}
        description={`${formatNumber(list.contactCount)} contacts${list.attributeColumns.length ? ` · custom fields: ${list.attributeColumns.join(", ")}` : ""}`}
        breadcrumbs={[{ label: "Contact lists", href: "/lists" }, { label: list.name }]}
        help={{ href: "/help/managing-data", label: "Managing contacts" }}
        actions={
          <ListActions
            listId={id}
            name={list.name}
            attributeColumns={list.attributeColumns}
            canExport={can(user.role, "data.export")}
          />
        }
      />

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>Contacts</CardTitle>
            <CardDescription>{formatNumber(contacts.total)} matching</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-2" role="group" aria-label="Filter by status">
              {STATUS_FILTERS.map((f) => (
                <Button key={f.value} size="sm" variant={status === f.value ? "default" : "outline"} asChild>
                  <Link href={statusHref(f.value)}>{f.label}</Link>
                </Button>
              ))}
            </div>
            <form className="relative w-full sm:w-64">
              {status !== "all" && <input type="hidden" name="status" value={status} />}
              <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                name="q"
                defaultValue={search}
                placeholder="Search name, email, company"
                className="pl-8"
                aria-label="Search contacts"
              />
            </form>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-0">
          <ContactsTable>
            listId={id}
            rows={contacts.rows.map((c) => ({
              id: c.id,
              email: c.email,
              firstName: c.firstName,
              lastName: c.lastName,
              company: c.company,
              attributes: c.attributes,
              suppressed: c.suppressed,
            }))}
            otherLists={allLists.filter((l) => l.id !== id).map((l) => ({ id: l.id, name: l.name }))}
            attributeColumns={list.attributeColumns}
            sort={contacts.sort}
            dir={contacts.dir}
            emptyText={
              list.contactCount === 0 ? "No contacts yet. Use Add contact for one person, or Import CSV for many." : undefined
            }
          />
          <Pagination
            page={contacts.page}
            pageSize={contacts.pageSize}
            total={contacts.total}
            hrefFor={href}
            className="border-t px-(--card-spacing) pt-4"
          />
        </CardContent>
      </Card>
    </>
  );
}
