"use client";

import type { AiStatus } from "@pawpost/engine";

import { ActionButton } from "@/components/action-button";
import { FormAlert } from "@/components/form-alert";
import { LearnMore } from "@/components/help-link";
import { ToneBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { fieldError, idle } from "@/lib/action-state";
import { useActionForm } from "@/lib/use-action-form";

import { saveAiSettings, testAi } from "./actions";

export function AiSettingsForm({ status }: { status: AiStatus }) {
  const { state, pending, formProps } = useActionForm(saveAiSettings, idle);

  return (
    <form {...formProps} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Status:</span>
        {status.configured ? (
          <ToneBadge tone="success">
            Connected · key …{status.keyHint} from {status.keySource === "settings" ? "these settings" : "environment"}
          </ToneBadge>
        ) : (
          <ToneBadge tone="warning">Not configured</ToneBadge>
        )}
        {status.proxyEnabled && <ToneBadge tone="info">Using HTTP proxy</ToneBadge>}
      </div>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="apiKey">OpenAI API key</FieldLabel>
          <Input
            id="apiKey"
            name="apiKey"
            type="password"
            autoComplete="off"
            placeholder={status.keySource === "settings" ? `Saved (…${status.keyHint}). Leave blank to keep it.` : "sk-…"}
          />
          <FieldDescription>
            Stored encrypted. A key saved here overrides OPENAI_API_KEY from the environment.{" "}
            <LearnMore href="/help/ai-features#setting-up">Getting a key</LearnMore>
          </FieldDescription>
        </Field>
        {status.keySource === "settings" && (
          <Field orientation="horizontal">
            <Checkbox id="removeKey" name="removeKey" />
            <FieldLabel htmlFor="removeKey" className="font-normal">
              Remove the saved key
            </FieldLabel>
          </Field>
        )}
        <Field data-invalid={Boolean(fieldError(state, "model"))}>
          <FieldLabel htmlFor="model">Model</FieldLabel>
          <Input id="model" name="model" required defaultValue={status.model} className="max-w-xs" />
          <FieldDescription>Any model that supports structured outputs on the Responses API.</FieldDescription>
          <FieldError>{fieldError(state, "model")}</FieldError>
        </Field>
        <Field orientation="horizontal">
          <Switch id="classifyReplies" name="classifyReplies" defaultChecked={status.classifyReplies} />
          <FieldContent>
            <FieldLabel htmlFor="classifyReplies">Classify replies</FieldLabel>
            <FieldDescription>
              Tags each reply (interested, question, not now, opt-out…) and suppresses people who ask to stop. Reply text is sent
              to OpenAI. <LearnMore href="/help/ai-features#privacy">What is sent</LearnMore>
            </FieldDescription>
          </FieldContent>
        </Field>
      </FieldGroup>

      <FormAlert
        state={state}
        showSuccess
        errorHelp={{ href: "/help/troubleshooting#ai-errors", label: "Fixes for AI errors" }}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <ActionButton type="button" variant="outline" action={testAi} disabled={!status.configured}>
          Test connection
        </ActionButton>
        <SubmitButton pending={pending} pendingText="Saving…">
          Save
        </SubmitButton>
      </div>
    </form>
  );
}
