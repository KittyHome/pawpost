"use client";

import { PROVIDER_PRESETS } from "@pawpost/mail/presets";
import Link from "next/link";
import { useState } from "react";

import { FormAlert } from "@/components/form-alert";
import { LearnMore } from "@/components/help-link";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSet, FieldLegend } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fieldError, idle } from "@/lib/action-state";
import { useActionForm } from "@/lib/use-action-form";

import { saveMailbox } from "./actions";

export interface MailboxDefaults {
  email: string;
  fromName: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUsername: string;
  dailyLimit: number;
  minIntervalSeconds: number;
}

const google = PROVIDER_PRESETS[0]!;

const PASSWORD_HELP: Record<string, string> = {
  google: "/help/mailboxes#google-workspace-and-gmail",
  microsoft: "/help/mailboxes#microsoft-365-and-outlook",
  zoho: "/help/mailboxes#other-providers",
  custom: "/help/mailboxes#other-providers",
};

export function MailboxForm({ mailboxId, defaults }: { mailboxId?: string; defaults?: MailboxDefaults }) {
  const { state, pending, formProps } = useActionForm(saveMailbox.bind(null, mailboxId ?? null), idle);
  const editing = Boolean(mailboxId);

  const initialPreset =
    PROVIDER_PRESETS.find((p) => p.smtp.host && p.smtp.host === defaults?.smtpHost)?.id ?? (defaults ? "custom" : google.id);
  const [presetId, setPresetId] = useState(initialPreset);
  const preset = PROVIDER_PRESETS.find((p) => p.id === presetId) ?? google;

  const [server, setServer] = useState({
    smtpHost: defaults?.smtpHost ?? google.smtp.host,
    smtpPort: String(defaults?.smtpPort ?? google.smtp.port),
    smtpSecure: defaults?.smtpSecure ?? google.smtp.secure,
    imapHost: defaults?.imapHost ?? google.imap.host,
    imapPort: String(defaults?.imapPort ?? google.imap.port),
    imapSecure: defaults?.imapSecure ?? google.imap.secure,
  });

  const applyPreset = (id: string) => {
    setPresetId(id);
    const next = PROVIDER_PRESETS.find((p) => p.id === id);
    if (next && next.id !== "custom") {
      setServer({
        smtpHost: next.smtp.host,
        smtpPort: String(next.smtp.port),
        smtpSecure: next.smtp.secure,
        imapHost: next.imap.host,
        imapPort: String(next.imap.port),
        imapSecure: next.imap.secure,
      });
    }
  };

  const err = (field: string) => fieldError(state, field);

  return (
    <form {...formProps} className="max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>{editing ? "Edit mailbox" : "Connect a mailbox"}</CardTitle>
          <CardDescription>
            Pawpost logs in to verify SMTP (sending) and IMAP (reading replies and bounces) before saving.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-8">
          <FieldSet>
            <FieldLegend>Account</FieldLegend>
            <FieldGroup className="grid gap-4 md:grid-cols-2">
              <Field className="md:col-span-2">
                <FieldLabel>Provider</FieldLabel>
                <Select value={presetId} onValueChange={applyPreset}>
                  <SelectTrigger className="w-full md:w-80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_PRESETS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field data-invalid={Boolean(err("email"))}>
                <FieldLabel htmlFor="email">Email address</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  defaultValue={defaults?.email}
                  placeholder="sam@getkittyhome.com"
                />
                <FieldError>{err("email")}</FieldError>
              </Field>
              <Field data-invalid={Boolean(err("fromName"))}>
                <FieldLabel htmlFor="fromName">Sender name</FieldLabel>
                <Input id="fromName" name="fromName" required defaultValue={defaults?.fromName} placeholder="Sam Lee" />
                <FieldDescription>A real person&apos;s name reads better than a company name.</FieldDescription>
                <FieldError>{err("fromName")}</FieldError>
              </Field>
              <Field data-invalid={Boolean(err("smtpUsername"))}>
                <FieldLabel htmlFor="smtpUsername">Username</FieldLabel>
                <Input
                  id="smtpUsername"
                  name="smtpUsername"
                  required
                  defaultValue={defaults?.smtpUsername}
                  placeholder="Usually the email address"
                />
                <FieldError>{err("smtpUsername")}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="smtpPassword">Password</FieldLabel>
                <Input
                  id="smtpPassword"
                  name="smtpPassword"
                  type="password"
                  autoComplete="new-password"
                  required={!editing}
                  placeholder={editing ? "Leave blank to keep the saved password" : ""}
                />
                <FieldDescription>
                  {preset.passwordHint} <LearnMore href={PASSWORD_HELP[preset.id] ?? "/help/mailboxes"}>Step-by-step</LearnMore>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend>Servers</FieldLegend>
            <FieldGroup className="grid gap-4 md:grid-cols-[1fr_8rem_auto]">
              <ServerFields
                prefix="smtp"
                label="SMTP"
                host={server.smtpHost}
                port={server.smtpPort}
                secure={server.smtpSecure}
                onChange={(patch) => setServer((s) => ({ ...s, ...patch }))}
                error={err("smtpHost") ?? err("smtpPort")}
              />
              <ServerFields
                prefix="imap"
                label="IMAP"
                host={server.imapHost}
                port={server.imapPort}
                secure={server.imapSecure}
                onChange={(patch) => setServer((s) => ({ ...s, ...patch }))}
                error={err("imapHost") ?? err("imapPort")}
              />
            </FieldGroup>
            <FieldDescription>
              SSL/TLS on for ports 465 and 993; off for 587 and 143 (encryption is then switched on with STARTTLS).{" "}
              <LearnMore href="/help/mailboxes#other-providers">Server settings explained</LearnMore>
            </FieldDescription>
            <FieldDescription>IMAP uses the same username and password unless you fill these in:</FieldDescription>
            <FieldGroup className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="imapUsername">IMAP username (optional)</FieldLabel>
                <Input
                  id="imapUsername"
                  name="imapUsername"
                  defaultValue={defaults && defaults.imapUsername !== defaults.smtpUsername ? defaults.imapUsername : ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="imapPassword">IMAP password (optional)</FieldLabel>
                <Input id="imapPassword" name="imapPassword" type="password" autoComplete="new-password" />
              </Field>
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend>Pacing</FieldLegend>
            <FieldGroup className="grid gap-4 md:grid-cols-2">
              <Field data-invalid={Boolean(err("dailyLimit"))}>
                <FieldLabel htmlFor="dailyLimit">Daily limit</FieldLabel>
                <Input
                  id="dailyLimit"
                  name="dailyLimit"
                  type="number"
                  min={1}
                  max={500}
                  defaultValue={defaults?.dailyLimit ?? 30}
                />
                <FieldDescription>
                  Emails per rolling 24 hours. Start new mailboxes at 10–20.{" "}
                  <LearnMore href="/help/deliverability#ramp-up-new-mailboxes-slowly">Ramp-up plan</LearnMore>
                </FieldDescription>
                <FieldError>{err("dailyLimit")}</FieldError>
              </Field>
              <Field data-invalid={Boolean(err("minIntervalSeconds"))}>
                <FieldLabel htmlFor="minIntervalSeconds">Minimum gap (seconds)</FieldLabel>
                <Input
                  id="minIntervalSeconds"
                  name="minIntervalSeconds"
                  type="number"
                  min={30}
                  max={3600}
                  defaultValue={defaults?.minIntervalSeconds ?? 180}
                />
                <FieldDescription>Time between two sends from this mailbox, plus random jitter.</FieldDescription>
                <FieldError>{err("minIntervalSeconds")}</FieldError>
              </Field>
            </FieldGroup>
          </FieldSet>

          <FormAlert
            state={state}
            errorHelp={{ href: "/help/troubleshooting#mailbox-connection-errors", label: "Fixes for connection errors" }}
          />
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t">
          <Button variant="outline" asChild>
            <Link href="/mailboxes">Cancel</Link>
          </Button>
          <SubmitButton pending={pending} pendingText="Checking connection…">
            {editing ? "Save changes" : "Connect mailbox"}
          </SubmitButton>
        </CardFooter>
      </Card>
    </form>
  );
}

function ServerFields({
  prefix,
  label,
  host,
  port,
  secure,
  onChange,
  error,
}: {
  prefix: "smtp" | "imap";
  label: string;
  host: string;
  port: string;
  secure: boolean;
  onChange: (patch: Record<string, string | boolean>) => void;
  error?: string;
}) {
  return (
    <>
      <Field data-invalid={Boolean(error)}>
        <FieldLabel htmlFor={`${prefix}Host`}>{label} host</FieldLabel>
        <Input
          id={`${prefix}Host`}
          name={`${prefix}Host`}
          required
          value={host}
          onChange={(e) => onChange({ [`${prefix}Host`]: e.target.value })}
        />
        <FieldError>{error}</FieldError>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}Port`}>Port</FieldLabel>
        <Input
          id={`${prefix}Port`}
          name={`${prefix}Port`}
          type="number"
          required
          value={port}
          onChange={(e) => onChange({ [`${prefix}Port`]: e.target.value })}
        />
      </Field>
      <Field orientation="horizontal" className="md:self-end md:pb-2">
        <Checkbox
          id={`${prefix}Secure`}
          name={`${prefix}Secure`}
          checked={secure}
          onCheckedChange={(checked) => onChange({ [`${prefix}Secure`]: checked === true })}
        />
        <FieldLabel htmlFor={`${prefix}Secure`} className="font-normal">
          SSL/TLS
        </FieldLabel>
      </Field>
    </>
  );
}
