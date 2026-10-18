import "server-only";

import { z } from "zod";

const optional = z
  .string()
  .optional()
  .transform((v) => v?.trim() || undefined);

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_URL: z.url("APP_URL must be the public URL of this app"),
  APP_SECRET: z.string().min(32, "APP_SECRET must be at least 32 characters"),
  /** Optional: creates the owner on first start, for unattended installs. */
  ADMIN_EMAIL: optional,
  ADMIN_PASSWORD: optional,
  /** Optional: when set, the first-run setup page asks for this value. */
  SETUP_TOKEN: optional,
  /** Optional: SMTP connection URL for invitation and password reset emails. */
  SYSTEM_SMTP_URL: optional,
  SYSTEM_EMAIL_FROM: z.string().trim().default("Pawpost <no-reply@localhost>"),
  OPENAI_API_KEY: optional,
  OPENAI_MODEL: optional,
  OPENAI_BASE_URL: optional,
  OPENAI_PROXY_URL: optional,
  HTTPS_PROXY: optional,
});

export type WebEnv = z.infer<typeof schema>;

let cached: WebEnv | undefined;

/** Validated on first use, so `next build` works without production secrets. */
export function env(): WebEnv {
  if (cached) return cached;
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid configuration: ${problems}. See .env.example.`);
  }
  cached = result.data;
  return cached;
}
