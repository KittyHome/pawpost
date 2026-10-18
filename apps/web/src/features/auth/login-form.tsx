"use client";

import { FormAlert } from "@/components/form-alert";
import { SubmitButton } from "@/components/submit-button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { idle } from "@/lib/action-state";
import { useActionForm } from "@/lib/use-action-form";

import { login } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const { state, pending, formProps } = useActionForm(login, idle);

  return (
    <form {...formProps} className="flex flex-col gap-6">
      <input type="hidden" name="next" value={next ?? "/"} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
      </FieldGroup>
      <FormAlert state={state} />
      <SubmitButton pending={pending} className="w-full" pendingText="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
