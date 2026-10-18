"use client";

import { startTransition, useActionState } from "react";

/**
 * `useActionState` for forms, without React 19's automatic field reset.
 *
 * A plain `<form action={fn}>` clears uncontrolled inputs whenever the action
 * finishes, even when it returned a validation error, so users would retype
 * everything. Submitting through `onSubmit` keeps their input; `action` stays
 * set so the form still works before hydration.
 */
export function useActionForm<State>(
  action: (state: Awaited<State>, form: FormData) => State | Promise<State>,
  initial: Awaited<State>,
) {
  const [state, dispatch, pending] = useActionState(action, initial);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const form = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(form));
  };

  return { state, pending, formProps: { action: dispatch, onSubmit } };
}
