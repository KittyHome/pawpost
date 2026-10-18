import {
  InboxIcon,
  LifeBuoyIcon,
  MessageSquareReplyIcon,
  RocketIcon,
  SendIcon,
  ServerIcon,
  ShieldCheckIcon,
  type LucideIcon,
} from "lucide-react";

export const HELP_CATEGORIES = [
  { id: "start", label: "Getting started", description: "What Pawpost does and your first campaign.", icon: RocketIcon },
  { id: "setup", label: "Sending setup", description: "Mailboxes, domains and contact lists.", icon: InboxIcon },
  { id: "campaigns", label: "Campaigns", description: "Writing sequences, scheduling and AI help.", icon: SendIcon },
  {
    id: "results",
    label: "Replies & results",
    description: "Replies, bounces, unsubscribes and statistics.",
    icon: MessageSquareReplyIcon,
  },
  {
    id: "practice",
    label: "Good practice",
    description: "Reaching the inbox and staying within the law.",
    icon: ShieldCheckIcon,
  },
  { id: "admin", label: "Administration", description: "Installing, configuring and maintaining Pawpost.", icon: ServerIcon },
  {
    id: "support",
    label: "Troubleshooting & FAQ",
    description: "Fixes for common problems and quick answers.",
    icon: LifeBuoyIcon,
  },
] as const satisfies readonly { id: string; label: string; description: string; icon: LucideIcon }[];

export type HelpCategoryId = (typeof HELP_CATEGORIES)[number]["id"];

export function helpCategory(id: string) {
  return HELP_CATEGORIES.find((c) => c.id === id) ?? HELP_CATEGORIES[HELP_CATEGORIES.length - 1]!;
}
