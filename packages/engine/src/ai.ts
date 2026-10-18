import {
  AiError,
  classifyReply,
  createOpenAiProvider,
  DEFAULT_OPENAI_MODEL,
  pingProvider,
  reviewCopy,
  writeSequence,
  type AiProvider,
  type CopyReview,
  type GeneratedStep,
  type ReplyClassification,
} from "@pawpost/ai";
import { decryptSecret, DomainError, encryptSecret } from "@pawpost/core";
import { appSettings } from "@pawpost/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { writeAudit } from "./audit";
import type { Actor, EngineContext } from "./context";
import { requirePermission } from "./guard";
import { aiSettingsInput } from "./validation";

/** Deployment-level AI defaults, from environment variables. */
export interface AiEnvironment {
  openaiApiKey?: string | null;
  openaiModel?: string | null;
  openaiBaseUrl?: string | null;
  /** Outbound HTTP(S) proxy for AI API calls. Deployment config only, never stored in the database. */
  proxyUrl?: string | null;
  /** Use this provider instead of building one from settings (tests, custom providers). */
  provider?: AiProvider;
}

const storedSettings = z.object({
  provider: z.literal("openai").default("openai"),
  model: z.string().default(DEFAULT_OPENAI_MODEL),
  apiKeyEnc: z.string().nullable().default(null),
  classifyReplies: z.boolean().default(true),
});
type StoredSettings = z.infer<typeof storedSettings>;

export interface AiStatus {
  provider: "openai";
  model: string;
  configured: boolean;
  /** Where the API key comes from. The UI-saved key wins over the environment. */
  keySource: "settings" | "environment" | null;
  /** Last 4 characters, for recognition. */
  keyHint: string | null;
  classifyReplies: boolean;
  proxyEnabled: boolean;
}

const SETTINGS_KEY = "ai";
const CACHE_MS = 30_000;

export function createAiService(ctx: EngineContext, env: AiEnvironment = {}) {
  const { db } = ctx;
  let cache: { at: number; settings: StoredSettings; provider: AiProvider | null } | null = null;

  async function load(): Promise<StoredSettings> {
    const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, SETTINGS_KEY) });
    return storedSettings.parse(row?.value ?? {});
  }

  function resolveKey(settings: StoredSettings): { key: string | null; source: AiStatus["keySource"] } {
    if (settings.apiKeyEnc) {
      try {
        return { key: decryptSecret(settings.apiKeyEnc, ctx.secretKey), source: "settings" };
      } catch {
        ctx.logger.warn("stored AI key can't be decrypted; was APP_SECRET changed?");
      }
    }
    return env.openaiApiKey ? { key: env.openaiApiKey, source: "environment" } : { key: null, source: null };
  }

  async function current() {
    if (cache && Date.now() - cache.at < CACHE_MS) return cache;
    const settings = await load();
    const { key } = resolveKey(settings);
    const provider = env.provider
      ? env.provider
      : key
        ? createOpenAiProvider({
            apiKey: key,
            model: settings.model || env.openaiModel || DEFAULT_OPENAI_MODEL,
            baseUrl: env.openaiBaseUrl,
            proxyUrl: env.proxyUrl,
          })
        : null;
    cache = { at: Date.now(), settings, provider };
    return cache;
  }

  async function requireProvider(): Promise<AiProvider> {
    const { provider } = await current();
    if (!provider) throw new DomainError("ai_not_configured", "Add an OpenAI API key in Settings → AI to use this feature.");
    return provider;
  }

  /** AI failures in interactive features become readable messages. */
  async function interactive<T>(run: (provider: AiProvider) => Promise<T>): Promise<T> {
    const provider = await requireProvider();
    try {
      return await run(provider);
    } catch (error) {
      if (error instanceof AiError) throw new DomainError(`ai_${error.kind}`, error.message);
      throw error;
    }
  }

  return {
    async status(): Promise<AiStatus> {
      const settings = await load();
      const { key, source } = resolveKey(settings);
      return {
        provider: "openai",
        model: settings.model,
        configured: Boolean(key || env.provider),
        keySource: source,
        keyHint: key ? key.slice(-4) : null,
        classifyReplies: settings.classifyReplies,
        proxyEnabled: Boolean(env.proxyUrl),
      };
    },

    async saveSettings(actor: Actor, raw: unknown): Promise<void> {
      requirePermission(actor, "settings.manage");
      const input = aiSettingsInput.parse(raw);
      const existing = await load();
      const next: StoredSettings = {
        provider: "openai",
        model: input.model,
        classifyReplies: input.classifyReplies,
        apiKeyEnc: input.removeKey ? null : input.apiKey ? encryptSecret(input.apiKey, ctx.secretKey) : existing.apiKeyEnc,
      };
      await db
        .insert(appSettings)
        .values({ key: SETTINGS_KEY, value: next })
        .onConflictDoUpdate({ target: appSettings.key, set: { value: next } });
      cache = null;
      await writeAudit(db, actor, {
        action: "settings.ai_updated",
        summary: `${actor.email} updated AI settings${input.apiKey ? " (new API key)" : input.removeKey ? " (removed API key)" : ""}`,
        metadata: { model: input.model, classifyReplies: input.classifyReplies },
      });
    },

    /** Makes one tiny request, so a bad key or blocked network shows up in Settings, not mid-campaign. */
    async test(actor: Actor): Promise<void> {
      requirePermission(actor, "settings.manage");
      cache = null;
      await interactive((provider) => pingProvider(provider));
    },

    writeSequence(brief: unknown): Promise<GeneratedStep[]> {
      return interactive((provider) => writeSequence(provider, brief));
    },

    reviewCopy(email: { subject: string; body: string }): Promise<CopyReview> {
      if (!email.body.trim()) throw new DomainError("validation", "Write the email body first.");
      return interactive((provider) => reviewCopy(provider, email));
    },

    /**
     * Background use from inbox sync. Never throws: returns null when AI is off,
     * unconfigured or failing, so mail processing falls back to rule-based detection.
     */
    async classifyReply(reply: { originalSubject: string; text: string }): Promise<ReplyClassification | null> {
      const { settings, provider } = await current();
      if (!provider || !settings.classifyReplies) return null;
      try {
        return await classifyReply(provider, reply, AbortSignal.timeout(30_000));
      } catch (error) {
        ctx.logger.warn("reply classification failed", { error });
        return null;
      }
    },
  };
}

export type AiService = ReturnType<typeof createAiService>;
