/**
 * The one error type every provider adapter throws. Callers check `retryable`
 * instead of knowing what a Gemini (or OpenAI, or Claude) error looks like.
 */
export class LLMError extends Error {
  readonly retryable: boolean;
  readonly status?: number;
  /** How long the provider asked us to wait before trying again, if it said. */
  readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    options: { retryable: boolean; status?: number; retryAfterSeconds?: number; cause?: unknown },
  ) {
    super(message, { cause: options.cause });
    this.name = "LLMError";
    this.retryable = options.retryable;
    this.status = options.status;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

/**
 * The model answered, but not in the shape we asked for. Retryable because
 * sampling is random: the same request often succeeds on the next attempt.
 */
export class LLMOutputError extends LLMError {
  constructor(message: string, cause?: unknown) {
    super(message, { retryable: true, cause });
    this.name = "LLMOutputError";
  }
}
