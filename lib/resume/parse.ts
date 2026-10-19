import "server-only";
import { generateObject } from "@/lib/llm";
import { RESUME_PARSER } from "@/prompts/resume-parser";
import { totalYearsOfExperience } from "./experience";
import { ResumeSchema, type Resume } from "./schema";

/** ~8k tokens. Real resumes are far shorter; this caps the cost if someone uploads a book. */
const MAX_CHARS = 30_000;

export async function parseResume(rawText: string) {
  // Remove our own delimiter tags so resume text can't "close" the data block
  // early and smuggle in text that looks like it's outside the fence.
  const text = rawText.replace(/<\/?resume_text>/gi, "").slice(0, MAX_CHARS);

  // No temperature set on purpose: Gemini 3 models are tuned for the default,
  // and the JSON schema already forces a consistent shape.
  const { data, usage } = await generateObject({
    tag: RESUME_PARSER.version,
    system: RESUME_PARSER.system,
    messages: [{ role: "user", content: RESUME_PARSER.user(text) }],
    schema: ResumeSchema,
  });

  const resume: Resume = { ...data, totalYearsExperience: totalYearsOfExperience(data.experience) };
  return { resume, usage, truncated: rawText.length > MAX_CHARS };
}
