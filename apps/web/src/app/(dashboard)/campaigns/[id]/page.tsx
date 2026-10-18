import { isDomainError } from "@pawpost/engine";
import { can } from "@pawpost/engine/permissions";
import {
  CircleAlertIcon,
  MailWarningIcon,
  MessageSquareReplyIcon,
  PauseIcon,
  SendIcon,
  TriangleAlertIcon,
  UsersIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActivityFeed } from "@/components/activity-feed";
import { LearnMore } from "@/components/help-link";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampaignControls } from "@/features/campaigns/campaign-controls";
import { SequenceEditor } from "@/features/campaigns/sequence-editor";
import { CampaignSettingsForm } from "@/features/campaigns/settings-form";
import { formatNumber, formatPercent, formatRelative } from "@/lib/format";
import { engine } from "@/server/engine";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "Campaign" };

const TABS = ["overview", "sequence", "settings", "contacts"] as const;
const ENROLLMENT_FILTERS = ["all", "active", "completed", "replied", "bounced", "unsubscribed", "failed"] as const;

export default async function CampaignPage({ params, searchParams }: PageProps<"/campaigns/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const tab = TABS.find((t) => t === query.tab) ?? "overview";
  const statusFilter = ENROLLMENT_FILTERS.find((f) => f === query.status) ?? "all";
  const page = Number(query.page) || 1;

  const { user } = await requireSession();
  const e = engine();
  const campaign = await e.campaigns.get(id).catch((error: unknown) => {
    if (isDomainError(error)) notFound();
    throw error;
  });
  const [preflight, lists, mailboxes, activity, enrollments, ai, samples] = await Promise.all([
    e.campaigns.preflight(id),
    e.lists.list(),
    e.mailboxes.list(),
    e.stats.recentActivity({ campaignId: id, limit: 30 }),
    e.campaigns.enrollments(id, { page, status: statusFilter === "all" ? undefined : statusFilter }),
    e.ai.status(),
    e.lists.contacts(campaign.listId, { pageSize: 25 }),
  ]);
  // Preview with a real contact, preferably one with a name.
  const sample = samples.rows.find((c) => c.firstName) ?? samples.rows[0];

  const list = lists.find((l) => l.id === campaign.listId);
  const editable = campaign.status === "draft" || campaign.status === "paused";
  const s = campaign.stats;
  const firstMailbox = mailboxes.find((m) => campaign.mailboxIds.includes(m.id)) ?? mailboxes[0];
  const contactsHref = (p: number, status = statusFilter) =>
    `/campaigns/${id}?${new URLSearchParams({ tab: "contacts", status, page: String(p) })}`;

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {campaign.name} <StatusBadge status={campaign.status} />
          </span>
        }
        description={`${campaign.listName} · ${formatNumber(list?.contactCount ?? 0)} contacts`}
        help={{ href: "/help/campaigns", label: "Creating and running campaigns" }}
        breadcrumbs={[{ label: "Campaigns", href: "/campaigns" }, { label: campaign.name }]}
        actions={
          <CampaignControls
            campaignId={id}
            status={campaign.status}
            canExport={can(user.role, "data.export")}
            contactCount={list?.contactCount ?? 0}
            canStart={preflight.errors.length === 0}
          />
        }
      />

      {campaign.status === "paused" && campaign.pauseReason && (
        <Alert variant="destructive">
          <PauseIcon />
          <AlertTitle>Paused automatically</AlertTitle>
          <AlertDescription>
            {campaign.pauseReason} <LearnMore href="/help/troubleshooting#my-campaign-paused-itself">What to do</LearnMore>
          </AlertDescription>
        </Alert>
      )}

      {editable && (preflight.errors.length > 0 || preflight.warnings.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>{preflight.errors.length ? "Before you can start" : "Worth a look"}</CardTitle>
            <CardDescription>
              Checked again when the campaign starts or resumes.{" "}
              <LearnMore href="/help/campaigns#before-you-can-start">About these checks</LearnMore>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {preflight.errors.map((msg) => (
                <li key={msg} className="flex items-start gap-2">
                  <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                  {msg}
                </li>
              ))}
              {preflight.warnings.map((msg) => (
                <li key={msg} className="flex items-start gap-2 text-muted-foreground">
                  <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
                  {msg}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue={tab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sequence">Sequence ({campaign.steps.length})</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Enrolled"
              value={formatNumber(s.enrolled)}
              hint={`${formatNumber(s.byStatus.active)} still in sequence`}
              icon={UsersIcon}
            />
            <StatCard label="Emails sent" value={formatNumber(s.emailsSent)} icon={SendIcon} />
            <StatCard
              label="Replies"
              value={formatNumber(s.replies)}
              hint={`${formatPercent(s.replies, s.enrolled)} of contacts`}
              icon={MessageSquareReplyIcon}
            />
            <StatCard
              label="Bounces"
              value={formatNumber(s.bounces)}
              hint={`${formatPercent(s.bounces, s.attempts)} · auto-pauses above 2%`}
              icon={MailWarningIcon}
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFeed items={activity} showCampaign={false} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sequence">
          <SequenceEditor
            campaignId={id}
            initialSteps={campaign.steps.map((st) => ({ subject: st.subject, body: st.body, waitDays: st.waitDays }))}
            attributeColumns={list?.attributeColumns ?? []}
            senderName={firstMailbox?.fromName ?? "Sam Lee"}
            sampleContact={
              sample && {
                email: sample.email,
                firstName: sample.firstName,
                lastName: sample.lastName,
                company: sample.company,
                attributes: sample.attributes,
              }
            }
            editable={editable}
            aiEnabled={ai.configured}
          />
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardContent>
              <CampaignSettingsForm
                campaignId={id}
                editable={editable}
                listLocked={campaign.status !== "draft"}
                lists={lists.map((l) => ({ id: l.id, name: l.name, contactCount: l.contactCount }))}
                mailboxes={mailboxes.map((m) => ({ id: m.id, email: m.email, status: m.status, dailyLimit: m.dailyLimit }))}
                defaults={{
                  name: campaign.name,
                  listId: campaign.listId,
                  timezone: campaign.timezone,
                  sendDays: campaign.sendDays,
                  windowStart: campaign.windowStart,
                  windowEnd: campaign.windowEnd,
                  postalAddress: campaign.postalAddress,
                  stopOnReply: campaign.stopOnReply,
                  mailboxIds: campaign.mailboxIds,
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts" className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {ENROLLMENT_FILTERS.map((f) => (
              <Button key={f} variant={f === statusFilter ? "default" : "outline"} size="sm" asChild>
                <Link href={contactsHref(1, f)}>{f === "all" ? "All" : f[0]!.toUpperCase() + f.slice(1)}</Link>
              </Button>
            ))}
          </div>
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Next email</TableHead>
                  <TableHead>Mailbox</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.email}</div>
                      <div className="text-xs text-muted-foreground">{[r.firstName, r.lastName].filter(Boolean).join(" ")}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                      {r.lastError && (
                        <div className="mt-1 max-w-xs text-xs whitespace-normal text-destructive">{r.lastError}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.status === "active" ? `Email ${r.nextStep + 1} · ${formatRelative(r.nextSendAt)}` : "–"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.mailboxEmail ?? "–"}</TableCell>
                  </TableRow>
                ))}
                {enrollments.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      {s.enrolled === 0 ? "Contacts are enrolled when the campaign starts." : "No contacts with this status."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
          <Pagination
            page={enrollments.page}
            pageSize={enrollments.pageSize}
            total={enrollments.total}
            hrefFor={(p) => contactsHref(p)}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
