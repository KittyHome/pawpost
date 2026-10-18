import { isDomainError } from "@pawpost/engine";
import { SearchIcon, Trash2Icon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ActionButton } from "@/components/action-button";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteList } from "@/features/lists/actions";
import { ImportForm } from "@/features/lists/import-form";
import { formatNumber } from "@/lib/format";
import { engine } from "@/server/engine";

export const metadata: Metadata = { title: "Contact list" };

export default async function ListPage({ params, searchParams }: PageProps<"/lists/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const page = Number(query.page) || 1;
  const search = typeof query.q === "string" ? query.q : "";

  const list = await engine()
    .lists.get(id)
    .catch((error: unknown) => {
      if (isDomainError(error)) notFound();
      throw error;
    });
  const contacts = await engine().lists.contacts(id, { page, search });
  const href = (p: number) => `/lists/${id}?${new URLSearchParams({ ...(search ? { q: search } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader
        title={list.name}
        description={`${formatNumber(list.contactCount)} contacts${list.attributeColumns.length ? ` · extra fields: ${list.attributeColumns.join(", ")}` : ""}`}
        help={{ href: "/help/contact-lists", label: "Contact lists and CSV import" }}
        breadcrumbs={[{ label: "Contact lists", href: "/lists" }, { label: list.name }]}
        actions={
          <>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">Import more</Button>
              </SheetTrigger>
              <SheetContent className="overflow-y-auto sm:max-w-lg">
                <SheetHeader>
                  <SheetTitle>Import into {list.name}</SheetTitle>
                  <SheetDescription>Addresses already in this list are skipped.</SheetDescription>
                </SheetHeader>
                <div className="px-4 pb-4">
                  <ImportForm listId={id} />
                </div>
              </SheetContent>
            </Sheet>
            <ActionButton
              variant="outline"
              action={deleteList.bind(null, id)}
              confirm={{
                title: `Delete "${list.name}"?`,
                description: "All contacts in this list are removed. Lists used by a campaign can't be deleted.",
                confirmLabel: "Delete list",
                destructive: true,
              }}
            >
              <Trash2Icon /> Delete
            </ActionButton>
          </>
        }
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>Contacts</CardTitle>
            <CardDescription>{formatNumber(contacts.total)} matching</CardDescription>
          </div>
          <form className="relative w-full max-w-xs">
            <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              name="q"
              defaultValue={search}
              placeholder="Search name or email"
              className="pl-8"
              aria-label="Search contacts"
            />
          </form>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.email}</TableCell>
                  <TableCell>
                    {[c.firstName, c.lastName].filter(Boolean).join(" ") || <span className="text-muted-foreground">–</span>}
                  </TableCell>
                  <TableCell>{c.company ?? <span className="text-muted-foreground">–</span>}</TableCell>
                  <TableCell>{c.suppressed ? <StatusBadge status="suppressed" /> : <StatusBadge status="active" />}</TableCell>
                </TableRow>
              ))}
              {contacts.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    No contacts match.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination page={contacts.page} pageSize={contacts.pageSize} total={contacts.total} hrefFor={href} />
        </CardContent>
      </Card>
    </>
  );
}
