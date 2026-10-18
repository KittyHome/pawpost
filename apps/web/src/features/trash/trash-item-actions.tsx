"use client";

import type { TrashKind } from "@pawpost/engine";
import { RotateCcwIcon, Trash2Icon } from "lucide-react";

import { ActionButton } from "@/components/action-button";

import { purgeItem, restoreItem } from "./actions";

export function TrashItemActions({
  kind,
  id,
  label,
  canPurge,
}: {
  kind: TrashKind;
  id: string;
  label: string;
  canPurge: boolean;
}) {
  return (
    <div className="flex justify-end gap-1">
      <ActionButton variant="outline" size="sm" action={restoreItem.bind(null, kind, id)}>
        <RotateCcwIcon /> Restore
      </ActionButton>
      {canPurge && (
        <ActionButton
          variant="ghost"
          size="sm"
          action={purgeItem.bind(null, kind, id)}
          confirm={{
            title: `Delete "${label}" permanently?`,
            description:
              kind === "campaign"
                ? "Its sequence, contacts' progress and statistics are deleted. This can't be undone."
                : kind === "list"
                  ? "The list and all its contacts are deleted. This can't be undone."
                  : "The contact is deleted from this list. This can't be undone.",
            confirmLabel: "Delete permanently",
            destructive: true,
          }}
        >
          <Trash2Icon /> Delete
        </ActionButton>
      )}
    </div>
  );
}
