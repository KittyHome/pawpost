"use server";

import { DomainError } from "@pawpost/engine";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { formToObject, runAction } from "@/server/action";
import { engine } from "@/server/engine";

export async function saveMailbox(mailboxId: string | null, _prev: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async ({ actor }) => {
    const input = formToObject(form);
    if (mailboxId) await engine().mailboxes.update(actor, mailboxId, input);
    else await engine().mailboxes.create(actor, input);
  });
  if (result.status !== "success") return result;
  revalidatePath("/mailboxes");
  redirect("/mailboxes");
}

export async function testMailbox(mailboxId: string): Promise<ActionState> {
  return runAction(async ({ actor }) => {
    const result = await engine().mailboxes.test(actor, mailboxId);
    revalidatePath("/mailboxes");
    const problems = [!result.smtp.ok && `SMTP: ${result.smtp.error}`, !result.imap.ok && `IMAP: ${result.imap.error}`].filter(
      Boolean,
    );
    if (problems.length) throw new DomainError("connection_failed", problems.join(" · "));
    return { message: "SMTP and IMAP connections work." };
  });
}

export async function setMailboxPaused(mailboxId: string, paused: boolean): Promise<ActionState> {
  return runAction(async ({ actor }) => {
    await engine().mailboxes.setPaused(actor, mailboxId, paused);
    revalidatePath("/mailboxes");
    return { message: paused ? "Mailbox paused." : "Mailbox resumed." };
  });
}

export async function deleteMailbox(mailboxId: string): Promise<ActionState> {
  return runAction(async ({ actor }) => {
    await engine().mailboxes.remove(actor, mailboxId);
    revalidatePath("/mailboxes");
    return { message: "Mailbox removed." };
  });
}
