// The interview's control flow lives here, in plain code, not in the prompt.
// Every topic gets one main question and one follow-up, then a closing message.
// The model decides what to SAY; code decides what HAPPENS next. That makes
// the interview's length predictable, testable, and impossible to talk the
// model out of.

export type InterviewStep =
  | { kind: "opening"; topicIndex: number }
  | { kind: "main"; topicIndex: number }
  | { kind: "follow-up"; topicIndex: number }
  | { kind: "closing" };

/** Given how many interviewer messages exist so far, what is the next one? Null once finished. */
export function nextStep(interviewerTurns: number, topicCount: number): InterviewStep | null {
  if (interviewerTurns > topicCount * 2) return null;
  if (interviewerTurns === topicCount * 2) return { kind: "closing" };

  const topicIndex = Math.floor(interviewerTurns / 2);
  if (interviewerTurns % 2 === 1) return { kind: "follow-up", topicIndex };
  return { kind: interviewerTurns === 0 ? "opening" : "main", topicIndex };
}

/**
 * A valid history alternates interviewer, candidate, interviewer, ... and ends
 * with the candidate's answer (or is empty, before the opening question).
 */
export function isWellFormedHistory(messages: { role: "user" | "assistant" }[]): boolean {
  return (
    messages.length % 2 === 0 &&
    messages.every((message, i) => message.role === (i % 2 === 0 ? "assistant" : "user"))
  );
}
