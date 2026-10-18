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
  const result = await runAction(async () => {
    id = (await engine().campaigns.create(formToObject(form))).id;
  });
  if (result.status !== "success") return result;
  revalidatePath("/campaigns");
  redirect(`/campaigns/${id}?tab=sequence`);
}

export async function updateCampaignSettings(id: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await engine().campaigns.updateSettings(id, formToObject(form, ["sendDays", "mailboxIds"]));
    refresh(id);
    return { message: "Settings saved." };
  });
}

export async function saveCampaignSteps(
  id: string,
  steps: { subject: string; body: string; waitDays: number }[],
): Promise<ActionState> {
  return runAction(async () => {
    await engine().campaigns.saveSteps(id, steps);
    refresh(id);
    return { message: "Sequence saved." };
  });
}

export async function startCampaign(id: string): Promise<ActionState> {
  return runAction(async () => {
    const { enrolled } = await engine().campaigns.start(id);
    refresh(id);
    return { message: `Campaign started with ${enrolled} contacts. The worker sends within your schedule.` };
  });
}

export async function pauseCampaign(id: string): Promise<ActionState> {
  return runAction(async () => {
    await engine().campaigns.pause(id);
    refresh(id);
    return { message: "Campaign paused." };
  });
}

export async function resumeCampaign(id: string): Promise<ActionState> {
  return runAction(async () => {
    const { newlyEnrolled } = await engine().campaigns.resume(id);
    refresh(id);
    return { message: newlyEnrolled ? `Resumed, and added ${newlyEnrolled} new contacts from the list.` : "Campaign resumed." };
  });
}

export async function deleteCampaign(id: string): Promise<ActionState> {
  const result = await runAction(async () => {
    await engine().campaigns.remove(id);
  });
  if (result.status !== "success") return result;
  revalidatePath("/campaigns");
  redirect("/campaigns");
}

export async function generateSequence(brief: Record<string, unknown>): Promise<ActionState<GeneratedStep[]>> {
  return runAction(async () => ({ data: await engine().ai.writeSequence(brief) }));
}

export async function reviewStep(email: { subject: string; body: string }): Promise<ActionState<CopyReview>> {
  return runAction(async () => ({ data: await engine().ai.reviewCopy(email) }));
}
