/**
 * Pawpost worker: the only process that sends email or reads inboxes.
 * Safe to run more than one instance; the engine's claims prevent double sends.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createLogger } from "@pawpost/core";
import { createDatabase } from "@pawpost/db";
import { runMigrations } from "@pawpost/db/migrate";
import { createEngine } from "@pawpost/engine";
import { createMailSender, createSystemMailer } from "@pawpost/mail";

import { readEnv } from "./env";
import { runLoop } from "./loop";

const VERSION = "0.2.0";
const TRASH_PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000;

const env = readEnv();
const logger = createLogger({ service: "worker" });
const startedAt = new Date();

if (env.RUN_MIGRATIONS) {
  // Bundled builds carry migrations in dist/migrations; in development the db package's own folder is used.
  const bundled = fileURLToPath(new URL("./migrations", import.meta.url));
  await runMigrations(env.DATABASE_URL, env.MIGRATIONS_DIR ?? (existsSync(bundled) ? bundled : undefined));
  logger.info("migrations applied");
}

const database = createDatabase(env.DATABASE_URL, { max: 10 });
const engine = createEngine({
  db: database.db,
  appSecret: env.APP_SECRET,
  appUrl: env.APP_URL,
  logger,
  sender: createMailSender({ allowSelfSignedCertificates: env.SMTP_ALLOW_SELF_SIGNED }),
  systemMailer: env.SYSTEM_SMTP_URL ? createSystemMailer({ url: env.SYSTEM_SMTP_URL, from: env.SYSTEM_EMAIL_FROM }) : null,
  ai: {
    openaiApiKey: env.OPENAI_API_KEY,
    openaiModel: env.OPENAI_MODEL,
    openaiBaseUrl: env.OPENAI_BASE_URL,
    proxyUrl: env.OPENAI_PROXY_URL ?? env.HTTPS_PROXY,
  },
});

// Unattended installs: create the owner from ADMIN_EMAIL / ADMIN_PASSWORD if nobody exists yet.
if (await engine.accounts.bootstrapOwner({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD })) {
  logger.info("owner account created from ADMIN_EMAIL; change its password after signing in");
}

const controller = new AbortController();
const { signal } = controller;

const loops = Promise.all([
  runLoop(
    "dispatch",
    env.DISPATCH_INTERVAL_SECONDS * 1000,
    async () => {
      await engine.system.heartbeat({ version: VERSION, startedAt });
      const summary = await engine.dispatch();
      const activity = summary.sent + summary.failed + summary.bounced + summary.deferred + summary.recoveredStale;
      if (activity || summary.pausedCampaigns.length || summary.completedCampaigns.length) {
        logger.info("dispatch", { ...summary });
      }
    },
    logger,
    signal,
  ),
  runLoop(
    "inbox",
    // Check often; each mailbox is only synced once its own interval has passed.
    Math.min(env.INBOX_SYNC_INTERVAL_SECONDS * 1000, 30_000),
    async () => {
      const summary = await engine.syncInboxes({ intervalMs: env.INBOX_SYNC_INTERVAL_SECONDS * 1000 });
      if (summary.processed || summary.errors) logger.info("inbox sync", { ...summary });
    },
    logger,
    signal,
  ),
  runLoop(
    "trash",
    TRASH_PURGE_INTERVAL_MS,
    async () => {
      const purged = await engine.trash.purgeExpired();
      if (purged.campaigns + purged.lists + purged.contacts) logger.info("trash purged", { ...purged });
    },
    logger,
    signal,
  ),
]);

logger.info("worker started", {
  version: VERSION,
  appUrl: env.APP_URL,
  aiProxy: Boolean(env.OPENAI_PROXY_URL ?? env.HTTPS_PROXY),
});

let stopping = false;
async function shutdown(reason: string) {
  if (stopping) return;
  stopping = true;
  logger.info("shutting down", { reason });
  controller.abort();
  // Give an in-flight SMTP send time to finish so it gets recorded.
  const timeout = setTimeout(() => {
    logger.warn("forced exit after timeout");
    process.exit(1);
  }, 30_000);
  await loops;
  engine.close();
  await database.close();
  clearTimeout(timeout);
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
