"use client";

import { useActionState } from "react";
import type { Resume } from "@/lib/resume/schema";

type UploadResult = { resume: Resume; truncated: boolean } | { error: string };

async function uploadResume(formData: FormData): Promise<UploadResult> {
  try {
    const response = await fetch("/api/resume", { method: "POST", body: formData });
    const body = await response.json();
    if (!response.ok) return { error: body.error ?? "Something went wrong." };
    return { resume: body.resume, truncated: body.truncated };
  } catch {
    return { error: "Network error. Is the dev server running?" };
  }
}

export function ResumeUploader({ onParsed }: { onParsed: (resume: Resume, truncated: boolean) => void }) {
  const [error, formAction, isPending] = useActionState(async (_previous: string | null, formData: FormData) => {
    const result = await uploadResume(formData);
    if ("error" in result) return result.error;
    onParsed(result.resume, result.truncated);
    return null;
  }, null);

  return (
    <div className="flex flex-col gap-4">
      <form
        action={formAction}
        className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-5 sm:flex-row sm:items-center dark:border-zinc-800"
      >
        <input
          type="file"
          name="resume"
          accept="application/pdf"
          required
          disabled={isPending}
          className="min-w-0 flex-1 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-zinc-200 dark:file:bg-zinc-800 dark:hover:file:bg-zinc-700"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isPending ? "Reading resume…" : "Analyze resume"}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
