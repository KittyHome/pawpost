"use server";

import { DomainError } from "@pawpost/engine";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { formToObject, runAction } from "@/server/action";
import { engine } from "@/server/engine";

export async function saveMailbox(mailboxId: string | null, _prev: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    const input = formToObject(form);
    if (mailboxId) await engine().mailboxes.update(mailboxId, input);
    else await engine().mailboxes.create(input);
  });
  if (result.status !== "success") return result;
  revalidatePath("/mailboxes");
  redirect("/mailboxes");
}

export async function testMailbox(mailboxId: string): Promise<ActionState> {
  return runAction(async () => {
    const result = await engine().mailboxes.test(mailboxId);
    revalidatePath("/mailboxes");
    const problems = [!result.smtp.ok && `SMTP: ${result.smtp.error}`, !result.imap.ok && `IMAP: ${result.imap.error}`].filter(
      Boolean,
    );
    if (problems.length) throw new DomainError("connection_failed", problems.join(" · "));
    return { message: "SMTP and IMAP connections work." };
  });
}

export async function setMailboxPaused(mailboxId: string, paused: boolean): Promise<ActionState> {
  return runAction(async () => {
    await engine().mailboxes.setPaused(mailboxId, paused);
    revalidatePath("/mailboxes");
    return { message: paused ? "Mailbox paused." : "Mailbox resumed." };
  });
}

export async function deleteMailbox(mailboxId: string): Promise<ActionState> {
  return runAction(async () => {
    await engine().mailboxes.remove(mailboxId);
    revalidatePath("/mailboxes");
    return { message: "Mailbox removed." };
  });
}
