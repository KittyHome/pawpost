"use client";

import { MoreHorizontalIcon, PauseIcon, PencilIcon, PlayIcon, PlugZapIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ActionState } from "@/lib/action-state";

import { deleteMailbox, setMailboxPaused, testMailbox } from "./actions";

export function MailboxRowActions({ id, email, status }: { id: string; email: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = (task: () => Promise<ActionState>) =>
    startTransition(async () => {
      const result = await task();
      if (result.status === "error") toast.error(result.message);
      else if (result.status === "success" && result.message) toast.success(result.message);
    });

  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => testMailbox(id))}>
        <PlugZapIcon /> Test
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${email}`} disabled={pending}>
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/mailboxes/${id}`}>
              <PencilIcon /> Edit
            </Link>
          </DropdownMenuItem>
          {status === "paused" ? (
            <DropdownMenuItem onSelect={() => run(() => setMailboxPaused(id, false))}>
              <PlayIcon /> Resume sending
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => run(() => setMailboxPaused(id, true))} disabled={status === "error"}>
              <PauseIcon /> Pause sending
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
            <Trash2Icon /> Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onConfirm={() => deleteMailbox(id)}
        title={`Remove ${email}?`}
        description="It stops sending immediately. Sent-message history is kept, and contacts mid-sequence move to the campaign's other mailboxes."
        confirmLabel="Remove mailbox"
        destructive
      />
    </div>
  );
}
