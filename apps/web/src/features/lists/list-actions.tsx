"use client";

import { DownloadIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon, UploadIcon, UserPlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormAlert } from "@/components/form-alert";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { idle } from "@/lib/action-state";
import { useActionForm } from "@/lib/use-action-form";

import { renameList, trashList } from "./actions";
import { ContactDialog } from "./contact-dialog";
import { ImportForm } from "./import-form";

/** Header actions for a list: add contact, import, rename, export, move to trash. */
export function ListActions({
  listId,
  name,
  attributeColumns,
  canExport,
}: {
  listId: string;
  name: string;
  attributeColumns: string[];
  canExport: boolean;
}) {
  const [dialog, setDialog] = useState<"add" | "import" | "rename" | "trash" | null>(null);
  const close = () => setDialog(null);

  return (
    <>
      <Button onClick={() => setDialog("add")}>
        <UserPlusIcon /> Add contact
      </Button>
      <Button variant="outline" onClick={() => setDialog("import")}>
        <UploadIcon /> Import CSV
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="More list actions">
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDialog("rename")}>
            <PencilIcon /> Rename
          </DropdownMenuItem>
          {canExport && (
            <DropdownMenuItem asChild>
              <a href={`/api/export/lists/${listId}`} download>
                <DownloadIcon /> Export CSV
              </a>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDialog("trash")}>
            <Trash2Icon /> Move to trash
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ContactDialog
        open={dialog === "add"}
        onOpenChange={(o) => !o && close()}
        listId={listId}
        attributeColumns={attributeColumns}
      />

      <Sheet open={dialog === "import"} onOpenChange={(o) => !o && close()}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Import into {name}</SheetTitle>
            <SheetDescription>Addresses already in this list are skipped.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            <ImportForm listId={listId} />
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={dialog === "rename"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename list</DialogTitle>
          </DialogHeader>
          {dialog === "rename" && <RenameForm listId={listId} name={name} onDone={close} />}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={dialog === "trash"}
        onOpenChange={(o) => !o && close()}
        onConfirm={() => trashList(listId)}
        title={`Move "${name}" to the trash?`}
        description="The list and its contacts are hidden and can be restored for 30 days. Lists used by a campaign can't be deleted."
        confirmLabel="Move to trash"
        destructive
      />
    </>
  );
}

function RenameForm({ listId, name, onDone }: { listId: string; name: string; onDone: () => void }) {
  const { state, pending, formProps } = useActionForm(renameList.bind(null, listId), idle);
  useEffect(() => {
    if (state.status === "success") {
      toast.success("List renamed.");
      onDone();
    }
  }, [state, onDone]);
  return (
    <form {...formProps} className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="list-name">Name</FieldLabel>
        <Input id="list-name" name="name" defaultValue={name} required autoFocus />
      </Field>
      <FormAlert state={state} />
      <DialogFooter>
        <SubmitButton pending={pending} pendingText="Saving…">
          Rename
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}
