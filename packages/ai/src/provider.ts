import type { z } from "zod";

/**
 * Provider-agnostic contract. Every AI feature is a structured-output call:
 * instructions + input in, a value matching a Zod schema out. Adding another
 * provider (Anthropic, Gemini, a local model) means implementing this interface.
 */
export interface AiProvider {
  readonly id: string;
  readonly model: string;
  generate<T>(request: AiRequest<T>): Promise<T>;
}

export interface AiRequest<T> {
  /** Short snake_case name; used as the schema name and in logs. */
  task: string;
  instructions: string;
  input: string;
  schema: z.ZodType<T>;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

export type AiErrorKind = "not_configured" | "auth" | "rate_limit" | "network" | "invalid_output" | "refused" | "unknown";

export class AiError extends Error {
  override readonly name = "AiError";

  constructor(
    readonly kind: AiErrorKind,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

export function isAiError(error: unknown): error is AiError {
  return error instanceof AiError;
}
