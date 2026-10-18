"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import { formToObject, runAction } from "@/server/action";
import { engine } from "@/server/engine";

export async function addSuppression(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await engine().suppressions.add(formToObject(form));
    revalidatePath("/suppressions");
    return { message: "Address suppressed. Any running sequences for it were stopped." };
  });
}

export async function removeSuppression(email: string): Promise<ActionState> {
  return runAction(async () => {
    await engine().suppressions.remove(email);
    revalidatePath("/suppressions");
    return { message: `${email} can be contacted again.` };
  });
}
