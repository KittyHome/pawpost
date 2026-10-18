"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import { formToObject, runAction } from "@/server/action";
import { engine } from "@/server/engine";

const refresh = () => revalidatePath("/settings/team");

export interface ShareableLink {
  url: string;
  emailed: boolean;
}

export async function inviteMember(_prev: ActionState<ShareableLink>, form: FormData): Promise<ActionState<ShareableLink>> {
  return runAction(async ({ actor }) => {
    const result = await engine().accounts.invite(actor, formToObject(form));
    refresh();
    return {
      data: result,
      message: result.emailed
        ? "Invitation sent by email. You can also share the link below."
        : "Invitation created. Share the link below.",
    };
  });
}

export async function revokeInvitation(invitationId: string): Promise<ActionState> {
  return runAction(async ({ actor }) => {
    await engine().accounts.revokeInvitation(actor, invitationId);
    refresh();
    return { message: "Invitation withdrawn." };
  });
}

export async function changeMemberRole(userId: string, role: string): Promise<ActionState> {
  return runAction(async ({ actor }) => {
    await engine().accounts.changeRole(actor, userId, { role });
    refresh();
    return { message: role === "owner" ? "Ownership transferred. You are now an admin." : "Role updated." };
  });
}

export async function setMemberDisabled(userId: string, disabled: boolean): Promise<ActionState> {
  return runAction(async ({ actor }) => {
    await engine().accounts.setDisabled(actor, userId, disabled);
    refresh();
    return { message: disabled ? "User disabled and signed out everywhere." : "User re-enabled." };
  });
}

export async function removeMember(userId: string): Promise<ActionState> {
  return runAction(async ({ actor }) => {
    await engine().accounts.removeUser(actor, userId);
    refresh();
    return { message: "User removed. Their work stays in the workspace." };
  });
}

export async function createResetLink(userId: string): Promise<ActionState<ShareableLink>> {
  return runAction(async ({ actor }) => {
    const result = await engine().accounts.createResetLink(actor, userId);
    return { data: result, message: result.emailed ? "Reset link emailed." : "Reset link created." };
  });
}
