import { can } from "@pawpost/engine/permissions";
import { DownloadIcon, SearchIcon } from "lucide-react";
import type { Metadata } from "next";

import { ActionButton } from "@/components/action-button";
import { LearnMore } from "@/components/help-link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { removeSuppression } from "@/features/suppressions/actions";
import { AddSuppressionForm } from "@/features/suppressions/add-suppression-form";
import { formatDateTime, formatNumber } from "@/lib/format";
import { engine } from "@/server/engine";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "Suppression list" };

export default async function SuppressionsPage({ searchParams }: PageProps<"/suppressions">) {
  const { user } = await requireSession();
  const canRemove = can(user.role, "suppressions.remove");
  const query = await searchParams;
  const page = Number(query.page) || 1;
  const search = typeof query.q === "string" ? query.q : "";
  const result = await engine().suppressions.list({ page, search });
  const href = (p: number) => `/suppressions?${new URLSearchParams({ ...(search ? { q: search } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader
        title="Suppression list"
        help={{ href: "/help/replies-and-bounces#the-suppression-list", label: "The suppression list" }}
        description="Addresses that are never emailed again, across every campaign. Unsubscribes and bounces are added automatically."
        actions={
          can(user.role, "data.export") ? (
            <Button variant="outline" asChild>
              <a href="/api/export/suppressions" download>
                <DownloadIcon /> Export CSV
              </a>
            </Button>
          ) : null
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Add an address</CardTitle>
          <CardDescription>
            For opt-out requests that arrive another way (phone, social media, a colleague).{" "}
            <LearnMore href="/help/replies-and-bounces#the-suppression-list">How suppression works</LearnMore>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddSuppressionForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>Suppressed addresses</CardTitle>
            <CardDescription>{formatNumber(result.total)} total</CardDescription>
          </div>
          <form className="relative w-full max-w-xs">
            <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input name="q" defaultValue={search} placeholder="Search email" className="pl-8" aria-label="Search suppressions" />
          </form>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((row) => (
                <TableRow key={row.email}>
                  <TableCell className="font-medium">{row.email}</TableCell>
                  <TableCell>
                    <StatusBadge status={row.reason} />
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">{row.note ?? "–"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateTime(row.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    {canRemove && (
                      <ActionButton
                        variant="ghost"
                        size="sm"
                        action={removeSuppression.bind(null, row.email)}
                        confirm={{
                          title: `Allow emailing ${row.email} again?`,
                          description:
                            row.reason === "unsubscribed"
                              ? "This person asked not to be contacted. Only remove them if they explicitly asked to hear from you again."
                              : "They can be enrolled in future campaigns.",
                          confirmLabel: "Remove from list",
                          destructive: row.reason === "unsubscribed",
                        }}
                      >
                        Remove
                      </ActionButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {result.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Nothing here yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination page={result.page} pageSize={result.pageSize} total={result.total} hrefFor={href} />
        </CardContent>
      </Card>
    </>
  );
}
