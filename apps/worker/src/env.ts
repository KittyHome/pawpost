import { existsSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

/** Loads the repo-root .env in development. In production, real environment variables are used. */
function loadDotEnv(): void {
  for (const candidate of [path.resolve(process.cwd(), ".env"), path.resolve(process.cwd(), "../../.env")]) {
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
      return;
    }
  }
}

const optional = z
  .string()
  .optional()
  .transform((v) => v?.trim() || undefined);

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_URL: z.url("APP_URL must be the public URL of the web app, e.g. https://outreach.example.com"),
  APP_SECRET: z.string().min(32, "APP_SECRET must be at least 32 characters"),

  OPENAI_API_KEY: optional,
  OPENAI_MODEL: optional,
  OPENAI_BASE_URL: optional,
  /** Proxy for OpenAI API calls only. Falls back to HTTPS_PROXY. */
  OPENAI_PROXY_URL: optional,
  HTTPS_PROXY: optional,

  DISPATCH_INTERVAL_SECONDS: z.coerce.number().int().min(5).max(600).default(20),
  INBOX_SYNC_INTERVAL_SECONDS: z.coerce.number().int().min(30).max(3600).default(120),
  RUN_MIGRATIONS: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  MIGRATIONS_DIR: optional,
  SMTP_ALLOW_SELF_SIGNED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type WorkerEnv = z.infer<typeof schema>;

export function readEnv(): WorkerEnv {
  loadDotEnv();
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    console.error(`Invalid worker configuration:\n${problems}`);
    process.exit(1);
  }
  return result.data;
}
