import { BookOpenIcon, CircleHelpIcon } from "lucide-react";
import Link from "next/link";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Contextual help. `href` points into the in-app guide, e.g. "/help/mailboxes#managing-mailboxes".
 *
 *   <HelpLink href=… label=… />       a "?" icon with a tooltip (page headers, cards)
 *   <LearnMore href=…>…</LearnMore>    an inline text link (field descriptions, alerts)
 */
export function HelpLink({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          aria-label={`Help: ${label}`}
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            className,
          )}
        >
          <CircleHelpIcon className="size-4" aria-hidden />
        </Link>
      </TooltipTrigger>
      <TooltipContent>Help: {label}</TooltipContent>
    </Tooltip>
  );
}

export function LearnMore({ href, children = "Learn more" }: { href: string; children?: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline">
      <BookOpenIcon className="size-3.5" aria-hidden />
      {children}
    </Link>
  );
}
