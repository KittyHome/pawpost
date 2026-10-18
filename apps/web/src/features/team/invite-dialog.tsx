"use client";

import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@pawpost/engine/permissions";
import { UserPlusIcon } from "lucide-react";
import { useState } from "react";

import { CopyField } from "@/components/copy-field";
import { FormAlert } from "@/components/form-alert";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fieldError, idle, type ActionState } from "@/lib/action-state";
import { useActionForm } from "@/lib/use-action-form";

import { inviteMember, type ShareableLink } from "./actions";

export function InviteDialog({ canInviteAdmins }: { canInviteAdmins: boolean }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"member" | "admin">("member");
  // Remount the form each time the dialog opens, so a previous result isn't shown again.
  const [formKey, setFormKey] = useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setFormKey((k) => k + 1);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlusIcon /> Invite teammate
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a teammate</DialogTitle>
          <DialogDescription>
            They&apos;ll get a link to choose their name and password. Links expire after 7 days.
          </DialogDescription>
        </DialogHeader>
        <InviteForm key={formKey} role={role} setRole={setRole} canInviteAdmins={canInviteAdmins} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function InviteForm({
  role,
  setRole,
  canInviteAdmins,
  onDone,
}: {
  role: "member" | "admin";
  setRole: (role: "member" | "admin") => void;
  canInviteAdmins: boolean;
  onDone: () => void;
}) {
  const { state, pending, formProps } = useActionForm<ActionState<ShareableLink>>(inviteMember, idle);

  if (state.status === "success" && state.data) {
    return (
      <div className="flex flex-col gap-4">
        <FormAlert state={state} showSuccess />
        <CopyField value={state.data.url} label="invitation link" />
        <DialogFooter>
          <Button onClick={onDone}>Done</Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form {...formProps} className="flex flex-col gap-6">
      <input type="hidden" name="role" value={role} />
      <FieldGroup>
        <Field data-invalid={Boolean(fieldError(state, "email"))}>
          <FieldLabel htmlFor="invite-email">Email</FieldLabel>
          <Input id="invite-email" name="email" type="email" required autoFocus />
          <FieldError>{fieldError(state, "email")}</FieldError>
        </Field>
        <Field>
          <FieldLabel>Role</FieldLabel>
          <Select value={role} onValueChange={(v) => setRole(v as "member" | "admin")}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">{ROLE_LABELS.member}</SelectItem>
              {canInviteAdmins && <SelectItem value="admin">{ROLE_LABELS.admin}</SelectItem>}
            </SelectContent>
          </Select>
          <FieldDescription>{ROLE_DESCRIPTIONS[role]}</FieldDescription>
        </Field>
      </FieldGroup>
      <FormAlert state={state} />
      <DialogFooter>
        <SubmitButton pending={pending} pendingText="Creating…">
          Create invitation
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}
