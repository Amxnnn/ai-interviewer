import { z } from "zod";
import { LEVELS } from "./levels";

export const InterviewSetupSchema = z.object({
  // Free text from the user ends up inside prompts, so cap it and forbid the
  // angle brackets that could fake our XML-style prompt tags.
  role: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[^<>]*$/),
  level: z.enum(LEVELS),
  topicCount: z.number().int().min(2).max(6),
});

export const TopicSchema = z.object({
  title: z.string().describe("Short label, e.g. 'Billing service migration'."),
  type: z.enum(["experience", "technical", "behavioral"]),
  question: z.string().describe("The single opening question for this topic, grounded in the resume where possible."),
  lookFor: z
    .string()
    .describe("What a strong answer demonstrates. Guides the follow-up question and, later, the grading."),
});

export const InterviewPlanSchema = z.object({
  topics: z.array(TopicSchema).min(1).max(6),
});

/** The planner's schema pins the exact topic count, so the model can't return more or fewer. */
export const planSchemaFor = (topicCount: number) =>
  z.object({ topics: z.array(TopicSchema).length(topicCount) });

export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(4000),
});

export type InterviewSetup = z.infer<typeof InterviewSetupSchema>;
export type InterviewPlan = z.infer<typeof InterviewPlanSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
