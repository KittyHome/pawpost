"use client";

import { useEffect, useRef } from "react";

import { FormAlert } from "@/components/form-alert";
import { PasswordInput } from "@/components/password-input";
import { SubmitButton } from "@/components/submit-button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { fieldError, idle } from "@/lib/action-state";
import { useActionForm } from "@/lib/use-action-form";

import { changePassword, updateProfile } from "./actions";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const { state, pending, formProps } = useActionForm(updateProfile, idle);
  return (
    <form {...formProps} className="flex flex-col gap-6">
      <FieldGroup className="grid gap-4 md:grid-cols-2">
        <Field data-invalid={Boolean(fieldError(state, "name"))}>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input id="name" name="name" defaultValue={name} required autoComplete="name" />
          <FieldError>{fieldError(state, "name")}</FieldError>
        </Field>
        <Field data-invalid={Boolean(fieldError(state, "email"))}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" name="email" type="email" defaultValue={email} required autoComplete="email" />
          <FieldDescription>You sign in with this address.</FieldDescription>
          <FieldError>{fieldError(state, "email")}</FieldError>
        </Field>
      </FieldGroup>
      <FormAlert state={state} showSuccess />
      <div className="flex justify-end">
        <SubmitButton pending={pending} pendingText="Saving…">
          Save profile
        </SubmitButton>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const { state, pending, formProps } = useActionForm(changePassword, idle);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} {...formProps} className="flex flex-col gap-6">
      <FieldGroup className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="currentPassword">Current password</FieldLabel>
          <PasswordInput id="currentPassword" name="currentPassword" required autoComplete="current-password" />
        </Field>
        <Field>
          <FieldLabel htmlFor="newPassword">New password</FieldLabel>
          <PasswordInput id="newPassword" name="newPassword" required minLength={10} autoComplete="new-password" />
          <FieldDescription>At least 10 characters. Other devices will be signed out.</FieldDescription>
        </Field>
      </FieldGroup>
      <FormAlert state={state} showSuccess />
      <div className="flex justify-end">
        <SubmitButton pending={pending} pendingText="Changing…">
          Change password
        </SubmitButton>
      </div>
    </form>
  );
}
