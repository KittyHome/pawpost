import { can } from "@pawpost/engine/permissions";
import { DownloadIcon } from "lucide-react";
import type { Metadata } from "next";

import { NoAccess } from "@/components/no-access";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AUDIT_AREAS } from "@/features/audit/areas";
import { AuditFilters } from "@/features/audit/audit-filters";
import { formatDateTime } from "@/lib/format";
import { engine } from "@/server/engine";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditLogPage({ searchParams }: PageProps<"/settings/audit">) {
  const { user } = await requireSession();
  if (!can(user.role, "audit.view")) return <NoAccess what="the audit log" />;

  const query = await searchParams;
  const action = AUDIT_AREAS.find((a) => a.value === query.action)?.value;
  const actorId = typeof query.user === "string" ? query.user : undefined;
  const page = Number(query.page) || 1;

  const [log, users] = await Promise.all([engine().audit.list({ action, actorId, page }), engine().accounts.listUsers()]);
  const filterParams = new URLSearchParams({ ...(action ? { action } : {}), ...(actorId ? { user: actorId } : {}) });
  const href = (p: number) => `/settings/audit?${new URLSearchParams({ ...Object.fromEntries(filterParams), page: String(p) })}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit log</CardTitle>
        <CardDescription>Who did what, and when. Entries can&apos;t be edited or deleted.</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/export/audit?${filterParams}`} download>
              <DownloadIcon /> Export CSV
            </a>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <AuditFilters users={users.map((u) => ({ id: u.id, label: `${u.name} (${u.email})` }))} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">When</TableHead>
              <TableHead className="w-48">Who</TableHead>
              <TableHead>What</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {log.rows.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="align-top text-sm whitespace-nowrap text-muted-foreground">
                  {formatDateTime(entry.createdAt)}
                </TableCell>
                <TableCell className="align-top text-sm">
                  <div className="flex flex-col">
                    <span className="truncate">{entry.actorEmail ?? "System"}</span>
                    {entry.ipAddress && <span className="text-xs text-muted-foreground">{entry.ipAddress}</span>}
                  </div>
                </TableCell>
                <TableCell className="align-top text-sm whitespace-normal">
                  <div className="flex flex-col gap-0.5">
                    <span>{entry.summary}</span>
                    <span className="font-mono text-xs text-muted-foreground">{entry.action}</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {log.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                  No activity matches these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <Pagination page={log.page} pageSize={log.pageSize} total={log.total} hrefFor={href} />
      </CardContent>
    </Card>
  );
}
