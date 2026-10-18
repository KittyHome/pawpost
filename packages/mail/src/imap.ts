import { ImapFlow } from "imapflow";
import { simpleParser, type AddressObject } from "mailparser";

import type { InboundMessage, ServerCredentials } from "./types";

export interface InboxCursor {
  uidValidity: number;
  lastUid: number;
}

export interface InboxFetchResult {
  cursor: InboxCursor;
  messages: InboundMessage[];
  /**
   * true when there was no usable cursor (first sync, or the server reset UIDs).
   * The cursor is then set to "now" and older mail is skipped on purpose.
   */
  reset: boolean;
}

export interface InboxReader {
  fetchNew(credentials: ServerCredentials, cursor: InboxCursor | null, options?: { limit?: number }): Promise<InboxFetchResult>;
  verify(credentials: ServerCredentials): Promise<void>;
}

/** Enough to include a bounce's quoted headers without downloading large attachments. */
const MAX_SOURCE_BYTES = 256 * 1024;
const KEPT_HEADERS = ["auto-submitted", "x-autoreply", "x-autorespond", "x-auto-response-suppress", "precedence"];

export function createInboxReader(): InboxReader {
  return {
    async fetchNew(credentials, cursor, options = {}) {
      const limit = options.limit ?? 100;
      return withClient(credentials, async (client) => {
        const lock = await client.getMailboxLock("INBOX", { readOnly: true });
        try {
          const mailbox = client.mailbox;
          if (!mailbox) throw new Error("INBOX did not open.");
          const uidValidity = Number(mailbox.uidValidity);
          const latestUid = Math.max(Number(mailbox.uidNext) - 1, 0);

          if (!cursor || cursor.uidValidity !== uidValidity) {
            return { cursor: { uidValidity, lastUid: latestUid }, messages: [], reset: true };
          }
          if (latestUid <= cursor.lastUid) return { cursor, messages: [], reset: false };

          const messages: InboundMessage[] = [];
          let lastUid = cursor.lastUid;
          // "n:*" always matches the newest message, even below n, so filter by UID too.
          for await (const item of client.fetch(
            `${cursor.lastUid + 1}:*`,
            { uid: true, source: { start: 0, maxLength: MAX_SOURCE_BYTES } },
            { uid: true },
          )) {
            if (item.uid <= cursor.lastUid || !item.source) continue;
            messages.push(await toInboundMessage(item.uid, item.source));
            lastUid = Math.max(lastUid, item.uid);
            if (messages.length >= limit) break;
          }
          return { cursor: { uidValidity, lastUid }, messages, reset: false };
        } finally {
          lock.release();
        }
      });
    },

    async verify(credentials) {
      await withClient(credentials, async (client) => {
        await client.status("INBOX", { messages: true });
      });
    },
  };
}

async function withClient<T>(credentials: ServerCredentials, run: (client: ImapFlow) => Promise<T>): Promise<T> {
  const client = new ImapFlow({
    host: credentials.host,
    port: credentials.port,
    secure: credentials.secure,
    auth: { user: credentials.username, pass: credentials.password },
    logger: false,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 60_000,
  });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.logout().catch(() => client.close());
  }
}

async function toInboundMessage(uid: number, source: Buffer): Promise<InboundMessage> {
  const parsed = await simpleParser(source, { skipImageLinks: true, skipTextToHtml: true, skipTextLinks: true });
  const headers: Record<string, string> = {};
  for (const name of KEPT_HEADERS) {
    const value = parsed.headers.get(name);
    if (value !== undefined) headers[name] = typeof value === "string" ? value : JSON.stringify(value);
  }
  const contentType = parsed.headers.get("content-type");

  return {
    uid,
    from: firstAddress(parsed.from),
    subject: parsed.subject ?? "",
    inReplyTo: parsed.inReplyTo ?? null,
    references: typeof parsed.references === "string" ? [parsed.references] : (parsed.references ?? []),
    headers,
    contentType: contentTypeToString(contentType),
    text: (parsed.text ?? "").slice(0, 20_000),
    raw: source.toString("utf8"),
  };
}

function firstAddress(from: AddressObject | AddressObject[] | undefined): string | null {
  const list = Array.isArray(from) ? from : from ? [from] : [];
  const address = list.flatMap((a) => a.value).find((v) => v.address)?.address;
  return address ? address.toLowerCase() : null;
}

function contentTypeToString(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  const v = value as { value?: string; params?: Record<string, string> };
  const params = Object.entries(v.params ?? {})
    .map(([k, p]) => `; ${k}="${p}"`)
    .join("");
  return `${v.value ?? ""}${params}`;
}
