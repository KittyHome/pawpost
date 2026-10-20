import { REPLY_TABS } from "@pawpost/engine";
import type { Metadata } from "next";
import Link from "next/link";

import { LearnMore } from "@/components/help-link";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ReplyActions } from "@/features/inbox/reply-actions";
import { formatRelative } from "@/lib/format";
import { engine } from "@/server/engine";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "Replies" };

const TAB_LABELS = {
  needs_attention: "Needs a look",
  all: "All",
  done: "Done",
} as const;

export default async function InboxPage({ searchParams }: PageProps<"/inbox">) {
  await requireSession();
  const query = await searchParams;
  const tab = REPLY_TABS.find((t) => t === query.tab) ?? "needs_attention";
  const campaignId = typeof query.campaign === "string" ? query.campaign : undefined;
  const page = Number(query.page) || 1;
  const result = await engine().replies.list({ tab, campaignId, page });

  const href = (next: { tab?: string; page?: number }) => {
    const params = new URLSearchParams();
    const nextTab = next.tab ?? tab;
    if (nextTab !== "needs_attention") params.set("tab", nextTab);
    if (campaignId) params.set("campaign", campaignId);
    if ((next.page ?? 1) > 1) params.set("page", String(next.page ?? 1));
    const q = params.toString();
    return q ? `/inbox?${q}` : "/inbox";
  };

  const empty =
    tab === "needs_attention"
      ? "No replies need a look. Interested people, questions and referrals show up here."
      : tab === "done"
        ? "Nothing marked done yet."
        : "No replies yet. They appear here after the worker reads your sending mailboxes.";

  return (
    <>
      <PageHeader
        title="Replies"
        help={{ href: "/help/replies-and-bounces#the-reply-inbox", label: "The reply inbox" }}
        description="People who wrote back. Answer from your mail app; mark done here when you've dealt with it."
      />

      <div className="flex flex-wrap items-center gap-2">
        {REPLY_TABS.map((t) => {
          const count =
            t === "needs_attention" ? result.counts.needsAttention : t === "done" ? result.counts.done : result.counts.all;
          return (
            <Button key={t} variant={t === tab ? "default" : "outline"} size="sm" asChild>
              <Link href={href({ tab: t, page: 1 })}>
                {TAB_LABELS[t]}
                <span className="tabular-nums opacity-80">{count}</span>
              </Link>
            </Button>
          );
        })}
        {campaignId && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={tab === "needs_attention" ? "/inbox" : `/inbox?tab=${tab}`}>All campaigns</Link>
          </Button>
        )}
      </div>

      {result.rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {empty} <LearnMore href="/help/replies-and-bounces#the-reply-inbox">How replies work</LearnMore>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {result.rows.map((row) => {
            const name = [row.firstName, row.lastName].filter(Boolean).join(" ");
            return (
              <Card key={row.id}>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{name || row.email}</p>
                        {row.intent && <StatusBadge status={row.intent} />}
                        {row.handledAt && <StatusBadge status="done" />}
                      </div>
                      {name ? <p className="text-sm text-muted-foreground">{row.email}</p> : null}
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground">{formatRelative(row.createdAt)}</p>
                  </div>
                  {(row.summary || row.snippet) && <p className="text-sm leading-relaxed">{row.summary || row.snippet}</p>}
                  <p className="text-xs text-muted-foreground">
                    {[row.campaignName, row.mailboxEmail && `Reply from ${row.mailboxEmail}`, row.subject]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <ReplyActions
                    id={row.id}
                    email={row.email}
                    subject={row.subject}
                    mailboxEmail={row.mailboxEmail}
                    campaignId={row.campaignId}
                    handled={Boolean(row.handledAt)}
                  />
                </CardContent>
              </Card>
            );
          })}
          <Pagination page={result.page} pageSize={result.pageSize} total={result.total} hrefFor={(p) => href({ page: p })} />
        </div>
      )}
    </>
  );
}
