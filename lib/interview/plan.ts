import "server-only";
import { generateObject } from "@/lib/llm";
import type { Resume } from "@/lib/resume/schema";
import { INTERVIEW_PLANNER } from "@/prompts/interview-planner";
import { planSchemaFor, type InterviewPlan, type InterviewSetup } from "./schema";

/**
 * One structured call that designs the whole interview up front. Planning
 * separately from talking is prompt chaining: the planner can think hard
 * once (default reasoning), so each live turn can be fast.
 */
export async function createInterviewPlan(resume: Resume, setup: InterviewSetup): Promise<InterviewPlan> {
  const { data } = await generateObject({
    tag: INTERVIEW_PLANNER.version,
    system: INTERVIEW_PLANNER.system,
    messages: [{ role: "user", content: INTERVIEW_PLANNER.user({ resume, setup }) }],
    schema: planSchemaFor(setup.topicCount),
  });
  return data;
}
