"use client";

import Link from "next/link";

import { FormAlert } from "@/components/form-alert";
import { PasswordInput } from "@/components/password-input";
import { SubmitButton } from "@/components/submit-button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { fieldError, idle } from "@/lib/action-state";
import { useActionForm } from "@/lib/use-action-form";

import { acceptInvitation, login, requestPasswordReset, resetPassword, setupOwner } from "./actions";

const PASSWORD_HINT = "At least 10 characters. A few unrelated words make a strong, memorable password.";

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
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Link href="/forgot-password" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput id="password" name="password" autoComplete="current-password" required />
        </Field>
      </FieldGroup>
      <FormAlert state={state} />
      <SubmitButton pending={pending} className="w-full" pendingText="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}

export function SetupForm({ requiresToken }: { requiresToken: boolean }) {
  const { state, pending, formProps } = useActionForm(setupOwner, idle);
  const err = (f: string) => fieldError(state, f);
  return (
    <form {...formProps} className="flex flex-col gap-6">
      <FieldGroup>
        <Field data-invalid={Boolean(err("name"))}>
          <FieldLabel htmlFor="name">Your name</FieldLabel>
          <Input id="name" name="name" autoComplete="name" required autoFocus />
          <FieldError>{err("name")}</FieldError>
        </Field>
        <Field data-invalid={Boolean(err("email"))}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" name="email" type="email" autoComplete="username" required />
          <FieldError>{err("email")}</FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={10} />
          <FieldDescription>{PASSWORD_HINT}</FieldDescription>
        </Field>
        {requiresToken && (
          <Field>
            <FieldLabel htmlFor="setupToken">Setup token</FieldLabel>
            <Input id="setupToken" name="setupToken" required autoComplete="off" />
            <FieldDescription>The SETUP_TOKEN value from the server configuration.</FieldDescription>
          </Field>
        )}
      </FieldGroup>
      <FormAlert state={state} />
      <SubmitButton pending={pending} className="w-full" pendingText="Creating your account…">
        Create owner account
      </SubmitButton>
    </form>
  );
}

export function AcceptInviteForm({ token, email }: { token: string; email: string }) {
  const { state, pending, formProps } = useActionForm(acceptInvitation.bind(null, token), idle);
  return (
    <form {...formProps} className="flex flex-col gap-6">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" value={email} disabled readOnly />
        </Field>
        <Field data-invalid={Boolean(fieldError(state, "name"))}>
          <FieldLabel htmlFor="name">Your name</FieldLabel>
          <Input id="name" name="name" autoComplete="name" required autoFocus />
          <FieldError>{fieldError(state, "name")}</FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Choose a password</FieldLabel>
          <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={10} />
          <FieldDescription>{PASSWORD_HINT}</FieldDescription>
        </Field>
      </FieldGroup>
      <FormAlert state={state} />
      <SubmitButton pending={pending} className="w-full" pendingText="Joining…">
        Join
      </SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const { state, pending, formProps } = useActionForm(requestPasswordReset, idle);
  if (state.status === "success") return <FormAlert state={state} showSuccess />;
  return (
    <form {...formProps} className="flex flex-col gap-6">
      <Field>
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </Field>
      <FormAlert state={state} />
      <SubmitButton pending={pending} className="w-full" pendingText="Sending…">
        Email me a reset link
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ token, email }: { token: string; email: string }) {
  const { state, pending, formProps } = useActionForm(resetPassword.bind(null, token), idle);
  return (
    <form {...formProps} className="flex flex-col gap-6">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Account</FieldLabel>
          <Input id="email" value={email} disabled readOnly autoComplete="username" />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">New password</FieldLabel>
          <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={10} autoFocus />
          <FieldDescription>{PASSWORD_HINT} You&apos;ll be signed out on all devices.</FieldDescription>
        </Field>
      </FieldGroup>
      <FormAlert state={state} />
      <SubmitButton pending={pending} className="w-full" pendingText="Saving…">
        Set new password
      </SubmitButton>
    </form>
  );
}
