"use client";

import { Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog, type ConfirmOptions } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/action-state";

/**
 * Runs a Server Action on click, optionally behind a confirmation dialog,
 * and reports the outcome as a toast.
 */
export function ActionButton({
  action,
  confirm,
  successMessage,
  children,
  ...buttonProps
}: Omit<React.ComponentProps<typeof Button>, "onClick" | "action"> & {
  action: () => Promise<ActionState<unknown>>;
  confirm?: ConfirmOptions;
  successMessage?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const run = () =>
    startTransition(async () => {
      const result = await action();
      if (result.status === "error") toast.error(result.message);
      else if (result.status === "success") {
        const message = result.message ?? successMessage;
        if (message) toast.success(message);
      }
    });

  return (
    <>
      <Button {...buttonProps} disabled={pending || buttonProps.disabled} onClick={confirm ? () => setOpen(true) : run}>
        {pending && <Loader2Icon className="animate-spin" aria-hidden />}
        {children}
      </Button>
      {confirm && (
        <ConfirmDialog {...confirm} open={open} onOpenChange={setOpen} onConfirm={action} successMessage={successMessage} />
      )}
    </>
  );
}
