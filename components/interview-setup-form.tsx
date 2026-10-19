"use client";

import { useActionState } from "react";
import { LEVELS, suggestLevel, type Level } from "@/lib/interview/levels";
import type { InterviewPlan, InterviewSetup } from "@/lib/interview/schema";
import type { Resume } from "@/lib/resume/schema";

interface Props {
  resume: Resume;
  onReady: (setup: InterviewSetup, plan: InterviewPlan) => void;
  onBack: () => void;
}

export function InterviewSetupForm({ resume, onReady, onBack }: Props) {
  const [error, formAction, isPending] = useActionState(async (_previous: string | null, formData: FormData) => {
    // The browser checks the basics (required, length); the server re-validates
    // everything, because client-side checks are a convenience, not security.
    const setup: InterviewSetup = {
      role: String(formData.get("role")).trim(),
      level: formData.get("level") as Level,
      topicCount: Number(formData.get("topicCount")),
    };
    try {
      const response = await fetch("/api/interview/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume, setup }),
      });
      const body = await response.json();
      if (!response.ok) return body.error ?? "Couldn't prepare the interview.";
      onReady(setup, body.plan);
      return null;
    } catch {
      return "Network error. Is the dev server running?";
    }
  }, null);

  const fieldClass =
    "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700";

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
      <h2 className="text-lg font-semibold">Set up your interview</h2>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Role
        <input
          name="role"
          required
          minLength={2}
          maxLength={80}
          pattern="[^<>]*"
          defaultValue={resume.headline?.slice(0, 80) ?? ""}
          placeholder="e.g. Backend Engineer"
          disabled={isPending}
          className={fieldClass}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Level
          <select
            name="level"
            defaultValue={suggestLevel(resume.totalYearsExperience)}
            disabled={isPending}
            className={fieldClass}
          >
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {level[0].toUpperCase() + level.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Length
          <select name="topicCount" defaultValue="3" disabled={isPending} className={fieldClass}>
            <option value="3">Quick: 3 topics (~10 min)</option>
            <option value="5">Full: 5 topics (~25 min)</option>
          </select>
        </label>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={isPending}
          className="text-sm text-zinc-500 hover:text-zinc-900 disabled:opacity-50 dark:hover:text-zinc-100"
        >
          Use a different resume
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isPending ? "Preparing your interview…" : "Start interview"}
        </button>
      </div>
    </form>
  );
}
