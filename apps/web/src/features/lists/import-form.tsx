"use client";

import type { ImportReport } from "@pawpost/engine";
import { CircleCheckIcon } from "lucide-react";
import Link from "next/link";

import { FormAlert } from "@/components/form-alert";
import { LearnMore } from "@/components/help-link";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { fieldError, idle, type ActionState } from "@/lib/action-state";
import { useActionForm } from "@/lib/use-action-form";
import { formatNumber } from "@/lib/format";

import { importContacts } from "./actions";

const REASON_LABELS: Record<string, string> = {
  invalid_email: "Invalid address",
  duplicate: "Duplicate in file",
  role_address: "Role address (info@, sales@…)",
  missing_email: "No email",
  suppressed: "On suppression list",
  no_mail_domain: "Domain can't receive mail",
};

export function ImportForm({ listId }: { listId?: string }) {
  const { state, pending, formProps } = useActionForm<ActionState<ImportReport>>(importContacts.bind(null, listId ?? null), idle);
  const report = state.status === "success" ? state.data : undefined;

  return (
    <div className="flex flex-col gap-6">
      <form {...formProps} className="flex flex-col gap-6">
        <FieldGroup>
          {!listId && (
            <Field data-invalid={Boolean(fieldError(state, "name"))}>
              <FieldLabel htmlFor="name">List name</FieldLabel>
              <Input id="name" name="name" required placeholder="Developers – October" />
              <FieldError>{fieldError(state, "name")}</FieldError>
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="file">CSV file</FieldLabel>
            <Input id="file" name="file" type="file" accept=".csv,text/csv" required />
            <FieldDescription>
              Needs an <code>email</code> column. <code>name</code> or <code>first_name</code>/<code>last_name</code> and{" "}
              <code>company</code> are recognised; other columns become template fields like <code>{"{{city}}"}</code>.{" "}
              <LearnMore href="/help/contact-lists#preparing-your-csv-file">CSV format</LearnMore>
            </FieldDescription>
          </Field>
          <Field orientation="horizontal">
            <Checkbox id="checkDomains" name="checkDomains" defaultChecked />
            <FieldContent>
              <FieldLabel htmlFor="checkDomains">Check that each domain can receive mail</FieldLabel>
              <FieldDescription>DNS lookup per domain. Catches typos and dead domains that would bounce.</FieldDescription>
            </FieldContent>
          </Field>
          <Field orientation="horizontal">
            <Checkbox id="skipRoleAddresses" name="skipRoleAddresses" defaultChecked />
            <FieldContent>
              <FieldLabel htmlFor="skipRoleAddresses">Skip role addresses</FieldLabel>
              <FieldDescription>Shared inboxes like info@ or support@ rarely reply and often report spam.</FieldDescription>
            </FieldContent>
          </Field>
        </FieldGroup>
        <FormAlert state={state} />
        <div className="flex justify-end">
          <SubmitButton pending={pending} pendingText="Importing…">
            {listId ? "Import into this list" : "Create list"}
          </SubmitButton>
        </div>
      </form>

      {report && <ImportSummary report={report} showLink={!listId} />}
    </div>
  );
}

function ImportSummary({ report, showLink }: { report: ImportReport; showLink: boolean }) {
  const rejectedTotal = Object.values(report.rejected).reduce((a, b) => a + b, 0);
  return (
    <Alert>
      <CircleCheckIcon />
      <AlertTitle>
        Imported {formatNumber(report.imported)} of {formatNumber(report.totalRows)} rows
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        {report.alreadyInList > 0 && <p>{formatNumber(report.alreadyInList)} were already in this list.</p>}
        {rejectedTotal > 0 && (
          <ul className="grid gap-1 sm:grid-cols-2">
            {Object.entries(report.rejected)
              .filter(([, n]) => n > 0)
              .map(([reason, n]) => (
                <li key={reason}>
                  {REASON_LABELS[reason] ?? reason}: <span className="font-medium tabular-nums">{formatNumber(n)}</span>
                </li>
              ))}
          </ul>
        )}
        {report.rejectedSample.length > 0 && (
          <details>
            <summary className="cursor-pointer">Show skipped rows</summary>
            <ul className="mt-2 max-h-48 overflow-auto font-mono text-xs">
              {report.rejectedSample.map((r) => (
                <li key={`${r.line}-${r.email}`}>
                  line {r.line}: {r.email || "(empty)"} · {REASON_LABELS[r.reason] ?? r.reason}
                </li>
              ))}
            </ul>
          </details>
        )}
        {showLink && (
          <Button asChild size="sm" className="w-fit">
            <Link href={`/lists/${report.listId}`}>Open list</Link>
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
