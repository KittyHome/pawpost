"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import { formToObject, runAction } from "@/server/action";
import { engine } from "@/server/engine";

export async function updateProfile(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async ({ actor }) => {
    await engine().accounts.updateProfile(actor, formToObject(form));
    revalidatePath("/", "layout");
    return { message: "Profile saved." };
  });
}

export async function changePassword(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async ({ actor, sessionId }) => {
    await engine().accounts.changePassword(actor, formToObject(form), sessionId);
    revalidatePath("/account");
    return { message: "Password changed. Your other sessions were signed out." };
  });
}

export async function revokeSession(sessionId: string): Promise<ActionState> {
  return runAction(async ({ actor }) => {
    await engine().accounts.revokeSession(actor, sessionId);
    revalidatePath("/account");
    return { message: "Session signed out." };
  });
}

export async function revokeOtherSessions(): Promise<ActionState> {
  return runAction(async ({ actor, sessionId }) => {
    const count = await engine().accounts.revokeOtherSessions(actor, sessionId);
    revalidatePath("/account");
    return { message: count ? `Signed out ${count} other session${count === 1 ? "" : "s"}.` : "No other sessions were active." };
  });
}
