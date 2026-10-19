import type { ReactNode } from "react";
import type { Resume } from "@/lib/resume/schema";

export function ResumeSummary({ resume, truncated }: { resume: Resume; truncated: boolean }) {
  return (
    <section className="flex flex-col gap-6">
      {resume.containsPromptInjection && (
        <Notice>This resume contains hidden instructions aimed at an AI. They were detected and ignored.</Notice>
      )}
      {truncated && <Notice>This resume is very long, so only the first part was analyzed.</Notice>}

      <header>
        <h2 className="text-xl font-semibold">{resume.name ?? "Unnamed candidate"}</h2>
        {resume.headline && <p className="text-zinc-600 dark:text-zinc-400">{resume.headline}</p>}
        {resume.totalYearsExperience !== null && (
          <p className="text-sm text-zinc-500">About {resume.totalYearsExperience} years of experience</p>
        )}
      </header>

      <Section title="What the interviewer will probe">
        <ul className="list-disc space-y-1 pl-5">
          {resume.interviewHooks.map((hook, i) => (
            <li key={i}>{hook}</li>
          ))}
        </ul>
      </Section>

      <Section title="Skills">
        <ul className="flex flex-wrap gap-2">
          {resume.skills.map((skill, i) => (
            <li key={i} className="rounded-full bg-zinc-100 px-3 py-1 text-sm dark:bg-zinc-800">
              {skill}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Experience">
        <ul className="space-y-4">
          {resume.experience.map((job, i) => (
            <li key={i}>
              <p className="font-medium">
                {job.title} · {job.company}
              </p>
              <p className="text-sm text-zinc-500">{formatDateRange(job)}</p>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {job.highlights.map((highlight, j) => (
                  <li key={j}>{highlight}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Section>

      <details className="text-sm">
        <summary className="cursor-pointer text-zinc-500">Raw structured output (what the next AI step receives)</summary>
        <pre className="mt-2 overflow-x-auto rounded-md bg-zinc-100 p-3 text-xs dark:bg-zinc-900">
          {JSON.stringify(resume, null, 2)}
        </pre>
      </details>
    </section>
  );
}

function formatDateRange(job: Resume["experience"][number]) {
  const end = job.current ? "Present" : job.end && formatMonth(job.end);
  return [job.start && formatMonth(job.start), end].filter(Boolean).join(" – ");
}

// "2023-03" -> "Mar 2023". UTC so the month can't shift with the viewer's timezone.
function formatMonth(yearMonth: string) {
  return new Date(`${yearMonth}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold tracking-wide text-zinc-500 uppercase">{title}</h3>
      {children}
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      {children}
    </p>
  );
}
