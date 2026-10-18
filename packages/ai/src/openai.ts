import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { fetch as undiciFetch, ProxyAgent } from "undici";

import { AiError, type AiProvider, type AiRequest } from "./provider";

export interface OpenAiConfig {
  apiKey: string;
  model: string;
  /** For OpenAI-compatible gateways. Defaults to api.openai.com. */
  baseUrl?: string | null;
  /** HTTP(S) proxy for outbound API calls, e.g. http://127.0.0.1:7890 for local testing. */
  proxyUrl?: string | null;
  timeoutMs?: number;
}

export const DEFAULT_OPENAI_MODEL = "gpt-5.5";

type ClientOptions = NonNullable<ConstructorParameters<typeof OpenAI>[0]>;

export function createOpenAiProvider(config: OpenAiConfig): AiProvider {
  if (!config.apiKey) throw new AiError("not_configured", "OpenAI API key is missing.");

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl || undefined,
    timeout: config.timeoutMs ?? 60_000,
    maxRetries: 2,
    ...(config.proxyUrl ? proxiedFetch(config.proxyUrl) : {}),
  });

  return {
    id: "openai",
    model: config.model,

    async generate<T>(request: AiRequest<T>): Promise<T> {
      try {
        const response = await client.responses.parse(
          {
            model: config.model,
            instructions: request.instructions,
            input: request.input,
            max_output_tokens: request.maxOutputTokens ?? 4000,
            text: { format: zodTextFormat(request.schema, request.task) },
          },
          { signal: request.signal },
        );
        const refusal = response.output
          .flatMap((item) => (item.type === "message" ? item.content : []))
          .find((part) => part.type === "refusal");
        if (refusal && refusal.type === "refusal") throw new AiError("refused", refusal.refusal);
        if (response.output_parsed == null) {
          throw new AiError(
            "invalid_output",
            `The model returned no usable ${request.task} result (status: ${response.status}).`,
          );
        }
        return response.output_parsed as T;
      } catch (error) {
        throw toAiError(error);
      }
    },
  };
}

/**
 * undici's `dispatcher` only works with undici's own fetch, so both are swapped in
 * together. The casts bridge undici's bundled types and Node's `undici-types`,
 * which describe the same runtime objects.
 */
function proxiedFetch(proxyUrl: string): Pick<ClientOptions, "fetch" | "fetchOptions"> {
  return {
    fetch: undiciFetch as unknown as ClientOptions["fetch"],
    fetchOptions: { dispatcher: new ProxyAgent(proxyUrl) } as unknown as ClientOptions["fetchOptions"],
  };
}

function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  if (error instanceof OpenAI.APIConnectionError) {
    return new AiError(
      "network",
      `Could not reach the OpenAI API: ${error.message}. If you need a proxy, set OPENAI_PROXY_URL.`,
      { cause: error },
    );
  }
  if (error instanceof OpenAI.AuthenticationError || error instanceof OpenAI.PermissionDeniedError) {
    return new AiError("auth", "OpenAI rejected the API key.", { cause: error });
  }
  if (error instanceof OpenAI.RateLimitError) {
    return new AiError("rate_limit", "OpenAI rate limit or quota reached. Try again later or check billing.", { cause: error });
  }
  if (error instanceof OpenAI.APIError) {
    return new AiError("unknown", `OpenAI error ${error.status ?? ""}: ${error.message}`.trim(), { cause: error });
  }
  return new AiError("unknown", error instanceof Error ? error.message : String(error), { cause: error });
}
