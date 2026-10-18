"use client";

import { CopyIcon, DownloadIcon, MoreHorizontalIcon, PauseIcon, PlayIcon, RocketIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ActionButton } from "@/components/action-button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { duplicateCampaign, pauseCampaign, resumeCampaign, startCampaign, trashCampaign } from "./actions";

export function CampaignControls({
  campaignId,
  status,
  contactCount,
  canStart,
  canExport,
}: {
  campaignId: string;
  status: string;
  contactCount: number;
  canStart: boolean;
  canExport: boolean;
}) {
  const [confirmTrash, setConfirmTrash] = useState(false);
  const [busy, startTransition] = useTransition();

  return (
    <>
      {status === "draft" && (
        <ActionButton
          action={startCampaign.bind(null, campaignId)}
          disabled={!canStart}
          confirm={{
            title: "Start this campaign?",
            description: `Up to ${contactCount} contacts will be enrolled. Emails go out gradually within your schedule and mailbox limits. You can pause at any time.`,
            confirmLabel: "Start sending",
          }}
        >
          <RocketIcon /> Start
        </ActionButton>
      )}
      {status === "active" && (
        <ActionButton variant="outline" action={pauseCampaign.bind(null, campaignId)}>
          <PauseIcon /> Pause
        </ActionButton>
      )}
      {status === "paused" && (
        <ActionButton action={resumeCampaign.bind(null, campaignId)} disabled={!canStart}>
          <PlayIcon /> Resume
        </ActionButton>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="More campaign actions" disabled={busy}>
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() =>
              startTransition(async () => {
                const result = await duplicateCampaign(campaignId);
                if (result.status === "error") toast.error(result.message);
              })
            }
          >
            <CopyIcon /> Duplicate
          </DropdownMenuItem>
          {canExport && status !== "draft" && (
            <DropdownMenuItem asChild>
              <a href={`/api/export/campaigns/${campaignId}`} download>
                <DownloadIcon /> Export results (CSV)
              </a>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={status === "active"} onSelect={() => setConfirmTrash(true)}>
            <Trash2Icon /> {status === "active" ? "Pause to delete" : "Move to trash"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmTrash}
        onOpenChange={setConfirmTrash}
        onConfirm={() => trashCampaign(campaignId)}
        title="Move this campaign to the trash?"
        description="It can be restored for 30 days. Suppressed addresses stay suppressed."
        confirmLabel="Move to trash"
        destructive
      />
    </>
  );
}
