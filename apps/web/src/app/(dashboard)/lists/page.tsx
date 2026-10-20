import { can } from "@pawpost/engine/permissions";
import { BookOpenIcon, Trash2Icon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListRowActions, NewListButton } from "@/features/lists/list-index-actions";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import { engine } from "@/server/engine";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "Contact lists" };

const MAX_CAMPAIGN_BADGES = 2;
const MAX_FIELD_NAMES = 3;

export default async function ListsPage({ searchParams }: PageProps<"/lists">) {
  const { user } = await requireSession();
  const { trashed } = await searchParams;
  const lists = await engine().lists.list();
  const canExport = can(user.role, "data.export");
  const totalContacts = lists.reduce((sum, l) => sum + l.contactCount, 0);

  return (
    <>
      <PageHeader
        title="Contact lists"
        help={{ href: "/help/contact-lists", label: "Contact lists and CSV import" }}
        description="The people you email, grouped into lists. Each campaign sends to one list."
        actions={lists.length > 0 && <NewListButton />}
      />

      {trashed && (
        <Alert>
          <Trash2Icon />
          <AlertDescription>
            List moved to the trash.{" "}
            <Link href="/trash" className="font-medium underline underline-offset-4">
              Open the trash
            </Link>{" "}
            to restore it.
          </AlertDescription>
        </Alert>
      )}

      {lists.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
            </EmptyMedia>
            <EmptyTitle>No contact lists yet</EmptyTitle>
            <EmptyDescription>
              Import a CSV of the people you want to email, or start with an empty list and add them one by one.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="flex-row justify-center gap-2">
            <NewListButton label="Create a list" />
            <Button variant="outline" asChild>
              <Link href="/help/contact-lists#preparing-your-csv-file">
                <BookOpenIcon /> CSV format
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <Card className="gap-0 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>List</TableHead>
                <TableHead className="text-right">Contacts</TableHead>
                <TableHead>Used in</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lists.map((list) => (
                <TableRow key={list.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground">
                        <UsersIcon className="size-4" />
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <Link href={`/lists/${list.id}`} className="truncate font-medium hover:underline">
                          {list.name}
                        </Link>
                        <span className="truncate text-xs text-muted-foreground">{describeFields(list.attributeColumns)}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {list.contactCount > 0 ? (
                      formatNumber(list.contactCount)
                    ) : (
                      <span className="text-muted-foreground">Empty</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {list.campaigns.length === 0 ? (
                      <span className="text-sm text-muted-foreground">No campaigns</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        {list.campaigns.slice(0, MAX_CAMPAIGN_BADGES).map((c) => (
                          <Badge key={c.id} variant="secondary" asChild>
                            <Link href={`/campaigns/${c.id}`}>{c.name}</Link>
                          </Badge>
                        ))}
                        {list.campaigns.length > MAX_CAMPAIGN_BADGES && (
                          <span className="text-xs text-muted-foreground">
                            +{list.campaigns.length - MAX_CAMPAIGN_BADGES} more
                          </span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <time dateTime={new Date(list.createdAt).toISOString()} title={formatDateTime(list.createdAt)}>
                      {formatRelative(list.createdAt)}
                    </time>
                  </TableCell>
                  <TableCell className="text-right">
                    <ListRowActions listId={list.id} name={list.name} canExport={canExport} inUse={list.campaigns.length > 0} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="border-t px-4 py-3 text-xs text-muted-foreground">
            {formatNumber(lists.length)} {lists.length === 1 ? "list" : "lists"} · {formatNumber(totalContacts)} contacts
          </div>
        </Card>
      )}
    </>
  );
}

function describeFields(columns: string[]): string {
  if (columns.length === 0) return "Standard fields only";
  const shown = columns.slice(0, MAX_FIELD_NAMES).join(", ");
  const more = columns.length > MAX_FIELD_NAMES ? ` +${columns.length - MAX_FIELD_NAMES}` : "";
  return `${columns.length} custom ${columns.length === 1 ? "field" : "fields"}: ${shown}${more}`;
}
