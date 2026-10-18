/**
 * Local SMTP sink for development: accepts any login and stores every email
 * in ./.data/outbox as .eml files instead of delivering it.
 *
 *   pnpm smtp:dev
 *
 * Connect a mailbox with host 127.0.0.1, port 2525, SSL/TLS off and any
 * username/password. Run the worker with SMTP_ALLOW_SELF_SIGNED=true, because
 * the sink offers STARTTLS with a self-signed certificate.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { SMTPServer } from "smtp-server";

const PORT = Number(process.env.DEV_SMTP_PORT ?? 2525);
const OUTBOX = path.resolve(import.meta.dirname, "../.data/outbox");
mkdirSync(OUTBOX, { recursive: true });

const server = new SMTPServer({
  authMethods: ["PLAIN", "LOGIN"],
  onAuth: (auth, _session, callback) => callback(null, { user: auth.username }),
  onData(stream, session, callback) {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => {
      const to = session.envelope.rcptTo.map((r) => r.address).join(",");
      const file = path.join(OUTBOX, `${Date.now()}-${to.replace(/[^\w@.-]/g, "_")}.eml`);
      writeFileSync(file, Buffer.concat(chunks));
      console.log(`stored ${path.basename(file)}`);
      callback();
    });
  },
  logger: false,
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`SMTP sink listening on 127.0.0.1:${PORT}, writing to ${OUTBOX}`);
});
