import { createHash, randomUUID } from "node:crypto";

import nodemailer, { type Transporter } from "nodemailer";

import type { OutgoingEmail, SendResult, ServerCredentials } from "./types";

/**
 * recipient_rejected  the server refused this address permanently → treat as a hard bounce
 * mailbox_problem     auth failure, quota or block on the sending account → pause the mailbox
 * not_sent            couldn't reach the server; nothing was accepted → safe to retry later
 * unknown             failed mid-conversation; the message may have gone out → never retry
 */
export type SmtpFailureKind = "recipient_rejected" | "mailbox_problem" | "not_sent" | "unknown";

export class SmtpSendError extends Error {
  override readonly name = "SmtpSendError";

  constructor(
    readonly kind: SmtpFailureKind,
    message: string,
    readonly responseCode?: number,
  ) {
    super(message);
  }
}

export interface MailSender {
  send(credentials: ServerCredentials, email: OutgoingEmail): Promise<SendResult>;
  verify(credentials: ServerCredentials): Promise<void>;
  close(): void;
}

const CONNECTION_TIMEOUT_MS = 20_000;

export interface MailSenderOptions {
  /** Accept self-signed certificates (some self-hosted mail servers, local testing). Off by default. */
  allowSelfSignedCertificates?: boolean;
}

export function createMailSender(options: MailSenderOptions = {}): MailSender {
  const tls = options.allowSelfSignedCertificates ? { rejectUnauthorized: false } : undefined;

  // One pooled connection per mailbox, re-created if credentials change.
  const transports = new Map<string, Transporter>();

  const transportFor = (credentials: ServerCredentials): Transporter => {
    const key = credentialKey(credentials);
    let transport = transports.get(key);
    if (!transport) {
      transport = nodemailer.createTransport({
        host: credentials.host,
        port: credentials.port,
        secure: credentials.secure,
        requireTLS: !credentials.secure,
        auth: { user: credentials.username, pass: credentials.password },
        tls,
        pool: true,
        maxConnections: 1,
        connectionTimeout: CONNECTION_TIMEOUT_MS,
        greetingTimeout: CONNECTION_TIMEOUT_MS,
        socketTimeout: 60_000,
      });
      transports.set(key, transport);
    }
    return transport;
  };

  return {
    async send(credentials, email) {
      try {
        const info = await transportFor(credentials).sendMail({
          from: { name: email.from.name, address: email.from.address },
          to: email.to,
          subject: email.subject,
          text: email.text,
          messageId: email.messageId,
          headers: email.headers,
        });
        return { messageId: email.messageId, response: String(info.response ?? "") };
      } catch (error) {
        throw classifySmtpError(error);
      }
    },

    async verify(credentials) {
      const transport = nodemailer.createTransport({
        host: credentials.host,
        port: credentials.port,
        secure: credentials.secure,
        requireTLS: !credentials.secure,
        auth: { user: credentials.username, pass: credentials.password },
        tls,
        connectionTimeout: CONNECTION_TIMEOUT_MS,
        greetingTimeout: CONNECTION_TIMEOUT_MS,
      });
      try {
        await transport.verify();
      } catch (error) {
        throw classifySmtpError(error);
      } finally {
        transport.close();
      }
    },

    close() {
      for (const transport of transports.values()) transport.close();
      transports.clear();
    },
  };
}

export function generateMessageId(senderEmail: string): string {
  const domain = senderEmail.slice(senderEmail.lastIndexOf("@") + 1) || "localhost";
  return `<${randomUUID()}@${domain}>`;
}

interface NodemailerError {
  code?: string;
  responseCode?: number;
  response?: string;
  command?: string;
  message?: string;
}

const SENDER_LIMIT_PATTERN =
  /quota|limit exceeded|rate limit|too many|suspended|blocked|not allowed to send|sender.*(denied|rejected)/i;

export function classifySmtpError(error: unknown): SmtpSendError {
  const e = (error ?? {}) as NodemailerError;
  const message = (e.response ?? e.message ?? String(error)).trim();
  const code = e.responseCode;

  if (e.code === "EAUTH") return new SmtpSendError("mailbox_problem", `Login failed: ${message}`, code);

  // Couldn't open the connection at all: nothing was sent.
  if (e.code === "ECONNECTION" || e.code === "EDNS" || (e.code === "ETIMEDOUT" && e.command === "CONN")) {
    return new SmtpSendError("not_sent", `Could not connect: ${message}`, code);
  }

  if (code !== undefined && code >= 500) {
    if (SENDER_LIMIT_PATTERN.test(message)) return new SmtpSendError("mailbox_problem", message, code);
    if (e.command === "RCPT TO" || e.code === "EENVELOPE") return new SmtpSendError("recipient_rejected", message, code);
    return new SmtpSendError("unknown", message, code);
  }

  // 4xx before DATA is a deferral; the server didn't take the message.
  if (code !== undefined && code >= 400 && e.command !== "DATA") {
    return new SmtpSendError(SENDER_LIMIT_PATTERN.test(message) ? "mailbox_problem" : "not_sent", message, code);
  }

  return new SmtpSendError("unknown", message, code);
}

function credentialKey(c: ServerCredentials): string {
  return createHash("sha256")
    .update(JSON.stringify([c.host, c.port, c.secure, c.username, c.password]))
    .digest("hex");
}
