"use client";

import { renderTemplate, STANDARD_VARIABLES } from "@pawpost/core/template";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { LearnMore } from "@/components/help-link";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { saveCampaignSteps } from "./actions";
import { AiReviewButton } from "./ai-review-dialog";
import { AiWriterDialog } from "./ai-writer-dialog";

export interface EditableStep {
  key: string;
  subject: string;
  body: string;
  waitDays: number;
}

export interface SampleContact {
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  attributes: Record<string, string>;
}

const FALLBACK_SAMPLE: SampleContact = {
  email: "alex@acme.com",
  firstName: "Alex",
  lastName: "Rivera",
  company: "Acme",
  attributes: {},
};

let keySeq = 0;
const newKey = () => `step-${++keySeq}`;

export function SequenceEditor({
  campaignId,
  initialSteps,
  attributeColumns,
  senderName,
  sampleContact,
  editable,
  aiEnabled,
}: {
  campaignId: string;
  sampleContact?: SampleContact;
  initialSteps: { subject: string; body: string; waitDays: number }[];
  attributeColumns: string[];
  senderName: string;
  editable: boolean;
  aiEnabled: boolean;
}) {
  const sample = sampleContact ?? FALLBACK_SAMPLE;
  const [steps, setSteps] = useState<EditableStep[]>(() => initialSteps.map((s) => ({ ...s, key: newKey() })));
  const [dirty, setDirty] = useState(false);
  const [saving, startSaving] = useTransition();

  const update = (next: EditableStep[]) => {
    setSteps(next);
    setDirty(true);
  };
  const patch = (index: number, change: Partial<EditableStep>) =>
    update(steps.map((s, i) => (i === index ? { ...s, ...change } : s)));
  const move = (index: number, delta: number) => {
    const next = [...steps];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item!);
    update(next);
  };

  const save = () =>
    startSaving(async () => {
      const result = await saveCampaignSteps(
        campaignId,
        steps.map(({ subject, body, waitDays }) => ({ subject, body, waitDays })),
      );
      if (result.status === "error") toast.error(result.message);
      else {
        toast.success("Sequence saved.");
        setDirty(false);
      }
    });

  const variables = [...STANDARD_VARIABLES, ...attributeColumns];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {editable
            ? "Follow-ups with an empty subject are sent as replies in the same thread. "
            : "Pause the campaign to edit its emails. "}
          <LearnMore href="/help/writing-emails">Writing emails that get replies</LearnMore>
        </p>
        {editable && (
          <div className="flex gap-2">
            <AiWriterDialog
              enabled={aiEnabled}
              senderName={senderName}
              onGenerated={(generated) => update(generated.map((s) => ({ ...s, key: newKey() })))}
            />
            <Button onClick={save} disabled={!dirty || saving}>
              {saving ? "Saving…" : dirty ? "Save sequence" : "Saved"}
            </Button>
          </div>
        )}
      </div>

      {steps.map((step, index) => (
        <StepCard
          key={step.key}
          step={step}
          index={index}
          count={steps.length}
          variables={variables}
          senderName={senderName}
          sampleContact={sample}
          editable={editable}
          aiEnabled={aiEnabled}
          onChange={(change) => patch(index, change)}
          onMove={(delta) => move(index, delta)}
          onRemove={() => update(steps.filter((_, i) => i !== index))}
        />
      ))}

      {editable && steps.length < 10 && (
        <Button
          variant="outline"
          className="self-start"
          onClick={() =>
            update([
              ...steps,
              { key: newKey(), subject: "", body: "Hi {{firstName|there}},\n\n\n\n{{senderFirstName}}", waitDays: 3 },
            ])
          }
        >
          <PlusIcon /> Add follow-up
        </Button>
      )}
    </div>
  );
}

