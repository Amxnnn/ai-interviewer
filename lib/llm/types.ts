// The provider-agnostic contract. Everything outside lib/llm/ talks to these
// types, never to a vendor SDK directly. That is what makes providers swappable:
// adding Claude or OpenAI later means writing one new adapter, nothing else.

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface GenerateRequest {
  /** Rules and persona. Sent separately from the conversation. */
  system?: string;
  /** The conversation so far. The model is stateless: send all of it, every call. */
  messages: ChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  /**
   * How much the model "thinks" before answering. More thinking means better
   * reasoning, but more latency and more billed tokens. Omit for the model default.
   */
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
  /** When set, the provider must return JSON that matches this JSON Schema. */
  jsonSchema?: Record<string, unknown>;
  /** Cancels the request, e.g. when the user closes the tab mid-stream. */
  signal?: AbortSignal;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  /** "Thinking" tokens on reasoning models: billed as output, never shown in the reply. */
  reasoningTokens: number;
}

export interface GenerateResponse {
  text: string;
  usage: TokenUsage;
  model: string;
}

export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "done"; usage: TokenUsage; model: string };

export interface LLMProvider {
  readonly name: string;
  generate(request: GenerateRequest): Promise<GenerateResponse>;
  /** Resolves once the provider has accepted the request, then yields text as it is generated. */
  stream(request: GenerateRequest): Promise<AsyncIterable<StreamEvent>>;
}
