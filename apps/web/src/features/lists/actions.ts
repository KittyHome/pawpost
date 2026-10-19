"use server";

import { DomainError, type BulkResult, type ImportReport } from "@pawpost/engine";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { formToObject, runAction } from "@/server/action";
import { engine } from "@/server/engine";

function csvFile(form: FormData): File | null {
  const file = form.get("file");
  return file instanceof File && file.size > 0 ? file : null;
}

async function readCsv(file: File | null): Promise<string> {
  if (!file) throw new DomainError("validation", "Choose a CSV file to upload.");
  if (file.size > 10 * 1024 * 1024) throw new DomainError("validation", "CSV files are limited to 10 MB.");
  return file.text();
}

const importOptions = (form: FormData) => ({
  skipRoleAddresses: form.get("skipRoleAddresses"),
  checkDomains: form.get("checkDomains"),
});

const refreshList = (listId: string) => {
  revalidatePath("/lists");
  revalidatePath(`/lists/${listId}`);
};

/**
 * Creates a list, from an uploaded CSV or empty when no file is chosen (then opens it).
 * `listId` is set to import into an existing list instead.
 */
export async function importContacts(
  listId: string | null,
  _prev: ActionState<ImportReport>,
  form: FormData,
): Promise<ActionState<ImportReport>> {
  return runAction(async ({ actor }) => {
    const file = csvFile(form);
    if (!listId && !file) {
      const list = await engine().lists.create(actor, { name: form.get("name") });
      revalidatePath("/lists");
      redirect(`/lists/${list.id}`);
    }
    const csv = await readCsv(file);
    const report = listId
      ? await engine().lists.importCsv(actor, listId, csv, importOptions(form))
      : await engine().lists.createFromCsv(actor, form.get("name"), csv, importOptions(form));
    refreshList(report.listId);
    return { data: report, message: `Imported ${report.imported} contacts.` };
  });
}

export async function renameList(listId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async ({ actor }) => {
    await engine().lists.rename(actor, listId, formToObject(form));
    refreshList(listId);
    return { message: "List renamed." };
  });
}

export async function trashList(listId: string): Promise<ActionState> {
  const result = await runAction(async ({ actor }) => {
    await engine().lists.trash(actor, listId);
  });
  if (result.status !== "success") return result;
  revalidatePath("/lists");
  revalidatePath("/trash");
  redirect("/lists?trashed=1");
}

/** Contact form fields: email, firstName, lastName, company, plus "attr:<Column>" custom fields. */
function contactFromForm(form: FormData) {
  const attributes: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (key.startsWith("attr:") && typeof value === "string") attributes[key.slice(5)] = value;
  }
  const newKey = String(form.get("newFieldName") ?? "").trim();
  const newValue = String(form.get("newFieldValue") ?? "").trim();
  if (newKey && newValue) attributes[newKey] = newValue;
  return {
    email: form.get("email"),
    firstName: form.get("firstName") ?? undefined,
    lastName: form.get("lastName") ?? undefined,
    company: form.get("company") ?? undefined,
    attributes,
  };
}

export async function addContact(listId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async ({ actor }) => {
    const contact = await engine().lists.addContact(actor, listId, contactFromForm(form));
    refreshList(listId);
    return { message: `${contact.email} added.` };
  });
}

export async function updateContact(listId: string, contactId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async ({ actor }) => {
    const contact = await engine().lists.updateContact(actor, contactId, contactFromForm(form));
    refreshList(listId);
    return { message: `${contact.email} saved.` };
  });
}

type BulkOperation = "trash" | "suppress" | "move" | "copy";

const BULK_VERBS: Record<BulkOperation, string> = {
  trash: "moved to the trash",
  suppress: "suppressed",
  move: "moved",
  copy: "copied",
};

export async function bulkContacts(
  listId: string,
  operation: BulkOperation,
  contactIds: string[],
  targetListId?: string,
): Promise<ActionState<BulkResult>> {
  return runAction(async ({ actor }) => {
    const lists = engine().lists;
    if ((operation === "move" || operation === "copy") && !targetListId) throw new DomainError("validation", "Choose a list.");
    const result =
      operation === "trash"
        ? await lists.trashContacts(actor, contactIds)
        : operation === "suppress"
          ? await lists.suppressContacts(actor, contactIds)
          : operation === "move"
            ? await lists.moveContacts(actor, contactIds, targetListId!)
            : await lists.copyContacts(actor, contactIds, targetListId!);
    refreshList(listId);
    if (targetListId) refreshList(targetListId);
    if (operation === "trash") revalidatePath("/trash");
    const skipped = result.skipped ? ` ${result.skipped} skipped (already there or not eligible).` : "";
    return {
      data: result,
      message: `${result.affected} contact${result.affected === 1 ? "" : "s"} ${BULK_VERBS[operation]}.${skipped}`,
    };
  });
}
