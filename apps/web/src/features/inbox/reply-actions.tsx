"use client";

import { CheckIcon, CopyIcon, ExternalLinkIcon, MailIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ActionButton } from "@/components/action-button";
import { Button } from "@/components/ui/button";

import { markReplyHandled, suppressFromReply } from "./actions";

export function ReplyActions({
  id,
  email,
  subject,
  mailboxEmail,
  campaignId,
  handled,
}: {
  id: number;
  email: string;
  subject: string;
  mailboxEmail: string | null;
  campaignId: string | null;
  handled: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const replySubject = subject && !/^re:/i.test(subject) ? `Re: ${subject}` : subject;
  const mailto = `mailto:${encodeURIComponent(email)}${replySubject ? `?subject=${encodeURIComponent(replySubject)}` : ""}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!handled && (
        <ActionButton size="sm" action={markReplyHandled.bind(null, id, campaignId)}>
          <CheckIcon /> Mark done
        </ActionButton>
      )}
      <Button size="sm" variant="outline" asChild>
        <a href={mailto}>
          <MailIcon /> Reply
        </a>
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={async () => {
          await navigator.clipboard.writeText(email);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
        {copied ? "Copied" : "Copy"}
      </Button>
      {campaignId && (
        <Button size="sm" variant="outline" asChild>
          <Link href={`/campaigns/${campaignId}`}>
            <ExternalLinkIcon /> Campaign
          </Link>
        </Button>
      )}
      {!handled && (
        <ActionButton
          size="sm"
          variant="ghost"
          action={suppressFromReply.bind(null, id, campaignId)}
          confirm={{
            title: `Stop emailing ${email}?`,
            description: mailboxEmail
              ? `They go on the suppression list and this reply is marked done. You can still reply from ${mailboxEmail}.`
              : "They go on the suppression list and this reply is marked done. You can still reply from your mail app.",
            confirmLabel: "Do not email again",
            destructive: true,
          }}
        >
          Do not email again
        </ActionButton>
      )}
    </div>
  );
}
