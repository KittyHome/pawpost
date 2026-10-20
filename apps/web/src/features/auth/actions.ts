"use server";

import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { formToObject, runPublicAction } from "@/server/action";
import { engine } from "@/server/engine";
import { env } from "@/server/env";
import { clearSessionCookie, requestMeta, sessionToken, setSessionCookie } from "@/server/session";

/** Only allow same-site relative redirects after sign-in. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  if (!next || next === "/") return "/overview";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/overview";
}

export async function login(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runPublicAction(async () => {
    const { token } = await engine().accounts.signIn(formToObject(form), await requestMeta());
    await setSessionCookie(token);
    redirect(safeNext(form.get("next")));
  });
}

export async function logout(): Promise<void> {
  await engine().accounts.signOut(await sessionToken());
  await clearSessionCookie();
  redirect("/login");
}

export async function setupOwner(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runPublicAction(async () => {
    const { token } = await engine().accounts.setupOwner(formToObject(form), await requestMeta(), env().SETUP_TOKEN);
    await setSessionCookie(token);
    redirect("/overview");
  });
}

export async function acceptInvitation(inviteToken: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runPublicAction(async () => {
    const { token } = await engine().accounts.acceptInvitation(inviteToken, formToObject(form), await requestMeta());
    await setSessionCookie(token);
    redirect("/overview");
  });
}

export async function requestPasswordReset(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runPublicAction(async () => {
    await engine().accounts.requestPasswordReset(form.get("email"));
    return { message: "If an account exists for that address, we've emailed a reset link. It expires in 1 hour." };
  });
}

export async function resetPassword(resetToken: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runPublicAction(async () => {
    await engine().accounts.resetPassword(resetToken, formToObject(form), await requestMeta());
    redirect("/login?reset=1");
  });
}
