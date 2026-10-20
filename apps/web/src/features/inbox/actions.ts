"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { engine } from "@/server/engine";

function refresh(campaignId?: string | null) {
  revalidatePath("/inbox");
  revalidatePath("/overview");
  revalidatePath("/campaigns");
  revalidatePath("/suppressions");
  if (campaignId) revalidatePath(`/campaigns/${campaignId}`);
}

export async function markReplyHandled(id: number, campaignId?: string | null): Promise<ActionState> {
  return runAction(async ({ actor }) => {
    await engine().replies.markHandled(actor, id);
    refresh(campaignId);
    return { message: "Marked as done." };
  });
}

export async function suppressFromReply(id: number, campaignId?: string | null): Promise<ActionState> {
  return runAction(async ({ actor }) => {
    await engine().replies.suppress(actor, id);
    refresh(campaignId);
    return { message: "They won't be emailed again." };
  });
}
