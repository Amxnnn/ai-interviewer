import "server-only";
import { LLMError } from "@/lib/llm";

export function errorResponse(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

/** Maps AI failures to honest status codes without leaking internal details. */
export function aiErrorResponse(err: unknown) {
  if (err instanceof LLMError && err.status === 429 && (err.retryAfterSeconds ?? 0) > 60) {
    return errorResponse(429, "The AI usage limit has been reached. Please try again later.");
  }
  if (err instanceof LLMError && (err.status === 429 || err.status === 503)) {
    return errorResponse(503, "The AI service is busy right now. Try again in a minute.");
  }
  // 502 Bad Gateway: our server is fine, but a service it depends on failed.
  return errorResponse(502, "The AI service failed to respond. Please try again.");
}

/**
 * Reads a JSON body, rejecting oversized payloads before they reach the model
 * and cost tokens. Returns either the parsed data or a ready-made error response.
 */
export async function readJson(request: Request, maxChars = 100_000): Promise<{ data: unknown } | { error: Response }> {
  const text = await request.text().catch(() => "");
  if (text.length > maxChars) return { error: errorResponse(413, "Request is too large.") };
  try {
    return { data: JSON.parse(text) };
  } catch {
    return { error: errorResponse(400, "Request body must be valid JSON.") };
  }
}

/**
 * Turns a stream of text into a streaming HTTP response. It's pull-based: the
 * next piece is only requested when the client is ready for it (backpressure),
 * and the model stream is stopped if the client disconnects.
 */
export function textStreamResponse(stream: AsyncIterable<string>, headers: Record<string, string>) {
  const iterator = stream[Symbol.asyncIterator]();
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (done) controller.close();
        else controller.enqueue(encoder.encode(value));
      } catch (err) {
        console.error("[stream] failed mid-response:", err);
        controller.error(err);
      }
    },
    async cancel() {
      await iterator.return?.();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // Stops proxies from buffering or compressing the stream, which would
      // hold text back and defeat the point of streaming.
      "Cache-Control": "no-cache, no-transform",
      ...headers,
    },
  });
}
