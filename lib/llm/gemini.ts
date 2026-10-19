import {
  ApiError,
  GoogleGenAI,
  ThinkingLevel,
  type Content,
  type GenerateContentConfig,
  type GenerateContentResponseUsageMetadata,
} from "@google/genai";
import { LLMError } from "./errors";
import type { GenerateRequest, GenerateResponse, LLMProvider, StreamEvent, TokenUsage } from "./types";

const REQUEST_TIMEOUT_MS = 60_000;

const THINKING_LEVELS = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
} as const;

/** Adapter: translates our generic request into Gemini's API, and its response back. */
export function createGeminiProvider(apiKey: string, model: string): LLMProvider {
  const client = new GoogleGenAI({ apiKey });

  return {
    name: "gemini",

    async generate(request: GenerateRequest): Promise<GenerateResponse> {
      let response;
      try {
        response = await client.models.generateContent({
          model,
          contents: toContents(request),
          config: toConfig(request),
        });
      } catch (err) {
        throw toLLMError(err, request.signal);
      }

      const text = response.text;
      if (!text) {
        // Usually a safety block or the output-token limit. Retrying won't help.
        const reason =
          response.promptFeedback?.blockReason ?? response.candidates?.[0]?.finishReason ?? "unknown";
        throw new LLMError(`Gemini returned no text (reason: ${reason})`, { retryable: false });
      }

      return { text, model: response.modelVersion ?? model, usage: toUsage(response.usageMetadata) };
    },

    async stream(request: GenerateRequest): Promise<AsyncIterable<StreamEvent>> {
      // Awaiting this sends the request: rate limits and bad keys throw here,
      // before any text exists, which is the only point where retrying is safe.
      let chunks;
      try {
        chunks = await client.models.generateContentStream({
          model,
          contents: toContents(request),
          config: toConfig(request),
        });
      } catch (err) {
        throw toLLMError(err, request.signal);
      }

      return (async function* () {
        let usage: GenerateContentResponseUsageMetadata | undefined;
        let modelVersion = model;
        try {
          for await (const chunk of chunks) {
            if (chunk.text) yield { type: "text", text: chunk.text } as const;
            usage = chunk.usageMetadata ?? usage;
            modelVersion = chunk.modelVersion ?? modelVersion;
          }
        } catch (err) {
          throw toLLMError(err, request.signal);
        }
        yield { type: "done", usage: toUsage(usage), model: modelVersion } as const;
      })();
    },
  };
}

// Gemini calls the assistant role "model". Translating vocabulary like this
// is exactly the adapter's job.
function toContents(request: GenerateRequest): Content[] {
  return request.messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
}

function toConfig(request: GenerateRequest): GenerateContentConfig {
  return {
    systemInstruction: request.system,
    temperature: request.temperature,
    maxOutputTokens: request.maxOutputTokens,
    ...(request.reasoningEffort && {
      thinkingConfig: { thinkingLevel: THINKING_LEVELS[request.reasoningEffort] },
    }),
    ...(request.jsonSchema && {
      responseMimeType: "application/json",
      responseJsonSchema: request.jsonSchema,
    }),
    abortSignal: request.signal,
    httpOptions: { timeout: REQUEST_TIMEOUT_MS },
  };
}

function toUsage(usage: GenerateContentResponseUsageMetadata | undefined): TokenUsage {
  return {
    inputTokens: usage?.promptTokenCount ?? 0,
    outputTokens: usage?.candidatesTokenCount ?? 0,
    reasoningTokens: usage?.thoughtsTokenCount ?? 0,
  };
}

function toLLMError(err: unknown, signal?: AbortSignal): LLMError {
  // We cancelled on purpose (the user left). Retrying would waste tokens.
  if (signal?.aborted) return new LLMError("Request aborted", { retryable: false, cause: err });

  if (err instanceof ApiError) {
    // 408 timeout, 429 rate limited, 5xx server trouble: worth another try.
    // 400 bad request, 401/403 bad key, 404 unknown model: will fail again.
    // Exception: a quota that resets in hours (like the free tier's daily
    // limit) won't recover within our few-second retry window.
    const retryAfterSeconds = retryDelaySeconds(err.message);
    const retryable =
      (err.status === 408 || err.status === 429 || err.status >= 500) && (retryAfterSeconds ?? 0) <= 30;
    return new LLMError(`Gemini API error ${err.status}: ${err.message}`, {
      retryable,
      status: err.status,
      retryAfterSeconds,
      cause: err,
    });
  }
  // Network drops and client-side timeouts arrive as plain errors.
  const message = err instanceof Error ? err.message : String(err);
  return new LLMError(`Gemini request failed: ${message}`, { retryable: true, cause: err });
}

// Gemini puts its suggested wait inside the error body, e.g. "retryDelay":"62285s".
function retryDelaySeconds(message: string): number | undefined {
  const match = message.match(/"retryDelay":\s*"(\d+(?:\.\d+)?)s"/);
  return match ? Number(match[1]) : undefined;
}
