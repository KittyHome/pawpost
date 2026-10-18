"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { FormAlert } from "@/components/form-alert";
import { SubmitButton } from "@/components/submit-button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { fieldError, idle } from "@/lib/action-state";
import { useActionForm } from "@/lib/use-action-form";

import { addContact, updateContact } from "./actions";

export interface EditableContact {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  attributes: Record<string, string>;
}

/** Add a contact (no `contact`) or edit one. Custom fields are the list's extra CSV columns. */
export function ContactDialog({
  open,
  onOpenChange,
  listId,
  attributeColumns,
  contact,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listId: string;
  attributeColumns: string[];
  contact?: EditableContact | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{contact ? "Edit contact" : "Add a contact"}</DialogTitle>
          <DialogDescription>
            {contact ? "Changes apply to future emails, including running campaigns." : "Adds one person to this list."}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <ContactForm
            key={contact?.id ?? "new"}
            listId={listId}
            attributeColumns={attributeColumns}
            contact={contact ?? null}
            onSaved={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ContactForm({
  listId,
  attributeColumns,
  contact,
  onSaved,
}: {
  listId: string;
  attributeColumns: string[];
  contact: EditableContact | null;
  onSaved: () => void;
}) {
  const action = contact ? updateContact.bind(null, listId, contact.id) : addContact.bind(null, listId);
  const { state, pending, formProps } = useActionForm(action, idle);
  const err = (f: string) => fieldError(state, f);
  const columns = [...new Set([...attributeColumns, ...Object.keys(contact?.attributes ?? {})])];

  useEffect(() => {
    if (state.status === "success") {
      if (state.message) toast.success(state.message);
      onSaved();
    }
  }, [state, onSaved]);

  return (
    <form {...formProps} className="flex flex-col gap-6">
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <Field className="sm:col-span-2" data-invalid={Boolean(err("email"))}>
          <FieldLabel htmlFor="contact-email">Email</FieldLabel>
          <Input id="contact-email" name="email" type="email" required defaultValue={contact?.email} autoFocus={!contact} />
          <FieldError>{err("email")}</FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor="contact-first">First name</FieldLabel>
          <Input id="contact-first" name="firstName" defaultValue={contact?.firstName ?? ""} />
        </Field>
        <Field>
          <FieldLabel htmlFor="contact-last">Last name</FieldLabel>
          <Input id="contact-last" name="lastName" defaultValue={contact?.lastName ?? ""} />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="contact-company">Company</FieldLabel>
          <Input id="contact-company" name="company" defaultValue={contact?.company ?? ""} />
        </Field>
      </FieldGroup>

      <FieldSet>
        <FieldLegend variant="label">Custom fields</FieldLegend>
        <FieldDescription>
          Usable in emails as {"{{FieldName}}"}. Leave a field empty to remove it from this contact.
        </FieldDescription>
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          {columns.map((column) => (
            <Field key={column}>
              <FieldLabel htmlFor={`attr-${column}`}>{column}</FieldLabel>
              <Input id={`attr-${column}`} name={`attr:${column}`} defaultValue={contact?.attributes[column] ?? ""} />
            </Field>
          ))}
          <Field>
            <FieldLabel htmlFor="new-field-name">New field name</FieldLabel>
            <Input id="new-field-name" name="newFieldName" placeholder="e.g. City" />
          </Field>
          <Field>
            <FieldLabel htmlFor="new-field-value">Value</FieldLabel>
            <Input id="new-field-value" name="newFieldValue" />
          </Field>
        </FieldGroup>
      </FieldSet>

      <FormAlert state={state} />
      <DialogFooter>
        <SubmitButton pending={pending} pendingText="Saving…">
          {contact ? "Save contact" : "Add contact"}
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}
