import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import type { AiProvider, AiRequest } from "@pawpost/ai";
import { createDatabase, type DatabaseHandle } from "@pawpost/db";
import { runMigrations } from "@pawpost/db/migrate";
import type { InboundMessage, InboxCursor, InboxReader } from "@pawpost/mail";
import EmbeddedPostgres from "embedded-postgres";
import { simpleParser } from "mailparser";
import { SMTPServer } from "smtp-server";

export async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

/** A throwaway Postgres cluster with migrations applied. */
export async function startTestDatabase(): Promise<DatabaseHandle & { url: string; stop(): Promise<void> }> {
  const dir = mkdtempSync(path.join(tmpdir(), "pawpost-pg-"));
  const port = await freePort();
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    port,
    user: "test",
    password: "test",
    persistent: false,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
    onError: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("pawpost_test");
  const url = `postgres://test:test@localhost:${port}/pawpost_test`;
  await runMigrations(url);
  const handle = createDatabase(url, { max: 10 });
  return {
    ...handle,
    url,
    async stop() {
      await handle.close();
      await pg.stop();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export interface CapturedEmail {
  from: string;
  to: string[];
  subject: string;
  text: string;
  messageId: string;
  inReplyTo: string | undefined;
  headers: Map<string, unknown>;
  /** Raw "Name: value" header lines as received, lower-cased name → unfolded value. */
  rawHeaders: Record<string, string>;
}

/** Real SMTP server on localhost (STARTTLS with a self-signed cert, any login accepted). */
export async function startSmtpServer(options: { rejectRecipients?: string[] } = {}) {
  const received: CapturedEmail[] = [];
  const server = new SMTPServer({
    authMethods: ["PLAIN", "LOGIN"],
    onAuth: (_auth, _session, cb) => cb(null, { user: "test" }),
    onRcptTo: (address, _session, cb) => {
      if (options.rejectRecipients?.includes(address.address.toLowerCase())) {
        const error = Object.assign(new Error("5.1.1 The email account that you tried to reach does not exist"), {
          responseCode: 550,
        });
        return cb(error);
      }
      cb();
    },
    onData: (stream, session, cb) => {
      simpleParser(stream)
        .then((mail) => {
          received.push({
            from: session.envelope.mailFrom ? session.envelope.mailFrom.address : "",
            to: session.envelope.rcptTo.map((r) => r.address),
            subject: mail.subject ?? "",
            text: mail.text ?? "",
            messageId: mail.messageId ?? "",
            inReplyTo: mail.inReplyTo,
            headers: mail.headers,
            rawHeaders: Object.fromEntries(
              mail.headerLines.map((h) => [
                h.key,
                h.line
                  .slice(h.line.indexOf(":") + 1)
                  .replace(/\r?\n[ \t]+/g, " ")
                  .trim(),
              ]),
            ),
          });
          cb();
        })
        .catch(cb);
    },
    logger: false,
  });
  const port = await freePort();
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  return {
    port,
    received,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** Inbox whose contents the test controls. Behaves like IMAP: first sync only sets the cursor. */
export function scriptedInbox() {
  const pending: Omit<InboundMessage, "uid">[] = [];
  let uid = 100;
  const reader: InboxReader = {
    async verify() {},
    async fetchNew(_credentials, cursor: InboxCursor | null) {
      if (!cursor) return { cursor: { uidValidity: 1, lastUid: uid }, messages: [], reset: true };
      const messages = pending.splice(0).map((m) => ({ ...m, uid: ++uid }));
      return { cursor: { uidValidity: 1, lastUid: uid }, messages, reset: false };
    },
  };
  return { reader, deliver: (message: Omit<InboundMessage, "uid">) => pending.push(message) };
}

/** AI provider returning canned answers per task. */
export function fakeAi(answers: Record<string, unknown>): AiProvider & { calls: AiRequest<unknown>[] } {
  const calls: AiRequest<unknown>[] = [];
  return {
    id: "fake",
    model: "fake-1",
    calls,
    async generate<T>(request: AiRequest<T>) {
      calls.push(request as AiRequest<unknown>);
      return request.schema.parse(answers[request.task]);
    },
  };
}

export function controllableClock(start: Date) {
  let now = start.getTime();
  return {
    now: () => new Date(now),
    advance(ms: number) {
      now += ms;
    },
  };
}
