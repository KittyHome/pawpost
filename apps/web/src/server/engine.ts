import "server-only";

import { createLogger } from "@pawpost/core";
import { createDatabase } from "@pawpost/db";
import { createEngine, type Engine } from "@pawpost/engine";
import { createSystemMailer } from "@pawpost/mail";

import { env } from "./env";

// Reuse one engine (and connection pool) across hot reloads in development, but
// rebuild it when the engine code itself changed, so new services show up.
const globalForEngine = globalThis as unknown as {
  __pawpostEngine?: Engine;
  __pawpostEngineFactory?: typeof createEngine;
  __pawpostBootstrap?: Promise<unknown>;
};

/** The web app's only door to data and business rules. Sending happens in the worker. */
export function engine(): Engine {
  if (globalForEngine.__pawpostEngine && globalForEngine.__pawpostEngineFactory === createEngine) {
    return globalForEngine.__pawpostEngine;
  }
  globalForEngine.__pawpostEngine?.close();
  const config = env();
  const { db } = createDatabase(config.DATABASE_URL, { max: 5 });
  const instance = createEngine({
    db,
    appSecret: config.APP_SECRET,
    appUrl: config.APP_URL,
    logger: createLogger({ service: "web" }),
    systemMailer: config.SYSTEM_SMTP_URL
      ? createSystemMailer({ url: config.SYSTEM_SMTP_URL, from: config.SYSTEM_EMAIL_FROM })
      : null,
    ai: {
      openaiApiKey: config.OPENAI_API_KEY,
      openaiModel: config.OPENAI_MODEL,
      openaiBaseUrl: config.OPENAI_BASE_URL,
      proxyUrl: config.OPENAI_PROXY_URL ?? config.HTTPS_PROXY,
    },
  });
  globalForEngine.__pawpostEngine = instance;
  globalForEngine.__pawpostEngineFactory = createEngine;
  return instance;
}

/**
 * Creates the owner from ADMIN_EMAIL / ADMIN_PASSWORD once, if nobody exists yet.
 * The worker does the same on start; whichever runs first wins.
 */
export function ensureBootstrap(): Promise<unknown> {
  globalForEngine.__pawpostBootstrap ??= engine()
    .accounts.bootstrapOwner({ email: env().ADMIN_EMAIL, password: env().ADMIN_PASSWORD })
    .catch((error: unknown) => {
      globalForEngine.__pawpostBootstrap = undefined;
      throw error;
    });
  return globalForEngine.__pawpostBootstrap;
}
