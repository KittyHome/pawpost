"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import { formToObject, runAction } from "@/server/action";
import { engine } from "@/server/engine";

export async function addSuppression(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async ({ actor }) => {
    await engine().suppressions.add(actor, formToObject(form));
    revalidatePath("/suppressions");
    return { message: "Address suppressed. Any running sequences for it were stopped." };
  });
}

export async function removeSuppression(email: string): Promise<ActionState> {
  return runAction(async ({ actor }) => {
    await engine().suppressions.remove(actor, email);
    revalidatePath("/suppressions");
    return { message: `${email} can be contacted again.` };
  });
}
