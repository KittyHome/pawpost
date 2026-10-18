import "server-only";

import { createLogger } from "@pawpost/core";
import { createDatabase } from "@pawpost/db";
import { createEngine, type Engine } from "@pawpost/engine";

import { env } from "./env";

// Reuse one engine (and connection pool) across hot reloads in development.
const globalForEngine = globalThis as unknown as { __pawpostEngine?: Engine };

/** The web app's only door to data and business rules. Sending happens in the worker. */
export function engine(): Engine {
  if (globalForEngine.__pawpostEngine) return globalForEngine.__pawpostEngine;
  const config = env();
  const { db } = createDatabase(config.DATABASE_URL, { max: 5 });
  const instance = createEngine({
    db,
    appSecret: config.APP_SECRET,
    appUrl: config.APP_URL,
    logger: createLogger({ service: "web" }),
    ai: {
      openaiApiKey: config.OPENAI_API_KEY,
      openaiModel: config.OPENAI_MODEL,
      openaiBaseUrl: config.OPENAI_BASE_URL,
      proxyUrl: config.OPENAI_PROXY_URL ?? config.HTTPS_PROXY,
    },
  });
  globalForEngine.__pawpostEngine = instance;
  return instance;
}
