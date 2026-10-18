import { DomainError } from "./errors";
import { renderTemplate, type TemplateContext } from "./template";

export interface ComposeInput {
  step: { subject: string; body: string };
  /** Rendered subject of the first email in this thread; required for follow-ups with no subject. */
  threadSubject: string | null;
  context: TemplateContext;
  /** Physical mailing address. Required by CAN-SPAM and appended to every email. */
  postalAddress: string;
  /** Human-facing page with a confirm button (safe against link scanners). */
  unsubscribeUrl: string;
  /** RFC 8058 one-click endpoint, used by Gmail/Yahoo "Unsubscribe" buttons. */
  oneClickUnsubscribeUrl: string;
  /** Sender address, used for the mailto: unsubscribe fallback. */
  senderEmail: string;
  /** Message-IDs already sent in this thread, oldest first. Empty for the first email. */
  threadMessageIds: readonly string[];
}

export interface ComposedEmail {
  subject: string;
  text: string;
  headers: Record<string, string>;
}

export function composeEmail(input: ComposeInput): ComposedEmail {
  const subject = composeSubject(input);
  const body = normalizeBody(renderTemplate(input.step.body, input.context));
  if (!body) {
    throw new DomainError("empty_body", "Email body is empty after filling in contact fields.");
  }

  const footer = ["--", input.postalAddress.trim(), `Not interested? Unsubscribe here: ${input.unsubscribeUrl}`].join("\n");

  const headers: Record<string, string> = {
    "List-Unsubscribe": `<${input.oneClickUnsubscribeUrl}>, <mailto:${input.senderEmail}?subject=unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };

  const lastMessageId = input.threadMessageIds.at(-1);
  if (lastMessageId) {
    headers["In-Reply-To"] = lastMessageId;
    headers["References"] = input.threadMessageIds.join(" ");
  }

  return { subject, text: `${body}\n\n${footer}\n`, headers };
}

function composeSubject(input: ComposeInput): string {
  const own = renderTemplate(input.step.subject, input.context).replace(/\s+/g, " ").trim();
  if (own) return own;
  if (input.threadSubject) {
    return /^re:/i.test(input.threadSubject) ? input.threadSubject : `Re: ${input.threadSubject}`;
  }
  throw new DomainError("empty_subject", "The first email of a sequence needs a subject.");
}

function normalizeBody(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
