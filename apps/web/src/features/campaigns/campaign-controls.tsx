"use client";

import { PauseIcon, PlayIcon, RocketIcon, Trash2Icon } from "lucide-react";

import { ActionButton } from "@/components/action-button";

import { deleteCampaign, pauseCampaign, resumeCampaign, startCampaign } from "./actions";

export function CampaignControls({
  campaignId,
  status,
  contactCount,
  canStart,
}: {
  campaignId: string;
  status: string;
  contactCount: number;
  canStart: boolean;
}) {
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
      {status !== "active" && (
        <ActionButton
          variant="outline"
          action={deleteCampaign.bind(null, campaignId)}
          confirm={{
            title: "Delete this campaign?",
            description: "Its sequence, enrollments and statistics are removed. Suppressed addresses stay suppressed.",
            confirmLabel: "Delete campaign",
            destructive: true,
          }}
        >
          <Trash2Icon /> Delete
        </ActionButton>
      )}
    </>
  );
}
