"use client";

import { DownloadIcon, ExternalLinkIcon, MoreHorizontalIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { trashList } from "./actions";
import { ImportForm } from "./import-form";

/** Opens the new-list form (CSV optional) in a side sheet. */
export function NewListButton({ label = "New list" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon /> {label}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>New contact list</SheetTitle>
            <SheetDescription>
              Import a CSV or start empty. Only add people you have a legitimate reason to contact.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">{open && <ImportForm />}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Row menu on the lists table. Lists used by a campaign can't be trashed, so that item is disabled. */
export function ListRowActions({
  listId,
  name,
  canExport,
  inUse,
}: {
  listId: string;
  name: string;
  canExport: boolean;
  inUse: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${name}`}>
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem asChild>
            <Link href={`/lists/${listId}`}>
              <ExternalLinkIcon /> Open
            </Link>
          </DropdownMenuItem>
          {canExport && (
            <DropdownMenuItem asChild>
              <a href={`/api/export/lists/${listId}`} download>
                <DownloadIcon /> Export CSV
              </a>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={inUse} onSelect={() => setConfirming(true)}>
            <Trash2Icon />
            <span className="flex flex-col">
              Move to trash
              {inUse && <span className="text-xs text-muted-foreground">Used by a campaign</span>}
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        onConfirm={() => trashList(listId)}
        title={`Move "${name}" to the trash?`}
        description="The list and its contacts are hidden and can be restored for 30 days."
        confirmLabel="Move to trash"
        destructive
      />
    </>
  );
}
