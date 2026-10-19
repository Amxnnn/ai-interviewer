import { z } from "zod";
import { aiErrorResponse, errorResponse, readJson, textStreamResponse } from "@/lib/http";
import { isWellFormedHistory } from "@/lib/interview/flow";
import { ChatMessageSchema, InterviewPlanSchema, InterviewSetupSchema } from "@/lib/interview/schema";
import { startInterviewerTurn } from "@/lib/interview/turn";
import { EnrichedResumeSchema } from "@/lib/resume/schema";

// This endpoint is stateless: the browser sends the whole interview (setup,
// resume, plan and transcript) with every turn, and the server keeps nothing
// between requests. The catch is that the browser can edit any of it, even the
// interviewer's past messages. Phase 4 fixes that by moving the source of
// truth into a database.
const TurnRequestSchema = z.object({
  setup: InterviewSetupSchema,
  resume: EnrichedResumeSchema,
  plan: InterviewPlanSchema,
  messages: z.array(ChatMessageSchema).max(30),
});

export async function POST(request: Request) {
  const body = await readJson(request);
  if ("error" in body) return body.error;

  const parsed = TurnRequestSchema.safeParse(body.data);
  if (!parsed.success) return errorResponse(400, "Invalid interview request.");
  if (!isWellFormedHistory(parsed.data.messages)) {
    return errorResponse(400, "Messages must alternate, starting with the interviewer.");
  }

  let turn;
  try {
    turn = await startInterviewerTurn({ ...parsed.data, signal: request.signal });
  } catch (err) {
    // An aborted request means the user left; there's nobody to answer and nothing to log.
    if (!request.signal.aborted) console.error("[interview] turn failed:", err);
    return aiErrorResponse(err);
  }
  if (!turn) return errorResponse(409, "This interview has already finished.");

  const { step, stream } = turn;
  const topicCount = parsed.data.plan.topics.length;

  // The step is decided before generation starts, so it can travel in headers,
  // which arrive before the streamed body.
  return textStreamResponse(stream, {
    "X-Interview-Step": step.kind,
    "X-Interview-Topic": String(step.kind === "closing" ? topicCount : step.topicIndex + 1),
    "X-Interview-Topics": String(topicCount),
  });
}
