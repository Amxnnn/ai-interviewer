import { z } from "zod";
import { aiErrorResponse, errorResponse, readJson } from "@/lib/http";
import { createInterviewPlan } from "@/lib/interview/plan";
import { InterviewSetupSchema } from "@/lib/interview/schema";
import { EnrichedResumeSchema } from "@/lib/resume/schema";

const PlanRequestSchema = z.object({
  resume: EnrichedResumeSchema,
  setup: InterviewSetupSchema,
});

export async function POST(request: Request) {
  const body = await readJson(request);
  if ("error" in body) return body.error;

  const parsed = PlanRequestSchema.safeParse(body.data);
  if (!parsed.success) return errorResponse(400, "Invalid interview setup.");

  try {
    const plan = await createInterviewPlan(parsed.data.resume, parsed.data.setup);
    return Response.json({ plan });
  } catch (err) {
    console.error("[interview] planning failed:", err);
    return aiErrorResponse(err);
  }
}
