import { LLMError } from "./errors";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retries transient failures with exponential backoff plus jitter.
 *
 * Delays grow ~0.5s, ~1s, ~2s so an overloaded API gets room to recover.
 * The random jitter stops many clients that failed at the same moment from
 * all retrying at the same moment too (the "thundering herd" problem).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { maxAttempts = 3, baseDelayMs = 500 } = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!(err instanceof LLMError) || !err.retryable || attempt >= maxAttempts) throw err;

      // Back off exponentially, but never retry sooner than the provider asked.
      const backoffMs = baseDelayMs * 2 ** (attempt - 1) + Math.random() * baseDelayMs;
      const delayMs = Math.max(backoffMs, (err.retryAfterSeconds ?? 0) * 1000);
      console.warn(`[llm] attempt ${attempt} failed: ${err.message}. Retrying in ${Math.round(delayMs)}ms`);
      await sleep(delayMs);
    }
  }
}
