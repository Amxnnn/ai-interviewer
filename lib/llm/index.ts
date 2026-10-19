// `server-only` makes the build fail if a client component ever imports this
// file. That guarantees the API key and prompts can never ship to the browser.
import "server-only";
import { z } from "zod";
import { LLMOutputError } from "./errors";
import { createGeminiProvider } from "./gemini";
import { withRetry } from "./retry";
import type { GenerateRequest, GenerateResponse, LLMProvider } from "./types";

export { LLMError, LLMOutputError } from "./errors";
export type { ChatMessage, TokenUsage } from "./types";

let provider: LLMProvider | undefined;

// Created on first use rather than at import time, so `next build` works
// without secrets and a missing key fails with a clear message.
function getProvider(): LLMProvider {
  if (provider) return provider;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set. Copy .env.example to .env.local and add your key.");
  }
  provider = createGeminiProvider(apiKey, process.env.GEMINI_MODEL || "gemini-3.5-flash");
  return provider;
}

interface CallOptions extends Omit<GenerateRequest, "jsonSchema"> {
  /** Prompt name + version, e.g. "resume-parser@v1". Shows up in every log line. */
  tag: string;
}

/** Free-form text reply. */
export async function generateText({ tag, ...request }: CallOptions) {
  return withRetry(async () => {
    const response = await timed(tag, () => getProvider().generate(request));
    return { text: response.text, usage: response.usage, model: response.model };
  });
}

/**
 * Structured reply. The Zod schema is the single source of truth: it becomes
 * the JSON Schema the model must follow, then validates what comes back.
 * Never trust model output just because you asked nicely. Always validate.
 */
export async function generateObject<T>({ tag, schema, ...request }: CallOptions & { schema: z.ZodType<T> }) {
  const jsonSchema = z.toJSONSchema(schema);

  return withRetry(async () => {
    const response = await timed(tag, () => getProvider().generate({ ...request, jsonSchema }));

    let raw: unknown;
    try {
      raw = JSON.parse(response.text);
    } catch (err) {
      throw new LLMOutputError(`${tag}: model returned invalid JSON`, err);
    }

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new LLMOutputError(`${tag}: output failed validation\n${z.prettifyError(parsed.error)}`, parsed.error);
    }
    return { data: parsed.data, usage: response.usage, model: response.model };
  });
}

/**
 * Streamed text reply, yielded piece by piece as the model writes it.
 * Retries are only possible before the first piece arrives: once text has
 * reached the user, a failure can't be hidden, so it surfaces as an error.
 */
export async function streamText({ tag, ...request }: CallOptions): Promise<AsyncIterable<string>> {
  const startedAt = Date.now();
  const events = await withRetry(() => getProvider().stream(request));

  return (async function* () {
    let timeToFirstTokenMs: number | undefined;
    for await (const event of events) {
      if (event.type === "text") {
        timeToFirstTokenMs ??= Date.now() - startedAt;
        yield event.text;
      } else {
        logCall({ tag, model: event.model, latencyMs: Date.now() - startedAt, timeToFirstTokenMs, ...event.usage });
      }
    }
  })();
}

async function timed(tag: string, call: () => Promise<GenerateResponse>) {
  const startedAt = Date.now();
  const response = await call();
  logCall({ tag, model: response.model, latencyMs: Date.now() - startedAt, ...response.usage });
  return response;
}

// One structured log line per LLM call. In production these feed dashboards
// for cost, latency and error rate. This is the start of "observability".
function logCall(entry: Record<string, unknown>) {
  console.info(JSON.stringify({ event: "llm_call", ...entry }));
}
