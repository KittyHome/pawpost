"use server";

import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { checkCredentials, endSession, startSession } from "@/server/session";

/** Only allow same-site relative redirects after login. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function login(_prev: ActionState, form: FormData): Promise<ActionState> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");

  if (!checkCredentials(email, password)) {
    // Slow down guessing.
    await new Promise((resolve) => setTimeout(resolve, 750));
    return { status: "error", message: "Wrong email or password." };
  }
  await startSession(email.trim().toLowerCase());
  redirect(safeNext(form.get("next")));
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/login");
}
