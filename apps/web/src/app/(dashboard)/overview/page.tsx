import { checkPublicUrl } from "@pawpost/core";
import {
  BanIcon,
  CircleCheckIcon,
  CircleIcon,
  GlobeLockIcon,
  MailWarningIcon,
  MessageSquareReplyIcon,
  SendIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ActivityFeed } from "@/components/activity-feed";
import { LearnMore } from "@/components/help-link";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatPercent } from "@/lib/format";
import { engine } from "@/server/engine";
import { env } from "@/server/env";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const publicUrl = checkPublicUrl(env().APP_URL);
  const e = engine();
  const [overview, activity, mailboxes, lists, campaigns, worker] = await Promise.all([
    e.stats.overview(),
    e.stats.recentActivity({ limit: 15 }),
    e.mailboxes.list(),
    e.lists.list(),
    e.campaigns.list(),
    e.system.workerStatus(),
  ]);
  const week = overview.last7Days;

  const setup = [
    { done: mailboxes.length > 0, label: "Connect a sending mailbox", href: "/mailboxes/new" },
    { done: lists.some((l) => l.contactCount > 0), label: "Import a contact list", href: "/lists" },
    { done: campaigns.length > 0, label: "Create a campaign", href: "/campaigns/new" },
    { done: campaigns.some((c) => c.status !== "draft"), label: "Start sending", href: "/campaigns" },
  ];
  const setupDone = setup.every((s) => s.done);

  return (
    <>
      <PageHeader
        title="Overview"
        help={{ href: "/help/getting-started", label: "Quick start" }}
        description="The last 7 days across all campaigns."
        actions={
          <Button asChild>
            <Link href="/campaigns/new">New campaign</Link>
          </Button>
        }
      />

      {!worker.online && (
        <Alert variant="destructive">
          <MailWarningIcon />
          <AlertTitle>The worker isn&apos;t running</AlertTitle>
          <AlertDescription>
            Nothing is sent and no replies are read until it is. Nothing is lost: due emails wait.{" "}
            <LearnMore href="/help/troubleshooting#the-worker-is-offline">How to start the worker</LearnMore>
          </AlertDescription>
        </Alert>
      )}

      {publicUrl.problem && publicUrl.problem !== "localhost" && (
        <Alert>
          <GlobeLockIcon />
          <AlertTitle>Set up a domain before sending</AlertTitle>
          <AlertDescription>
            {publicUrl.message} <LearnMore href="/help/self-hosting#your-domain-and-https">How to set up a domain</LearnMore>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Emails sent"
          value={formatNumber(week.sent)}
          hint={`${formatNumber(overview.sentLast24h)} in the last 24 hours`}
          icon={SendIcon}
        />
        <StatCard
          label="Replies"
          value={formatNumber(week.replies)}
          hint={`${formatPercent(week.replies, week.sent)} reply rate`}
          icon={MessageSquareReplyIcon}
        />
        <StatCard
          label="Bounces"
          value={formatNumber(week.bounces)}
          hint={`${formatPercent(week.bounces, week.sent)}; keep under 2%`}
          icon={MailWarningIcon}
        />
        <StatCard
          label="Unsubscribes"
          value={formatNumber(week.unsubscribes)}
          hint={`${formatPercent(week.unsubscribes, week.sent)} of sends`}
          icon={BanIcon}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest sends, replies and bounces.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityFeed items={activity} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-5">
          {!setupDone && (
            <Card>
              <CardHeader>
                <CardTitle>Get started</CardTitle>
                <CardDescription>
                  Four steps to your first campaign. <LearnMore href="/help/getting-started">Read the quick start</LearnMore>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="flex flex-col gap-3.5">
                  {setup.map((step) => (
                    <li key={step.label} className="flex items-center gap-3 text-sm">
                      {step.done ? (
                        <CircleCheckIcon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                      ) : (
                        <CircleIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      )}
                      {step.done ? (
                        <span className="text-muted-foreground line-through">{step.label}</span>
                      ) : (
                        <Link href={step.href} className="font-medium hover:underline">
                          {step.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>At a glance</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="divide-y text-sm">
                <Row label="Active campaigns" value={formatNumber(overview.activeCampaigns)} />
                <Row label="Active mailboxes" value={formatNumber(overview.mailboxes.active ?? 0)} />
                <Row label="Mailboxes with errors" value={formatNumber(overview.mailboxes.error ?? 0)} />
                <Row label="Contact lists" value={formatNumber(lists.length)} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-(--card-spacing) py-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
