"use client";

import { useMemo, useState } from "react";

import { FormAlert } from "@/components/form-alert";
import { LearnMore } from "@/components/help-link";
import { SubmitButton } from "@/components/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { fieldError, idle } from "@/lib/action-state";
import { useActionForm } from "@/lib/use-action-form";
import { WEEKDAYS } from "@/lib/format";

import { updateCampaignSettings } from "./actions";

export interface CampaignSettingsDefaults {
  name: string;
  listId: string;
  timezone: string;
  sendDays: number[];
  windowStart: string;
  windowEnd: string;
  postalAddress: string;
  stopOnReply: boolean;
  mailboxIds: string[];
}

export function CampaignSettingsForm({
  campaignId,
  defaults,
  lists,
  mailboxes,
  editable,
  listLocked,
}: {
  campaignId: string;
  defaults: CampaignSettingsDefaults;
  lists: { id: string; name: string; contactCount: number }[];
  mailboxes: { id: string; email: string; status: string; dailyLimit: number }[];
  editable: boolean;
  listLocked: boolean;
}) {
  const { state, pending, formProps } = useActionForm(updateCampaignSettings.bind(null, campaignId), idle);
  const [listId, setListId] = useState(defaults.listId);
  const [days, setDays] = useState(defaults.sendDays.map(String));
  const [timezone, setTimezone] = useState(defaults.timezone);
  const timezones = useMemo(() => Intl.supportedValuesOf("timeZone"), []);
  const err = (field: string) => fieldError(state, field);

  return (
    <form {...formProps} className="flex flex-col gap-8">
      {/* Controlled widgets submit through hidden inputs. */}
      <input type="hidden" name="listId" value={listId} />
      {days.map((d) => (
        <input key={d} type="hidden" name="sendDays" value={d} />
      ))}

      <fieldset disabled={!editable} className="flex flex-col gap-8 disabled:opacity-70">
        <FieldSet>
          <FieldLegend>Basics</FieldLegend>
          <FieldGroup className="grid gap-4 md:grid-cols-2">
            <Field data-invalid={Boolean(err("name"))}>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input id="name" name="name" required defaultValue={defaults.name} />
              <FieldError>{err("name")}</FieldError>
            </Field>
            <Field>
              <FieldLabel>Contact list</FieldLabel>
              <Select value={listId} onValueChange={setListId} disabled={listLocked || !editable}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {lists.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} ({l.contactCount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {listLocked && <FieldDescription>Fixed once the campaign has started.</FieldDescription>}
            </Field>
          </FieldGroup>
        </FieldSet>

        <FieldSet>
          <FieldLegend>Schedule</FieldLegend>
          <FieldDescription>
            Emails only go out inside this window, in the recipients&apos; likely timezone.{" "}
            <LearnMore href="/help/campaigns#schedule">Scheduling</LearnMore>
          </FieldDescription>
          <FieldGroup className="grid gap-4 md:grid-cols-[1fr_8rem_8rem]">
            <Field data-invalid={Boolean(err("timezone"))}>
              <FieldLabel htmlFor="timezone">Timezone</FieldLabel>
              <Input
                id="timezone"
                name="timezone"
                list="timezones"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                required
              />
              <datalist id="timezones">
                {timezones.map((tz) => (
                  <option key={tz} value={tz} />
                ))}
              </datalist>
              <FieldError>{err("timezone")}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="windowStart">From</FieldLabel>
              <Input id="windowStart" name="windowStart" type="time" required defaultValue={defaults.windowStart} />
            </Field>
            <Field>
              <FieldLabel htmlFor="windowEnd">Until</FieldLabel>
              <Input
                id="windowEnd"
                name="windowEnd"
                type="time"
                required
                defaultValue={defaults.windowEnd === "24:00" ? "23:59" : defaults.windowEnd}
              />
            </Field>
          </FieldGroup>
          <Field data-invalid={Boolean(err("sendDays"))}>
            <FieldLabel>Days</FieldLabel>
            <ToggleGroup
              type="multiple"
              variant="outline"
              value={days}
              onValueChange={setDays}
              className="flex-wrap justify-start"
            >
              {WEEKDAYS.map((d) => (
                <ToggleGroupItem key={d.value} value={String(d.value)} aria-label={d.short}>
                  {d.short}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <FieldError>{err("sendDays")}</FieldError>
          </Field>
        </FieldSet>

        <FieldSet>
          <FieldLegend>Sending mailboxes</FieldLegend>
          <FieldDescription>
            Contacts are spread across these. Follow-ups always come from the mailbox that sent the first email.
          </FieldDescription>
          {mailboxes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No mailboxes connected yet.</p>
          ) : (
            <FieldGroup className="grid gap-3 md:grid-cols-2">
              {mailboxes.map((m) => (
                <Field key={m.id} orientation="horizontal">
                  <Checkbox
                    id={`mb-${m.id}`}
                    name="mailboxIds"
                    value={m.id}
                    defaultChecked={defaults.mailboxIds.includes(m.id)}
                  />
                  <FieldContent>
                    <FieldLabel htmlFor={`mb-${m.id}`}>{m.email}</FieldLabel>
                    <FieldDescription>
                      {m.status === "active" ? `Up to ${m.dailyLimit}/day` : `Currently ${m.status}`}
                    </FieldDescription>
                  </FieldContent>
                </Field>
              ))}
            </FieldGroup>
          )}
        </FieldSet>

        <FieldSet>
          <FieldLegend>Compliance</FieldLegend>
          <FieldGroup>
            <Field data-invalid={Boolean(err("postalAddress"))}>
              <FieldLabel htmlFor="postalAddress">Postal address</FieldLabel>
              <Textarea
                id="postalAddress"
                name="postalAddress"
                rows={2}
                defaultValue={defaults.postalAddress}
                placeholder="KittyHome, 123 Example Street, City, Country"
              />
              <FieldDescription>
                Added to every email with an unsubscribe link. Required by CAN-SPAM and similar laws.{" "}
                <LearnMore href="/help/compliance">Staying within the law</LearnMore>
              </FieldDescription>
              <FieldError>{err("postalAddress")}</FieldError>
            </Field>
            <Field orientation="horizontal">
              <Switch id="stopOnReply" name="stopOnReply" defaultChecked={defaults.stopOnReply} />
              <FieldContent>
                <FieldLabel htmlFor="stopOnReply">Stop the sequence when someone replies</FieldLabel>
                <FieldDescription>Recommended. Out-of-office replies don&apos;t count.</FieldDescription>
              </FieldContent>
            </Field>
          </FieldGroup>
        </FieldSet>
      </fieldset>

      <FormAlert state={state} showSuccess />
      {editable && (
        <div className="flex justify-end">
          <SubmitButton pending={pending} pendingText="Saving…">
            Save settings
          </SubmitButton>
        </div>
      )}
    </form>
  );
}
