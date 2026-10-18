"use server";

import type { TrashKind } from "@pawpost/engine";
import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { engine } from "@/server/engine";

const refresh = () => {
  revalidatePath("/trash");
  revalidatePath("/campaigns");
  revalidatePath("/lists");
  revalidatePath("/", "layout");
};

export async function restoreItem(kind: TrashKind, id: string): Promise<ActionState> {
  return runAction(async ({ actor }) => {
    await engine().trash.restore(actor, kind, id);
    refresh();
    return { message: "Restored." };
  });
}

export async function purgeItem(kind: TrashKind, id: string): Promise<ActionState> {
  return runAction(async ({ actor }) => {
    await engine().trash.purge(actor, kind, id);
    refresh();
    return { message: "Deleted permanently." };
  });
}

export async function emptyTrash(): Promise<ActionState> {
  return runAction(async ({ actor }) => {
    const r = await engine().trash.empty(actor);
    refresh();
    return { message: `Trash emptied: ${r.campaigns} campaigns, ${r.lists} lists, ${r.contacts} contacts deleted permanently.` };
  });
}
