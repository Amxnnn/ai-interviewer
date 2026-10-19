import { InterviewApp } from "@/components/interview-app";

// Server component: renders the static shell. Only the interactive app below
// is a client component, which keeps the JavaScript sent to the browser small.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">AI Interviewer</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Upload your resume and the interviewer will tailor its questions to your experience.
        </p>
      </header>
      <InterviewApp />
    </main>
  );
}
