"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { ChatMessage, InterviewPlan, InterviewSetup } from "@/lib/interview/schema";
import type { Resume } from "@/lib/resume/schema";

type Status =
  | { name: "ready" }
  | { name: "streaming" }
  | { name: "answering" }
  | { name: "finished" }
  | { name: "error"; message: string; history: ChatMessage[] };

interface Props {
  resume: Resume;
  setup: InterviewSetup;
  plan: InterviewPlan;
  onRestart: () => void;
}

export function InterviewChat({ resume, setup, plan, onRestart }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<Status>({ name: "ready" });
  const [topic, setTopic] = useState(1);
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Asks the server for the interviewer's next message and streams it in.
  // `history` is the entire transcript: the server is stateless, so every
  // request must carry everything it needs.
  async function requestTurn(history: ChatMessage[]) {
    try {
      const response = await fetch("/api/interview/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setup, resume, plan, messages: history }),
      });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "The interviewer couldn't respond.");
      }

      // Headers arrive before the body, so we know the step before any text does.
      const step = response.headers.get("X-Interview-Step");
      setTopic(Number(response.headers.get("X-Interview-Topic")));

      // Read the body chunk by chunk as the model writes it, re-rendering each time.
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let reply = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += value;
        setMessages([...history, { role: "assistant", content: reply }]);
      }
      if (!reply.trim()) throw new Error("The interviewer didn't respond.");

      setStatus(step === "closing" ? { name: "finished" } : { name: "answering" });
    } catch (err) {
      // fetch reports network failures as a TypeError with an unhelpful message.
      const message = err instanceof Error && !(err instanceof TypeError) ? err.message : "Connection problem.";
      setMessages(history);
      setStatus({ name: "error", message, history });
    }
  }

  // Every request starts from a user action (Begin, Send, Retry), so it lives in
  // event handlers rather than in an effect. "Fetch when the component mounts"
  // effects are a classic source of double requests and race conditions.
  function send(history: ChatMessage[]) {
    setMessages(history);
    setStatus({ name: "streaming" });
    void requestTurn(history);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status.name]);

  useEffect(() => {
    if (status.name === "answering") textareaRef.current?.focus();
  }, [status.name]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const answer = draft.trim();
    if (!answer || status.name !== "answering") return;
    setDraft("");
    send([...messages, { role: "user", content: answer }]);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends and Shift+Enter adds a line. isComposing skips the Enter that
    // confirms a character in IME input (Chinese, Japanese, Korean and others).
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  const topicCount = plan.topics.length;
  const progress = status.name === "finished" ? 100 : ((topic - 1) / topicCount) * 100;
  const waitingForFirstToken = status.name === "streaming" && messages.at(-1)?.role !== "assistant";

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold">
            {setup.role} <span className="font-normal text-zinc-500">· {setup.level}</span>
          </h2>
          <p className="shrink-0 text-sm text-zinc-500">
            {status.name === "finished" ? "Complete" : `Topic ${topic} of ${topicCount}`}
          </p>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div className="h-full bg-zinc-900 transition-all dark:bg-zinc-100" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <ol className="flex flex-col gap-4">
        {messages.map((message, i) => (
          <li
            key={i}
            className={
              message.role === "assistant"
                ? "max-w-[85%] self-start rounded-2xl rounded-bl-sm bg-zinc-100 px-4 py-3 dark:bg-zinc-800"
                : "max-w-[85%] self-end rounded-2xl rounded-br-sm bg-zinc-900 px-4 py-3 text-white dark:bg-zinc-100 dark:text-zinc-900"
            }
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
          </li>
        ))}
        {waitingForFirstToken && (
          <li className="self-start rounded-2xl rounded-bl-sm bg-zinc-100 px-4 py-3 text-zinc-500 dark:bg-zinc-800">
            <span className="animate-pulse">Interviewer is typing…</span>
          </li>
        )}
      </ol>

      {status.name === "error" && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          <span>{status.message}</span>
          <button onClick={() => send(status.history)} className="shrink-0 font-medium underline">
            Retry
          </button>
        </div>
      )}

      {status.name === "ready" && (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
          <p className="font-medium">Your interview is ready.</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {topicCount} topics, about {topicCount * 4} minutes. Answer as you would in a real interview: specific
            examples and numbers beat general statements.
          </p>
          <button
            onClick={() => send([])}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Begin interview
          </button>
        </div>
      )}

      {status.name === "ready" ? null : status.name === "finished" ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
          <p className="font-medium">{"That's the end of the interview."}</p>
          <button
            onClick={onRestart}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Start a new interview
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="sticky bottom-0 flex flex-col gap-2 border-t border-zinc-200 bg-background py-4 dark:border-zinc-800"
        >
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            maxLength={4000}
            aria-label="Your answer"
            placeholder={status.name === "answering" ? "Type your answer…" : "Waiting for the interviewer…"}
            className="resize-none rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          />
          <div className="flex items-center justify-between gap-4 text-xs text-zinc-500">
            <span>Enter to send · Shift+Enter for a new line</span>
            <button
              type="submit"
              disabled={status.name !== "answering" || !draft.trim()}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Send
            </button>
          </div>
        </form>
      )}

      <div ref={bottomRef} />
    </section>
  );
}
