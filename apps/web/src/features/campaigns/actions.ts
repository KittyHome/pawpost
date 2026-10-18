"use server";

import type { CopyReview, GeneratedStep } from "@pawpost/ai";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { formToObject, runAction } from "@/server/action";
import { engine } from "@/server/engine";

const refresh = (id: string) => {
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${id}`);
};

export async function createCampaign(_prev: ActionState, form: FormData): Promise<ActionState> {
  let id = "";
  const result = await runAction(async ({ actor }) => {
    id = (await engine().campaigns.create(actor, formToObject(form))).id;
  });
  if (result.status !== "success") return result;
  revalidatePath("/campaigns");
  redirect(`/campaigns/${id}?tab=sequence`);
}

export async function duplicateCampaign(id: string): Promise<ActionState> {
  let copyId = "";
  const result = await runAction(async ({ actor }) => {
    copyId = (await engine().campaigns.duplicate(actor, id)).id;
  });
  if (result.status !== "success") return result;
  revalidatePath("/campaigns");
  redirect(`/campaigns/${copyId}?tab=settings`);
}

export async function updateCampaignSettings(id: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async ({ actor }) => {
    await engine().campaigns.updateSettings(actor, id, formToObject(form, ["sendDays", "mailboxIds"]));
    refresh(id);
    return { message: "Settings saved." };
  });
}

export async function saveCampaignSteps(
  id: string,
  steps: { subject: string; body: string; waitDays: number }[],
): Promise<ActionState> {
  return runAction(async ({ actor }) => {
    await engine().campaigns.saveSteps(actor, id, steps);
    refresh(id);
    return { message: "Sequence saved." };
  });
}

export async function startCampaign(id: string): Promise<ActionState> {
  return runAction(async ({ actor }) => {
    const { enrolled } = await engine().campaigns.start(actor, id);
    refresh(id);
    return { message: `Campaign started with ${enrolled} contacts. The worker sends within your schedule.` };
  });
}

export async function pauseCampaign(id: string): Promise<ActionState> {
  return runAction(async ({ actor }) => {
    await engine().campaigns.pause(actor, id);
    refresh(id);
    return { message: "Campaign paused." };
  });
}

export async function resumeCampaign(id: string): Promise<ActionState> {
  return runAction(async ({ actor }) => {
    const { newlyEnrolled } = await engine().campaigns.resume(actor, id);
    refresh(id);
    return { message: newlyEnrolled ? `Resumed, and added ${newlyEnrolled} new contacts from the list.` : "Campaign resumed." };
  });
}

export async function trashCampaign(id: string): Promise<ActionState> {
  const result = await runAction(async ({ actor }) => {
    await engine().campaigns.trash(actor, id);
  });
  if (result.status !== "success") return result;
  revalidatePath("/campaigns");
  revalidatePath("/trash");
  redirect("/campaigns?trashed=1");
}

export async function generateSequence(brief: Record<string, unknown>): Promise<ActionState<GeneratedStep[]>> {
  return runAction(async () => ({ data: await engine().ai.writeSequence(brief) }));
}

export async function reviewStep(email: { subject: string; body: string }): Promise<ActionState<CopyReview>> {
  return runAction(async () => ({ data: await engine().ai.reviewCopy(email) }));
}
