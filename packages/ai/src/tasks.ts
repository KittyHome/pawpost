/**
 * The AI features, as provider-independent tasks. Each task owns its prompt,
 * output schema and post-validation, so behaviour is identical across providers.
 *
 * Schemas avoid optional fields and numeric bounds because strict structured
 * output modes don't support them; bounds are enforced after parsing instead.
 */
import { z } from "zod";

import type { AiProvider } from "./provider";

/* ------------------------------ Sequence writer ----------------------------- */

export const sequenceBrief = z.object({
  product: z.string().trim().min(3, "Describe what you're offering.").max(2000),
  audience: z.string().trim().min(3, "Describe who the emails are for.").max(1000),
  goal: z.string().trim().min(3, "Say what you want the reader to do.").max(500),
  link: z.string().trim().max(300).default(""),
  tone: z.enum(["friendly", "professional", "casual", "direct"]).default("friendly"),
  steps: z.coerce.number().int().min(1).max(4).default(2),
  senderName: z.string().trim().max(100).default(""),
});
export type SequenceBrief = z.infer<typeof sequenceBrief>;

const sequenceOutput = z.object({
  steps: z.array(
    z.object({
      subject: z.string().describe("Empty string for follow-ups that reply in the same thread."),
      body: z.string(),
      waitDays: z.number().int().describe("Days after the previous email. 0 for the first email."),
    }),
  ),
});
export type GeneratedStep = z.infer<typeof sequenceOutput>["steps"][number];

const SEQUENCE_INSTRUCTIONS = `You write short cold outreach email sequences that read like one real person wrote them by hand.

Rules:
- Plain text only. No markdown, no HTML, no emojis, no bullet lists.
- First email: 50–110 words. Follow-ups: 25–70 words.
- Exactly one clear, low-effort ask per email (a yes/no question or a single link).
- Greet with {{firstName|there}}. Sign off with {{senderFirstName}}. You may use {{company|your team}}. Use no other placeholders.
- If a link is provided, include it at most once per email, as a bare URL. Never invent links, prices, statistics, customers or claims not in the brief.
- Subject lines: 2–6 words, lowercase-friendly, no clickbait, no ALL CAPS, no "free", "guarantee", "act now" or exclamation marks.
- Follow-ups have an empty subject so they thread as replies, and must add something new rather than just "bumping".
- Don't mention that this is a cold email, a sequence, or automated.
- waitDays: 0 for the first email, then 3–6 days.`;

export async function writeSequence(provider: AiProvider, rawBrief: unknown): Promise<GeneratedStep[]> {
  const brief = sequenceBrief.parse(rawBrief);
  const input = [
    `Offering: ${brief.product}`,
    `Audience: ${brief.audience}`,
    `Goal / ask: ${brief.goal}`,
    `Link: ${brief.link || "(none, don't include any link)"}`,
    `Tone: ${brief.tone}`,
    `Sender name: ${brief.senderName || "(use {{senderFirstName}})"}`,
    `Number of emails: ${brief.steps}`,
  ].join("\n");

  const result = await provider.generate({
    task: "cold_email_sequence",
    instructions: SEQUENCE_INSTRUCTIONS,
    input,
    schema: sequenceOutput,
  });

  return result.steps.slice(0, brief.steps).map((step, index) => ({
    subject: index === 0 ? step.subject.trim() || "Quick question" : "",
    body: step.body.replace(/\r\n?/g, "\n").trim(),
    waitDays: index === 0 ? 0 : clamp(step.waitDays, 1, 14),
  }));
}

/* -------------------------------- Copy review ------------------------------- */

const reviewOutput = z.object({
  score: z.number().describe("0–100. 100 = reads like a personal note and is very likely to reach the inbox."),
  verdict: z.enum(["good", "needs_work", "risky"]),
  issues: z.array(
    z.object({
      severity: z.enum(["high", "medium", "low"]),
      message: z.string(),
    }),
  ),
  improvedSubject: z.string(),
  improvedBody: z.string(),
});
export type CopyReview = z.infer<typeof reviewOutput>;

const REVIEW_INSTRUCTIONS = `You review cold emails for deliverability and reply-rate before they are sent.

Check for: spam-trigger wording, hype, exclamation marks, ALL CAPS, more than one link, images/HTML, length (over ~120 words is too long),
more than one ask, vague asks, claims that sound invented, missing personalisation, and anything that reads as mass-mailed.
Template placeholders like {{firstName|there}} are filled per contact; keep them as-is and don't flag them.
Return at most 6 issues, most important first. Then provide an improved version that fixes them while keeping the sender's offer and voice.
The improved body must stay plain text and keep the same placeholders. If the subject is empty (a threaded follow-up), keep improvedSubject empty.`;

export async function reviewCopy(provider: AiProvider, email: { subject: string; body: string }): Promise<CopyReview> {
  const result = await provider.generate({
    task: "cold_email_review",
    instructions: REVIEW_INSTRUCTIONS,
    input: `Subject: ${email.subject || "(empty: follow-up in the same thread)"}\n\nBody:\n${email.body}`,
    schema: reviewOutput,
  });
  return {
    ...result,
    score: clamp(Math.round(result.score), 0, 100),
    issues: result.issues.slice(0, 6),
    improvedSubject: email.subject ? result.improvedSubject.trim() : "",
    improvedBody: result.improvedBody.trim(),
  };
}

/* ---------------------------- Reply classification -------------------------- */

export const REPLY_INTENTS = [
  "interested",
  "question",
  "referral",
  "not_now",
  "not_interested",
  "unsubscribe",
  "out_of_office",
  "wrong_person",
  "other",
] as const;
export type ReplyIntent = (typeof REPLY_INTENTS)[number];

const replyOutput = z.object({
  intent: z.enum(REPLY_INTENTS),
  summary: z.string().describe("One short sentence, max 140 characters, in English."),
  confidence: z.number().describe("0 to 1."),
});
export type ReplyClassification = z.infer<typeof replyOutput>;

const REPLY_INSTRUCTIONS = `You triage replies to a cold outreach email. Classify the reply author's intent:
- interested: wants to talk, try it, or learn more
- question: asks something before deciding
- referral: points to someone else who should be contacted
- not_now: maybe later, bad timing
- not_interested: declines but doesn't ask to stop
- unsubscribe: asks to stop emailing, be removed, or complains about the email
- out_of_office: automatic away / vacation reply
- wrong_person: says they're not the right contact, without naming someone
- other: anything else
Only judge the new reply text, not the quoted original email. When unsure between not_interested and unsubscribe, choose unsubscribe.`;

export async function classifyReply(
  provider: AiProvider,
  reply: { originalSubject: string; text: string },
  signal?: AbortSignal,
): Promise<ReplyClassification> {
  const result = await provider.generate({
    task: "reply_triage",
    instructions: REPLY_INSTRUCTIONS,
    input: `Original subject: ${reply.originalSubject}\n\nReply:\n${reply.text.slice(0, 4000)}`,
    schema: replyOutput,
    maxOutputTokens: 1000,
    signal,
  });
  return { ...result, summary: result.summary.slice(0, 200), confidence: clamp(result.confidence, 0, 1) };
}

/* -------------------------------- Connectivity ------------------------------ */

export async function pingProvider(provider: AiProvider): Promise<void> {
  await provider.generate({
    task: "ping",
    instructions: "Reply with ok = true.",
    input: "ping",
    schema: z.object({ ok: z.boolean() }),
    maxOutputTokens: 200,
  });
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}
