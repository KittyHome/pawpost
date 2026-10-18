import nodemailer from "nodemailer";

/**
 * The installation's own outgoing email (invitations, password resets).
 * Configured with one connection URL, e.g. smtps://user:pass@smtp.example.com:465.
 * Optional: without it, the UI shows links to copy and share instead.
 */
export interface SystemMailer {
  send(message: { to: string; subject: string; text: string }): Promise<void>;
}

export function createSystemMailer(config: { url: string; from: string }): SystemMailer {
  const transport = nodemailer.createTransport(config.url);
  return {
    async send(message) {
      await transport.sendMail({ from: config.from, to: message.to, subject: message.subject, text: message.text });
    },
  };
}
