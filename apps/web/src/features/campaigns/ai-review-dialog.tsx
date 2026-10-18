"use client";

import type { CopyReview } from "@pawpost/ai";
import { Loader2Icon, ScanSearchIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ToneBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { reviewStep } from "./actions";

const VERDICT = {
  good: { label: "Good to send", tone: "success" },
  needs_work: { label: "Needs work", tone: "warning" },
  risky: { label: "Risky", tone: "danger" },
} as const;

const SEVERITY_TONE = { high: "danger", medium: "warning", low: "neutral" } as const;

/** Asks the AI to check one email for deliverability and reply-rate problems. */
export function AiReviewButton({
  enabled,
  subject,
  body,
  onApply,
}: {
  enabled: boolean;
  subject: string;
  body: string;
  onApply: (improved: { subject: string; body: string }) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [review, setReview] = useState<CopyReview | null>(null);

  const run = () =>
    startTransition(async () => {
      const result = await reviewStep({ subject, body });
      if (result.status === "error") toast.error(result.message);
      else if (result.status === "success" && result.data) setReview(result.data);
    });

  const trigger = (
    <Button variant="ghost" size="sm" onClick={run} disabled={!enabled || pending || !body.trim()}>
      {pending ? <Loader2Icon className="animate-spin" /> : <ScanSearchIcon />} Review
    </Button>
  );

  return (
    <>
      {enabled ? (
        trigger
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>{trigger}</span>
          </TooltipTrigger>
          <TooltipContent>Add an OpenAI key in Settings to use AI review</TooltipContent>
        </Tooltip>
      )}

      <Dialog open={review !== null} onOpenChange={(open) => !open && setReview(null)}>
        <DialogContent className="sm:max-w-2xl">
          {review && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  AI review <ToneBadge tone={VERDICT[review.verdict].tone}>{VERDICT[review.verdict].label}</ToneBadge>
                </DialogTitle>
                <DialogDescription>Checked for spam signals, length, clarity of the ask and personalisation.</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-3">
                  <Progress value={review.score} className="h-2" />
                  <span className="w-14 text-right text-sm font-medium tabular-nums">{review.score}/100</span>
                </div>
                {review.issues.length > 0 ? (
                  <ul className="flex flex-col gap-2">
                    {review.issues.map((issue, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <ToneBadge tone={SEVERITY_TONE[issue.severity]}>{issue.severity}</ToneBadge>
                        <span>{issue.message}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No issues found.</p>
                )}
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">Suggested version</span>
                  <div className="max-h-72 overflow-auto rounded-lg border bg-muted/30 p-4 text-sm whitespace-pre-wrap">
                    {review.improvedSubject && (
                      <p className="mb-3">
                        <span className="font-medium">Subject: </span>
                        {review.improvedSubject}
                      </p>
                    )}
                    {review.improvedBody}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReview(null)}>
                  Keep mine
                </Button>
                <Button
                  onClick={() => {
                    onApply({ subject: review.improvedSubject || subject, body: review.improvedBody });
                    setReview(null);
                    toast.success("Suggestion applied. Save the sequence to keep it.");
                  }}
                >
                  Use suggestion
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
