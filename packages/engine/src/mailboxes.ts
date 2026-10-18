import { decryptSecret, DomainError, encryptSecret } from "@pawpost/core";
import { mailboxes, messages, type Mailbox } from "@pawpost/db";
import { SmtpSendError, type ServerCredentials } from "@pawpost/mail";
import { and, asc, count, eq, gt } from "drizzle-orm";

import type { EngineContext } from "./context";
import { recordEvent } from "./events";
import { mailboxInput, type MailboxInput } from "./validation";

export type MailboxSummary = Omit<Mailbox, "smtpPasswordEnc" | "imapPasswordEnc"> & { sentLast24h: number };

export interface ConnectionTestResult {
  smtp: { ok: true } | { ok: false; error: string };
  imap: { ok: true } | { ok: false; error: string };
}

export function createMailboxService(ctx: EngineContext) {
  const { db } = ctx;

  async function find(id: string): Promise<Mailbox> {
    const mailbox = await db.query.mailboxes.findFirst({ where: eq(mailboxes.id, id) });
    if (!mailbox) throw new DomainError("not_found", "Mailbox not found.");
    return mailbox;
  }

  function credentials(mailbox: Mailbox): { smtp: ServerCredentials; imap: ServerCredentials } {
    return {
      smtp: {
        host: mailbox.smtpHost,
        port: mailbox.smtpPort,
        secure: mailbox.smtpSecure,
        username: mailbox.smtpUsername,
        password: decryptSecret(mailbox.smtpPasswordEnc, ctx.secretKey),
      },
      imap: {
        host: mailbox.imapHost,
        port: mailbox.imapPort,
        secure: mailbox.imapSecure,
        username: mailbox.imapUsername,
        password: decryptSecret(mailbox.imapPasswordEnc, ctx.secretKey),
      },
    };
  }

  async function testCredentials(smtp: ServerCredentials, imap: ServerCredentials): Promise<ConnectionTestResult> {
    const [smtpResult, imapResult] = await Promise.allSettled([ctx.sender.verify(smtp), ctx.inbox.verify(imap)]);
    return {
      smtp: smtpResult.status === "fulfilled" ? { ok: true } : { ok: false, error: describe(smtpResult.reason) },
      imap: imapResult.status === "fulfilled" ? { ok: true } : { ok: false, error: describe(imapResult.reason) },
    };
  }

  function assertConnected(result: ConnectionTestResult): void {
    const problems = [!result.smtp.ok && `SMTP: ${result.smtp.error}`, !result.imap.ok && `IMAP: ${result.imap.error}`].filter(
      Boolean,
    );
    if (problems.length) throw new DomainError("connection_failed", problems.join(" · "));
  }

  return {
    credentials,

    async list(): Promise<MailboxSummary[]> {
      const since = new Date(ctx.now().getTime() - 24 * 60 * 60 * 1000);
      const rows = await db.select().from(mailboxes).orderBy(asc(mailboxes.email));
      const sent = await db
        .select({ mailboxId: messages.mailboxId, sent: count() })
        .from(messages)
        .where(gt(messages.sentAt, since))
        .groupBy(messages.mailboxId);
      const sentById = new Map(sent.map((s) => [s.mailboxId, s.sent]));
      return rows.map(({ smtpPasswordEnc: _s, imapPasswordEnc: _i, ...rest }) => ({
        ...rest,
        sentLast24h: sentById.get(rest.id) ?? 0,
      }));
    },

    async get(id: string): Promise<MailboxSummary> {
      const { smtpPasswordEnc: _s, imapPasswordEnc: _i, ...rest } = await find(id);
      const since = new Date(ctx.now().getTime() - 24 * 60 * 60 * 1000);
      const [row] = await db
        .select({ sent: count() })
        .from(messages)
        .where(and(eq(messages.mailboxId, id), gt(messages.sentAt, since)));
      return { ...rest, sentLast24h: row?.sent ?? 0 };
    },

    /** Verifies SMTP and IMAP login before saving, so a broken mailbox never enters rotation. */
    async create(raw: unknown): Promise<Mailbox> {
      const input = mailboxInput.parse(raw);
      if (!input.smtpPassword) throw new DomainError("validation", "SMTP password is required.");
      const smtpPassword = input.smtpPassword;
      const imapPassword = input.imapPassword ?? smtpPassword;
      const imapUsername = input.imapUsername || input.smtpUsername;

      const existing = await db.query.mailboxes.findFirst({ where: eq(mailboxes.email, input.email) });
      if (existing) throw new DomainError("duplicate", `${input.email} is already connected.`);

      assertConnected(
        await testCredentials(
          {
            host: input.smtpHost,
            port: input.smtpPort,
            secure: input.smtpSecure,
            username: input.smtpUsername,
            password: smtpPassword,
          },
          {
            host: input.imapHost,
            port: input.imapPort,
            secure: input.imapSecure,
            username: imapUsername,
            password: imapPassword,
          },
        ),
      );

      const [created] = await db
        .insert(mailboxes)
        .values({
          ...baseValues(input),
          imapUsername,
          smtpPasswordEnc: encryptSecret(smtpPassword, ctx.secretKey),
          imapPasswordEnc: encryptSecret(imapPassword, ctx.secretKey),
        })
        .returning();
      ctx.logger.info("mailbox connected", { mailboxId: created!.id, email: created!.email });
      return created!;
    },

    async update(id: string, raw: unknown): Promise<Mailbox> {
      const input = mailboxInput.parse(raw);
      const current = await find(id);
      const stored = credentials(current);
      const smtpPassword = input.smtpPassword ?? stored.smtp.password;
      const imapPassword = input.imapPassword ?? (input.smtpPassword ? smtpPassword : stored.imap.password);
      const imapUsername = input.imapUsername || input.smtpUsername;

      if (input.email !== current.email) {
        const clash = await db.query.mailboxes.findFirst({ where: eq(mailboxes.email, input.email) });
        if (clash) throw new DomainError("duplicate", `${input.email} is already connected.`);
      }

      assertConnected(
        await testCredentials(
          {
            host: input.smtpHost,
            port: input.smtpPort,
            secure: input.smtpSecure,
            username: input.smtpUsername,
            password: smtpPassword,
          },
          {
            host: input.imapHost,
            port: input.imapPort,
            secure: input.imapSecure,
            username: imapUsername,
            password: imapPassword,
          },
        ),
      );

      const imapChanged = input.imapHost !== current.imapHost || imapUsername !== current.imapUsername;
      const [updated] = await db
        .update(mailboxes)
        .set({
          ...baseValues(input),
          imapUsername,
          smtpPasswordEnc: encryptSecret(smtpPassword, ctx.secretKey),
          imapPasswordEnc: encryptSecret(imapPassword, ctx.secretKey),
          // A working connection clears a previous error state.
          status: current.status === "error" ? "active" : current.status,
          lastError: null,
          // Different inbox → start reading from "now" again.
          ...(imapChanged ? { imapUidValidity: null, imapLastUid: null } : {}),
        })
        .where(eq(mailboxes.id, id))
        .returning();
      return updated!;
    },

    /** Re-checks a saved mailbox. A passing test takes it out of the error state. */
    async test(id: string): Promise<ConnectionTestResult> {
      const mailbox = await find(id);
      const creds = credentials(mailbox);
      const result = await testCredentials(creds.smtp, creds.imap);
      if (result.smtp.ok && result.imap.ok) {
        if (mailbox.status === "error" || mailbox.lastError) {
          await db
            .update(mailboxes)
            .set({ status: mailbox.status === "error" ? "active" : mailbox.status, lastError: null })
            .where(eq(mailboxes.id, id));
        }
      } else {
        const error = [!result.smtp.ok && `SMTP: ${result.smtp.error}`, !result.imap.ok && `IMAP: ${result.imap.error}`]
          .filter(Boolean)
          .join(" · ");
        await db.update(mailboxes).set({ lastError: error }).where(eq(mailboxes.id, id));
      }
      return result;
    },

    async setPaused(id: string, paused: boolean): Promise<void> {
      const mailbox = await find(id);
      if (!paused && mailbox.status === "error") {
        throw new DomainError("invalid_state", "Fix the connection problem and run a test before resuming this mailbox.");
      }
      await db
        .update(mailboxes)
        .set({ status: paused ? "paused" : "active" })
        .where(eq(mailboxes.id, id));
    },

    /** Called by the dispatcher when the provider rejects the account itself. */
    async markError(id: string, error: string): Promise<void> {
      await db.update(mailboxes).set({ status: "error", lastError: error }).where(eq(mailboxes.id, id));
      await recordEvent(db, { type: "mailbox_error", mailboxId: id, detail: { error } });
      ctx.logger.warn("mailbox disabled", { mailboxId: id, error });
    },

    async remove(id: string): Promise<void> {
      await find(id);
      await db.delete(mailboxes).where(eq(mailboxes.id, id));
    },
  };
}

export type MailboxService = ReturnType<typeof createMailboxService>;

function baseValues(input: MailboxInput) {
  return {
    email: input.email,
    fromName: input.fromName,
    smtpHost: input.smtpHost,
    smtpPort: input.smtpPort,
    smtpSecure: input.smtpSecure,
    smtpUsername: input.smtpUsername,
    imapHost: input.imapHost,
    imapPort: input.imapPort,
    imapSecure: input.imapSecure,
    dailyLimit: input.dailyLimit,
    minIntervalSeconds: input.minIntervalSeconds,
  };
}

function describe(error: unknown): string {
  if (error instanceof SmtpSendError) return error.message;
  if (error instanceof Error) {
    const detail = (error as { responseText?: string }).responseText;
    return detail ? `${error.message}: ${detail}` : error.message;
  }
  return String(error);
}
