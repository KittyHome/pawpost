import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";

import { LearnMore } from "@/components/help-link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ActionState } from "@/lib/action-state";

/** Shows a Server Action's outcome above or below a form. */
export function FormAlert({
  state,
  showSuccess = false,
  errorHelp,
}: {
  state: ActionState<unknown>;
  showSuccess?: boolean;
  /** Guide to link from error messages, e.g. troubleshooting for connection errors. */
  errorHelp?: { href: string; label: string };
}) {
  if (state.status === "error") {
    return (
      <Alert variant="destructive">
        <CircleAlertIcon />
        <AlertDescription className="flex flex-col gap-2">
          <span className="whitespace-pre-line">{state.message}</span>
          {errorHelp && <LearnMore href={errorHelp.href}>{errorHelp.label}</LearnMore>}
        </AlertDescription>
      </Alert>
    );
  }
  if (showSuccess && state.status === "success" && state.message) {
    return (
      <Alert>
        <CircleCheckIcon />
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  }
  return null;
}
