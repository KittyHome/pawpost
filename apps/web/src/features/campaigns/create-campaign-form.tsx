"use client";

import { useState } from "react";

import { FormAlert } from "@/components/form-alert";
import { SubmitButton } from "@/components/submit-button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fieldError, idle } from "@/lib/action-state";
import { useActionForm } from "@/lib/use-action-form";

import { createCampaign } from "./actions";

export function CreateCampaignForm({ lists }: { lists: { id: string; name: string; contactCount: number }[] }) {
  const { state, pending, formProps } = useActionForm(createCampaign, idle);
  const [listId, setListId] = useState(lists[0]?.id ?? "");

  return (
    <form {...formProps} className="flex flex-col gap-6">
      <input type="hidden" name="listId" value={listId} />
      <FieldGroup>
        <Field data-invalid={Boolean(fieldError(state, "name"))}>
          <FieldLabel htmlFor="name">Campaign name</FieldLabel>
          <Input id="name" name="name" required placeholder="Chrome extension – developers" autoFocus />
          <FieldError>{fieldError(state, "name")}</FieldError>
        </Field>
        <Field data-invalid={Boolean(fieldError(state, "listId"))}>
          <FieldLabel>Contact list</FieldLabel>
          <Select value={listId} onValueChange={setListId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a list" />
            </SelectTrigger>
            <SelectContent>
              {lists.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name} ({l.contactCount} contacts)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            You&apos;ll write the emails and set the schedule next. Nothing is sent until you start it.
          </FieldDescription>
          <FieldError>{fieldError(state, "listId")}</FieldError>
        </Field>
      </FieldGroup>
      <FormAlert state={state} />
      <div className="flex justify-end">
        <SubmitButton pending={pending} pendingText="Creating…">
          Create campaign
        </SubmitButton>
      </div>
    </form>
  );
}
