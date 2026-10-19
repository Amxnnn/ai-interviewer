import "server-only";
import { streamText } from "@/lib/llm";
import type { Resume } from "@/lib/resume/schema";
import { INTERVIEWER, KICKOFF_MESSAGE } from "@/prompts/interviewer";
import { nextStep } from "./flow";
import type { ChatMessage, InterviewPlan, InterviewSetup } from "./schema";

interface TurnInput {
  setup: InterviewSetup;
  resume: Resume;
  plan: InterviewPlan;
  /** The full transcript so far. The model remembers nothing, so it gets all of it, every turn. */
  messages: ChatMessage[];
  signal?: AbortSignal;
}

/** Starts streaming the interviewer's next message. Returns null if the interview already ended. */
export async function startInterviewerTurn({ setup, resume, plan, messages, signal }: TurnInput) {
  const step = nextStep(messages.length / 2, plan.topics.length);
  if (!step) return null;

  const stream = await streamText({
    tag: INTERVIEWER.version,
    system: INTERVIEWER.system({ setup, resume, plan, step }),
    messages: [{ role: "user", content: KICKOFF_MESSAGE }, ...messages],
    // Measured on gemini-3.6-flash: ~1.4s to first token at "minimal" versus
    // ~5s at the default, with no visible drop in question quality.
    reasoningEffort: "minimal",
    // A safety net against runaway output, far above the ~120 tokens a reply needs.
    maxOutputTokens: 1000,
    signal,
  });

  return { step, stream };
}
