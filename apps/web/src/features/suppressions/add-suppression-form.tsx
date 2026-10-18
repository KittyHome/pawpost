"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { SubmitButton } from "@/components/submit-button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { fieldError, idle } from "@/lib/action-state";
import { useActionForm } from "@/lib/use-action-form";

import { addSuppression } from "./actions";

export function AddSuppressionForm() {
  const { state, pending, formProps } = useActionForm(addSuppression, idle);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      if (state.message) toast.success(state.message);
    } else if (state.status === "error" && !state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form ref={formRef} {...formProps} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <Field className="flex-1" data-invalid={Boolean(fieldError(state, "email"))}>
        <FieldLabel htmlFor="email">Email address</FieldLabel>
        <Input id="email" name="email" type="email" required placeholder="someone@example.com" />
        <FieldError>{fieldError(state, "email")}</FieldError>
      </Field>
      <Field className="flex-1">
        <FieldLabel htmlFor="note">Note (optional)</FieldLabel>
        <Input id="note" name="note" placeholder="Asked by phone" />
      </Field>
      <SubmitButton pending={pending} pendingText="Adding…">
        Suppress
      </SubmitButton>
    </form>
  );
}
