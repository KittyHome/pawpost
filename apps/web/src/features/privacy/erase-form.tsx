"use client";

import type { ErasePreview } from "@pawpost/engine";
import { useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormAlert } from "@/components/form-alert";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { idle, type ActionState } from "@/lib/action-state";
import { useActionForm } from "@/lib/use-action-form";

import { erasePerson, previewErase } from "./actions";

/** Two steps: look the person up to see what will be removed, then confirm. */
export function EraseForm() {
  const { state, pending, formProps } = useActionForm<ActionState<ErasePreview>>(previewErase, idle);
  const [confirming, setConfirming] = useState(false);
  const preview = state.status === "success" ? state.data : undefined;
  const nothingFound = preview && !preview.lists.length && !preview.campaigns.length && !preview.messages;

  return (
    <div className="flex flex-col gap-4">
      <form {...formProps} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field className="flex-1">
          <FieldLabel htmlFor="erase-email">Email address</FieldLabel>
          <Input id="erase-email" name="email" type="email" required placeholder="person@example.com" />
        </Field>
        <SubmitButton pending={pending} variant="outline" pendingText="Looking up…">
          Look up
        </SubmitButton>
      </form>
      <FormAlert state={state} />

      {preview && (
        <div className="flex flex-col gap-3 rounded-lg border p-4 text-sm">
          <p className="font-medium">{preview.email}</p>
          {nothingFound ? (
            <p className="text-muted-foreground">
              No contacts, campaign history or sent emails found.{" "}
              {preview.suppressed
                ? "The address is already on the suppression list."
                : "Erasing will only add it to the suppression list."}
            </p>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                In {preview.lists.length} list(s){preview.lists.length ? `: ${preview.lists.join(", ")}` : ""}
              </li>
              <li>
                In {preview.campaigns.length} campaign(s){preview.campaigns.length ? `: ${preview.campaigns.join(", ")}` : ""}
              </li>
              <li>{preview.messages} sent email record(s), plus replies and other activity</li>
            </ul>
          )}
          <p className="text-muted-foreground">
            The address will stay on the suppression list so they&apos;re never contacted again. This can&apos;t be undone.
          </p>
          <Button variant="destructive" className="self-start" onClick={() => setConfirming(true)}>
            Erase {preview.email}
          </Button>
          <ConfirmDialog
            open={confirming}
            onOpenChange={setConfirming}
            onConfirm={() => erasePerson(preview.email)}
            title={`Erase all data for ${preview.email}?`}
            description="Contacts, campaign history, sent-email records and activity for this address are deleted permanently. Only the suppression entry remains."
            confirmLabel="Erase permanently"
            destructive
          />
        </div>
      )}
    </div>
  );
}