function StepCard({
  step,
  index,
  count,
  variables,
  senderName,
  sampleContact,
  editable,
  aiEnabled,
  onChange,
  onMove,
  onRemove,
}: {
  step: EditableStep;
  index: number;
  count: number;
  variables: string[];
  senderName: string;
  sampleContact: SampleContact;
  editable: boolean;
  aiEnabled: boolean;
  onChange: (change: Partial<EditableStep>) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [previewWithoutName, setPreviewWithoutName] = useState(false);
  const isFirst = index === 0;

  const insertVariable = (name: string) => {
    const el = bodyRef.current;
    const token = ["firstName", "company"].includes(name)
      ? `{{${name}|${name === "company" ? "your team" : "there"}}}`
      : `{{${name}}}`;
    if (!el) return onChange({ body: step.body + token });
    const start = el.selectionStart ?? step.body.length;
    const end = el.selectionEnd ?? start;
    onChange({ body: step.body.slice(0, start) + token + step.body.slice(end) });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const fullName = [sampleContact.firstName, sampleContact.lastName].filter(Boolean).join(" ") || null;
  const sample = {
    ...sampleContact.attributes,
    firstName: previewWithoutName ? null : sampleContact.firstName,
    lastName: previewWithoutName ? null : sampleContact.lastName,
    fullName: previewWithoutName ? null : fullName,
    company: previewWithoutName ? null : sampleContact.company,
    email: sampleContact.email,
    senderName,
    senderFirstName: senderName.split(" ")[0] ?? senderName,
  };
  const words = step.body.trim() ? step.body.trim().split(/\s+/).length : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isFirst ? "Email 1" : `Follow-up ${index}`}</CardTitle>
        <CardDescription>
          {isFirst
            ? "Sent first."
            : `Sent ${step.waitDays} day${step.waitDays === 1 ? "" : "s"} after the previous email, if there's no reply.`}
        </CardDescription>
        {editable && (
          <CardAction className="flex gap-1">
            <AiReviewButton
              enabled={aiEnabled}
              subject={step.subject}
              body={step.body}
              onApply={(improved) => onChange(improved)}
            />
            <Button variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up">
              <ArrowUpIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={index === count - 1}
              onClick={() => onMove(1)}
              aria-label="Move down"
            >
              <ArrowDownIcon />
            </Button>
            <Button variant="ghost" size="icon-sm" disabled={count === 1} onClick={onRemove} aria-label="Remove email">
              <Trash2Icon />
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <Field className={isFirst ? "sm:col-span-2" : undefined}>
              <FieldLabel htmlFor={`${step.key}-subject`}>Subject</FieldLabel>
              <Input
                id={`${step.key}-subject`}
                value={step.subject}
                disabled={!editable}
                placeholder={isFirst ? "Quick question" : "Empty = reply in the same thread"}
                onChange={(e) => onChange({ subject: e.target.value })}
              />
            </Field>
            {!isFirst && (
              <Field>
                <FieldLabel htmlFor={`${step.key}-wait`}>Wait (days)</FieldLabel>
                <Input
                  id={`${step.key}-wait`}
                  type="number"
                  min={1}
                  max={60}
                  value={step.waitDays}
                  disabled={!editable}
                  onChange={(e) => onChange({ waitDays: Number(e.target.value) })}
                />
              </Field>
            )}
          </div>
          <Field>
            <FieldLabel htmlFor={`${step.key}-body`}>Body</FieldLabel>
            <Textarea
              id={`${step.key}-body`}
              ref={bodyRef}
              value={step.body}
              disabled={!editable}
              rows={10}
              className="font-mono text-sm"
              onChange={(e) => onChange({ body: e.target.value })}
            />
            <FieldDescription>
              {words} words{words > 120 ? " · shorter emails get more replies" : ""}. Plain text; the unsubscribe footer is added
              automatically.
            </FieldDescription>
          </Field>
          {editable && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs text-muted-foreground">
                Insert field (<LearnMore href="/help/writing-emails#personalising-with-fields">how fields work</LearnMore>):
              </span>
              {variables.map((name) => (
                <Button key={name} type="button" variant="secondary" size="xs" onClick={() => insertVariable(name)}>
                  {`{{${name}}}`}
                </Button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Preview <span className="font-normal text-muted-foreground">for {sampleContact.email}</span>
            </span>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={previewWithoutName} onCheckedChange={setPreviewWithoutName} size="sm" />
              Contact without a name
            </label>
          </div>
          <div className="flex flex-1 flex-col gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
            <div className="text-muted-foreground">
              <span className="font-medium text-foreground">Subject: </span>
              {renderTemplate(step.subject, sample) || (isFirst ? <em>(missing)</em> : <em>Re: previous subject</em>)}
            </div>
            <div className="whitespace-pre-wrap">{renderTemplate(step.body, sample)}</div>
            <div className="mt-auto border-t pt-3 text-xs whitespace-pre-wrap text-muted-foreground">
              {"--\n<your postal address>\nNot interested? Unsubscribe here: <link>"}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
