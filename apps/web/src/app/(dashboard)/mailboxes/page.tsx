import { InboxIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { LearnMore } from "@/components/help-link";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MailboxRowActions } from "@/features/mailboxes/mailbox-row-actions";
import { formatRelative } from "@/lib/format";
import { engine } from "@/server/engine";

export const metadata: Metadata = { title: "Mailboxes" };

export default async function MailboxesPage() {
  const mailboxes = await engine().mailboxes.list();

  return (
    <>
      <PageHeader
        title="Mailboxes"
        help={{ href: "/help/mailboxes", label: "Connecting mailboxes" }}
        description="Your own sending accounts. Campaigns rotate between them and respect each one's daily limit."
        actions={
          <Button asChild>
            <Link href="/mailboxes/new">
              <PlusIcon /> Connect mailbox
            </Link>
          </Button>
        }
      />

      {mailboxes.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <InboxIcon />
            </EmptyMedia>
            <EmptyTitle>No mailboxes yet</EmptyTitle>
            <EmptyDescription>
              Connect a Google Workspace, Microsoft 365 or other SMTP/IMAP account. Use a separate domain from your main business
              domain for cold outreach. <LearnMore href="/help/sending-domain">Why, and how to set it up</LearnMore>
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/mailboxes/new">Connect your first mailbox</Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mailbox</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-48">Sent (24h)</TableHead>
                <TableHead>Inbox synced</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mailboxes.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{m.email}</span>
                      <span className="text-xs text-muted-foreground">{m.fromName}</span>
                      {m.lastError && (
                        <span className="mt-1 max-w-md text-xs whitespace-normal text-destructive">{m.lastError}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={m.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-sm tabular-nums">
                        {m.sentLast24h} / {m.dailyLimit}
                      </span>
                      <Progress value={Math.min((m.sentLast24h / m.dailyLimit) * 100, 100)} className="h-1.5" />
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {m.lastError?.startsWith("IMAP:") ? (
                      <span className="text-destructive">Failing</span>
                    ) : (
                      formatRelative(m.lastSyncedAt)
                    )}
                  </TableCell>
                  <TableCell>
                    <MailboxRowActions id={m.id} email={m.email} status={m.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
