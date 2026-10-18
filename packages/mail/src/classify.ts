import type { InboundMessage } from "./types";

export type InboundClassification =
  | { kind: "bounce"; permanent: boolean; recipients: string[]; referencedMessageIds: string[] }
  | { kind: "auto_reply"; referencedMessageIds: string[] }
  | { kind: "reply"; referencedMessageIds: string[] };

const BOUNCE_SENDER = /^(mailer-daemon|postmaster|mail-daemon|mailerdaemon)@/i;
const BOUNCE_SUBJECT =
  /(undeliverable|undelivered|delivery status notification|delivery (has )?failed|failure notice|returned mail|mail delivery (failed|system)|could not be delivered|address not found)/i;
const AUTO_REPLY_SUBJECT =
  /^\s*(auto(matic)?[\s-]?(reply|response)|out of (the )?office|ooo\b|away from|on vacation|abwesenheit|absence)/i;

const MESSAGE_ID = /<[^<>\s@]+@[^<>\s]+>/g;

export function classifyInbound(message: InboundMessage): InboundClassification {
  if (isBounce(message)) {
    return {
      kind: "bounce",
      permanent: isPermanentFailure(message.raw),
      recipients: extractFailedRecipients(message.raw),
      referencedMessageIds: extractQuotedMessageIds(message.raw),
    };
  }

  const referencedMessageIds = unique([message.inReplyTo, ...message.references].filter(isString));
  if (isAutoReply(message)) return { kind: "auto_reply", referencedMessageIds };
  return { kind: "reply", referencedMessageIds };
}

function isBounce(message: InboundMessage): boolean {
  if (/multipart\/report/i.test(message.contentType) && /report-type="?delivery-status/i.test(message.contentType)) {
    return true;
  }
  return (
    (message.from !== null && BOUNCE_SENDER.test(message.from)) ||
    (BOUNCE_SUBJECT.test(message.subject) && /Final-Recipient:|Status:\s*5\./i.test(message.raw))
  );
}

/** Delayed-delivery notices (4.x.x) are not bounces; only hard failures count. */
function isPermanentFailure(raw: string): boolean {
  const statuses = [...raw.matchAll(/^Status:\s*(\d)\.\d{1,3}\.\d{1,3}/gim)].map((m) => m[1]);
  if (statuses.length) return statuses.includes("5");
  if (/^Action:\s*delayed/im.test(raw)) return false;
  // Non-standard bounces (no DSN fields): look for an SMTP 5xx reply in the text.
  return /\b5\d\d[\s-]+\d?\.?\d?\.?\d?/.test(raw) || /^Action:\s*failed/im.test(raw);
}

function extractFailedRecipients(raw: string): string[] {
  const found = [...raw.matchAll(/^(?:Final|Original)-Recipient:\s*rfc822;\s*<?([^\s<>;]+@[^\s<>;]+)>?/gim)].map((m) =>
    m[1]!.toLowerCase(),
  );
  const gmail = [...raw.matchAll(/^X-Failed-Recipients:\s*(.+)$/gim)].flatMap((m) =>
    m[1]!.split(",").map((s) => s.trim().toLowerCase()),
  );
  return unique([...found, ...gmail]);
}

/** Message-IDs from (possibly folded) ID headers anywhere in the bounce, incl. the quoted original. */
function extractQuotedMessageIds(raw: string): string[] {
  const unfolded = raw.replace(/\r?\n[ \t]+/g, " ");
  const headerValues = [...unfolded.matchAll(/^(?:Message-ID|In-Reply-To|References):\s*(.+)$/gim)].map((m) => m[1]!);
  return unique(headerValues.flatMap((value) => value.match(MESSAGE_ID) ?? []));
}

function isAutoReply(message: InboundMessage): boolean {
  const h = message.headers;
  const autoSubmitted = h["auto-submitted"]?.toLowerCase();
  if (autoSubmitted && autoSubmitted !== "no") return true;
  if (h["x-autoreply"] || h["x-autorespond"] || h["x-auto-response-suppress"]?.match(/all|oof/i)) return true;
  if (/auto_reply|auto-reply/i.test(h["precedence"] ?? "")) return true;
  return AUTO_REPLY_SUBJECT.test(message.subject);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function isString(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}
