"use server";

import { DomainError, type ImportReport } from "@pawpost/engine";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action";
import { engine } from "@/server/engine";

async function readCsv(form: FormData): Promise<string> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw new DomainError("validation", "Choose a CSV file to upload.");
  if (file.size > 10 * 1024 * 1024) throw new DomainError("validation", "CSV files are limited to 10 MB.");
  return file.text();
}

const importOptions = (form: FormData) => ({
  skipRoleAddresses: form.get("skipRoleAddresses"),
  checkDomains: form.get("checkDomains"),
});

/** Creates a list from an uploaded CSV. `listId` is set to import into an existing list instead. */
export async function importContacts(
  listId: string | null,
  _prev: ActionState<ImportReport>,
  form: FormData,
): Promise<ActionState<ImportReport>> {
  return runAction(async () => {
    const csv = await readCsv(form);
    const targetId = listId ?? (await engine().lists.create({ name: form.get("name") })).id;
    const report = await engine().lists.importCsv(targetId, csv, importOptions(form));
    revalidatePath("/lists");
    revalidatePath(`/lists/${targetId}`);
    return { data: report, message: `Imported ${report.imported} contacts.` };
  });
}

export async function deleteList(listId: string): Promise<ActionState> {
  const result = await runAction(async () => {
    await engine().lists.remove(listId);
  });
  if (result.status !== "success") return result;
  revalidatePath("/lists");
  redirect("/lists");
}
