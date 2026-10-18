import { PlusIcon, SendIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber, formatPercent } from "@/lib/format";
import { engine } from "@/server/engine";

export const metadata: Metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  const campaigns = await engine().campaigns.list();

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

      {campaigns.length === 0 ? (
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
        <Card className="py-0">
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
                      <Link href={`/campaigns/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{c.listName}</div>
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
        </Card>
      )}
    </>
  );
}
