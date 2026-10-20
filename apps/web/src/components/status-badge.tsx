import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  danger: "bg-red-500/10 text-red-700 dark:text-red-300",
};

const STATUS: Record<string, { label: string; tone: Tone }> = {
  // campaigns
  draft: { label: "Draft", tone: "neutral" },
  paused: { label: "Paused", tone: "warning" },
  completed: { label: "Completed", tone: "info" },
  // campaigns, mailboxes, enrollments
  active: { label: "Active", tone: "success" },
  error: { label: "Error", tone: "danger" },
  // enrollments
  sending: { label: "Sending", tone: "info" },
  replied: { label: "Replied", tone: "success" },
  bounced: { label: "Bounced", tone: "danger" },
  unsubscribed: { label: "Unsubscribed", tone: "warning" },
  suppressed: { label: "Suppressed", tone: "neutral" },
  failed: { label: "Failed", tone: "danger" },
  // suppressions
  complained: { label: "Complained", tone: "danger" },
  manual: { label: "Manual", tone: "neutral" },
  // reply intents
  interested: { label: "Interested", tone: "success" },
  question: { label: "Question", tone: "info" },
  referral: { label: "Referral", tone: "info" },
  not_now: { label: "Not now", tone: "neutral" },
  not_interested: { label: "Not interested", tone: "warning" },
  unsubscribe: { label: "Opt-out", tone: "danger" },
  out_of_office: { label: "Out of office", tone: "neutral" },
  wrong_person: { label: "Wrong person", tone: "warning" },
  other: { label: "Other", tone: "neutral" },
  done: { label: "Done", tone: "neutral" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const entry = STATUS[status] ?? { label: status, tone: "neutral" as const };
  return (
    <Badge variant="secondary" className={cn("border-transparent font-medium", TONE_CLASSES[entry.tone], className)}>
      {entry.label}
    </Badge>
  );
}

export function ToneBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <Badge variant="secondary" className={cn("border-transparent font-medium", TONE_CLASSES[tone])}>
      {children}
    </Badge>
  );
}
