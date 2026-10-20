import { PlusIcon, SendIcon, Trash2Icon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber, formatPercent } from "@/lib/format";
import { engine } from "@/server/engine";

export const metadata: Metadata = { title: "Campaigns" };

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Drafts" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
] as const;

export default async function CampaignsPage({ searchParams }: PageProps<"/campaigns">) {
  const query = await searchParams;
  const status = STATUS_TABS.find((t) => t.value === query.status)?.value ?? "all";
  const [campaigns, counts] = await Promise.all([
    engine().campaigns.list({ status: status === "all" ? undefined : status }),
    engine().campaigns.statusCounts(),
  ]);

  return (
    <>
      <PageHeader
        title="Campaigns"
        help={{ href: "/help/campaigns", label: "Creating and running campaigns" }}
        description="Sequences of plain-text emails sent from your mailboxes."
        actions={
          <Button asChild>
            <Link href="/campaigns/new">
              <PlusIcon /> New campaign
            </Link>
          </Button>
        }
      />

      {query.trashed && (
        <Alert>
          <Trash2Icon />
          <AlertDescription>
            Campaign moved to the trash.{" "}
            <Link href="/trash" className="font-medium underline underline-offset-4">
              Open the trash
            </Link>{" "}
            to restore it.
          </AlertDescription>
        </Alert>
      )}

      {counts.all > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {STATUS_TABS.map((t) => (
            <Button key={t.value} size="sm" variant={status === t.value ? "default" : "outline"} asChild>
              <Link href={t.value === "all" ? "/campaigns" : `/campaigns?status=${t.value}`}>
                {t.label} <span className="tabular-nums opacity-70">{counts[t.value]}</span>
              </Link>
            </Button>
          ))}
        </div>
      )}

      {campaigns.length === 0 && counts.all > 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No campaigns with this status.</p>
      ) : campaigns.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SendIcon />
            </EmptyMedia>
            <EmptyTitle>No campaigns yet</EmptyTitle>
            <EmptyDescription>Create one from an imported contact list. It stays a draft until you start it.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/campaigns/new">Create a campaign</Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <Card className="gap-0 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-44">Progress</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Replies</TableHead>
                <TableHead className="text-right">Bounces</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => {
                const finished = c.stats.enrolled - c.stats.byStatus.active - c.stats.byStatus.sending;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground">
                          <SendIcon className="size-4" />
                        </span>
                        <div className="flex min-w-0 flex-col">
                          <Link href={`/campaigns/${c.id}`} className="truncate font-medium hover:underline">
                            {c.name}
                          </Link>
                          <span className="truncate text-xs text-muted-foreground">{c.listName}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    <TableCell>
                      {c.stats.enrolled > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {formatNumber(finished)} / {formatNumber(c.stats.enrolled)} done
                          </span>
                          <Progress value={(finished / c.stats.enrolled) * 100} className="h-1.5" />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not started</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(c.stats.emailsSent)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(c.stats.replies)}
                      <div className="text-xs text-muted-foreground">{formatPercent(c.stats.replies, c.stats.enrolled)}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(c.stats.bounces)}
                      <div className="text-xs text-muted-foreground">{formatPercent(c.stats.bounces, c.stats.attempts)}</div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="border-t px-4 py-3 text-xs text-muted-foreground">
            {formatNumber(campaigns.length)} {campaigns.length === 1 ? "campaign" : "campaigns"}
            {status !== "all" ? ` · ${status}` : ""}
          </div>
        </Card>
      )}
    </>
  );
}
