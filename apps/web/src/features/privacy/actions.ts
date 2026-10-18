"use server";

import type { ErasePreview } from "@pawpost/engine";
import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { engine } from "@/server/engine";

export async function previewErase(_prev: ActionState<ErasePreview>, form: FormData): Promise<ActionState<ErasePreview>> {
  return runAction(async ({ actor }) => ({ data: await engine().privacy.preview(actor, form.get("email")) }));
}

export async function erasePerson(email: string): Promise<ActionState> {
  return runAction(async ({ actor }) => {
    const r = await engine().privacy.erase(actor, email);
    revalidatePath("/lists");
    revalidatePath("/suppressions");
    return {
      message: `Erased: ${r.contacts} contact record(s), ${r.messages} sent email(s) and ${r.events} activity entries. The address stays suppressed.`,
    };
  });
}
