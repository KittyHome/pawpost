"use client";

import { ROLE_LABELS, type Role } from "@pawpost/engine/permissions";
import {
  BanIcon,
  CrownIcon,
  KeyRoundIcon,
  MoreHorizontalIcon,
  ShieldIcon,
  Trash2Icon,
  UserCheckIcon,
  UserIcon,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { CopyField } from "@/components/copy-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ActionState } from "@/lib/action-state";

import { changeMemberRole, createResetLink, removeMember, setMemberDisabled } from "./actions";

type Pending = { kind: "role"; role: Role } | { kind: "disable" } | { kind: "remove" } | null;

export function MemberActions({
  member,
  actorIsOwner,
}: {
  member: { id: string; name: string; email: string; role: Role; status: "active" | "disabled" };
  actorIsOwner: boolean;
}) {
  const [busy, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<Pending>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  const run = (task: () => Promise<ActionState<unknown>>) =>
    startTransition(async () => {
      const result = await task();
      if (result.status === "error") toast.error(result.message);
      else if (result.status === "success" && result.message) toast.success(result.message);
    });

  const issueReset = () =>
    startTransition(async () => {
      const result = await createResetLink(member.id);
      if (result.status === "error") toast.error(result.message);
      else if (result.status === "success" && result.data) setResetUrl(result.data.url);
    });

  const roles: Role[] = actorIsOwner ? ["admin", "member", "owner"] : ["admin", "member"];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${member.name}`} disabled={busy}>
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Change role</DropdownMenuLabel>
          {roles
            .filter((r) => r !== member.role)
            .map((role) => (
              <DropdownMenuItem key={role} onSelect={() => setConfirm({ kind: "role", role })}>
                {role === "owner" ? <CrownIcon /> : role === "admin" ? <ShieldIcon /> : <UserIcon />}
                {role === "owner" ? "Make owner (transfer)" : `Make ${ROLE_LABELS[role].toLowerCase()}`}
              </DropdownMenuItem>
            ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={issueReset}>
            <KeyRoundIcon /> Reset password…
          </DropdownMenuItem>
          {member.status === "active" ? (
            <DropdownMenuItem onSelect={() => setConfirm({ kind: "disable" })}>
              <BanIcon /> Disable
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => run(() => setMemberDisabled(member.id, false))}>
              <UserCheckIcon /> Re-enable
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirm({ kind: "remove" })}>
            <Trash2Icon /> Remove from team
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirm?.kind === "role"}
        onOpenChange={(open) => !open && setConfirm(null)}
        onConfirm={() => changeMemberRole(member.id, confirm?.kind === "role" ? confirm.role : "member")}
        title={
          confirm?.kind === "role" && confirm.role === "owner"
            ? `Transfer ownership to ${member.name}?`
            : `Make ${member.name} ${confirm?.kind === "role" ? ROLE_LABELS[confirm.role].toLowerCase() : ""}?`
        }
        description={
          confirm?.kind === "role" && confirm.role === "owner"
            ? "They become the owner and you become an admin. Only the new owner can transfer it back."
            : "Their access changes immediately."
        }
        confirmLabel="Change role"
      />
      <ConfirmDialog
        open={confirm?.kind === "disable"}
        onOpenChange={(open) => !open && setConfirm(null)}
        onConfirm={() => setMemberDisabled(member.id, true)}
        title={`Disable ${member.name}?`}
        description="They're signed out everywhere and can't sign in until re-enabled. Their work stays."
        confirmLabel="Disable"
        destructive
      />
      <ConfirmDialog
        open={confirm?.kind === "remove"}
        onOpenChange={(open) => !open && setConfirm(null)}
        onConfirm={() => removeMember(member.id)}
        title={`Remove ${member.name}?`}
        description="Their account is deleted. Campaigns and lists they created stay, and the audit log keeps their email."
        confirmLabel="Remove"
        destructive
      />

      <Dialog open={resetUrl !== null} onOpenChange={(open) => !open && setResetUrl(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Password reset link for {member.name}</DialogTitle>
            <DialogDescription>Send this to {member.email}. It works once and expires in 24 hours.</DialogDescription>
          </DialogHeader>
          {resetUrl && <CopyField value={resetUrl} label="reset link" />}
          <DialogFooter>
            <Button onClick={() => setResetUrl(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
