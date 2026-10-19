import {
  BanIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  MailWarningIcon,
  MessageSquareReplyIcon,
  PauseIcon,
  PlaneIcon,
  SendIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { ToneBadge } from "@/components/status-badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { formatRelative } from "@/lib/format";

export interface ActivityItem {
  id: number;
  type: string;
  email: string | null;
  detail: Record<string, unknown>;
  createdAt: Date;
  campaignId: string | null;
  campaignName: string | null;
  mailboxEmail: string | null;
}

const META: Record<string, { icon: LucideIcon; label: string; className: string }> = {
  sent: { icon: SendIcon, label: "Sent", className: "text-muted-foreground" },
  reply: { icon: MessageSquareReplyIcon, label: "Reply", className: "text-emerald-600 dark:text-emerald-400" },
  auto_reply: { icon: PlaneIcon, label: "Auto-reply", className: "text-muted-foreground" },
  bounce: { icon: MailWarningIcon, label: "Bounce", className: "text-red-600 dark:text-red-400" },
  unsubscribe: { icon: BanIcon, label: "Unsubscribed", className: "text-amber-600 dark:text-amber-400" },
  send_failed: { icon: CircleAlertIcon, label: "Send failed", className: "text-red-600 dark:text-red-400" },
  campaign_paused: { icon: PauseIcon, label: "Campaign paused", className: "text-amber-600 dark:text-amber-400" },
  campaign_completed: { icon: CircleCheckIcon, label: "Campaign completed", className: "text-sky-600 dark:text-sky-400" },
  mailbox_error: { icon: CircleAlertIcon, label: "Mailbox error", className: "text-red-600 dark:text-red-400" },
};

const INTENT_LABEL: Record<string, string> = {
  interested: "Interested",
  question: "Question",
  referral: "Referral",
  not_now: "Not now",
  not_interested: "Not interested",
  unsubscribe: "Opt-out",
  out_of_office: "Out of office",
  wrong_person: "Wrong person",
  other: "Other",
};

function describe(item: ActivityItem): string {
  const d = item.detail;
  switch (item.type) {
    case "sent":
      return `Email ${Number(d.step ?? 0) + 1}: ${String(d.subject ?? "")}`;
    case "reply":
      return String(d.summary ?? d.snippet ?? "");
    case "bounce":
      return d.stage === "smtp" ? `Rejected by server: ${String(d.error ?? "")}` : "Delivery failed (bounce notice)";
    case "unsubscribe":
      if (d.via === "reply") return "Asked to stop by reply";
      if (d.via === "one_click") return "Used their email app's unsubscribe button";
      return "Used the unsubscribe link";
    case "campaign_paused":
      return String(d.reason ?? "");
    case "send_failed":
    case "mailbox_error":
      return String(d.error ?? d.reason ?? "");
    default:
      return "";
  }
}

export function ActivityFeed({ items, showCampaign = true }: { items: ActivityItem[]; showCampaign?: boolean }) {
  if (!items.length) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyTitle>No activity yet</EmptyTitle>
          <EmptyDescription>Sends, replies and bounces appear here as the worker processes campaigns.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul className="flex flex-col divide-y">
      {items.map((item) => {
        const meta = META[item.type] ?? META.sent!;
        const intent = item.type === "reply" && typeof item.detail.intent === "string" ? item.detail.intent : null;
        return (
          <li key={item.id} className="flex items-start gap-3 py-3">
            <meta.icon className={`mt-0.5 size-4 shrink-0 ${meta.className}`} aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="font-medium">{meta.label}</span>
                {item.email && <span className="truncate text-muted-foreground">{item.email}</span>}
                {intent && (
                  <ToneBadge
                    tone={intent === "interested" || intent === "question" || intent === "referral" ? "success" : "neutral"}
                  >
                    {INTENT_LABEL[intent] ?? intent}
                  </ToneBadge>
                )}
              </div>
              {describe(item) && <p className="line-clamp-2 text-sm text-muted-foreground">{describe(item)}</p>}
              {showCampaign && item.campaignId && item.campaignName && (
                <Link href={`/campaigns/${item.campaignId}`} className="w-fit text-xs text-muted-foreground hover:underline">
                  {item.campaignName}
                </Link>
              )}
            </div>
            <time
              className="shrink-0 text-xs text-muted-foreground"
              dateTime={item.createdAt.toISOString()}
              title={item.createdAt.toISOString()}
            >
              {formatRelative(item.createdAt)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
