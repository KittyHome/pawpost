"use client";

import type { GeneratedStep } from "@pawpost/ai";
import { Loader2Icon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { generateSequence } from "./actions";

/** Drafts a whole sequence from a short brief. The result replaces the editor content but is not saved. */
export function AiWriterDialog({
  enabled,
  senderName,
  onGenerated,
}: {
  enabled: boolean;
  senderName: string;
  onGenerated: (steps: GeneratedStep[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [tone, setTone] = useState("friendly");
  const [steps, setSteps] = useState("2");

  const submit = (form: FormData) =>
    startTransition(async () => {
      const result = await generateSequence({
        product: form.get("product"),
        audience: form.get("audience"),
        goal: form.get("goal"),
        link: form.get("link"),
        tone,
        steps,
        senderName,
      });
      if (result.status === "error") return void toast.error(result.message);
      if (result.status === "success" && result.data) {
        onGenerated(result.data);
        setOpen(false);
        toast.success("Draft ready. Review it, then save the sequence.");
      }
    });

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <SparklesIcon /> Write with AI
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Write a sequence with AI</DialogTitle>
          <DialogDescription>
            Describe the offer. This replaces the emails in the editor; nothing is saved until you click Save.
          </DialogDescription>
        </DialogHeader>
        {!enabled ? (
          <p className="text-sm text-muted-foreground">
            AI isn&apos;t set up yet. Add an OpenAI API key in{" "}
            <Link href="/settings" className="font-medium text-foreground underline">
              Settings
            </Link>
            .
          </p>
        ) : (
          <form action={submit} className="flex flex-col gap-6">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="product">What are you offering?</FieldLabel>
                <Textarea
                  id="product"
                  name="product"
                  required
                  rows={3}
                  placeholder="A free Chrome extension that drafts replies in Gmail with Alt+K, in your own voice."
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="audience">Who is it for?</FieldLabel>
                <Input id="audience" name="audience" required placeholder="Software engineers who write a lot of email" />
              </Field>
              <Field>
                <FieldLabel htmlFor="goal">What should they do?</FieldLabel>
                <Input id="goal" name="goal" required placeholder="Install the extension and try it once" />
              </Field>
              <Field>
                <FieldLabel htmlFor="link">Link (optional)</FieldLabel>
                <Input id="link" name="link" type="url" placeholder="https://www.kittyhome.org/extension" />
                <FieldDescription>Used at most once per email. Leave blank for a reply-based ask.</FieldDescription>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>Tone</FieldLabel>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="direct">Direct</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Emails</FieldLabel>
                  <Select value={steps} onValueChange={setSteps}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 (no follow-up)</SelectItem>
                      <SelectItem value="2">2 (one follow-up)</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </FieldGroup>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
                {pending ? "Writing…" : "Generate"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
