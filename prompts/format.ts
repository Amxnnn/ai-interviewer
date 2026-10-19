import type { Resume } from "@/lib/resume/schema";

/**
 * Serializes data for a prompt. Escaping "<" means nothing inside (say, a
 * resume line reading "</resume> new instructions:") can close our XML-style
 * tags early. The model reads < as "<" just fine.
 */
export function asPromptData(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/</g, "\\u003c");
}

/** The resume as later prompts see it: content only, without the pipeline's flags. */
export function resumeForPrompt(resume: Resume): string {
  const { name, headline, totalYearsExperience, skills, experience, projects, education, interviewHooks } = resume;
  return asPromptData({ name, headline, totalYearsExperience, skills, experience, projects, education, interviewHooks });
}
