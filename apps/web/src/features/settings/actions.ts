"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import { formToObject, runAction } from "@/server/action";
import { engine } from "@/server/engine";

export async function saveAiSettings(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async ({ actor }) => {
    await engine().ai.saveSettings(actor, formToObject(form));
    revalidatePath("/settings/ai");
    return { message: "AI settings saved." };
  });
}

export async function testAi(): Promise<ActionState> {
  return runAction(async ({ actor }) => {
    await engine().ai.test(actor);
    return { message: "OpenAI responded. AI features are ready." };
  });
}
