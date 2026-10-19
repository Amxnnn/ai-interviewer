# AI Interviewer

Upload a resume, get interviewed by an AI that asks about *your* experience, and receive scored feedback at the end.

Built with Next.js (App Router, TypeScript), the Gemini API, and Zod.

## Setup

```bash
npm install
cp .env.example .env.local   # then add your GEMINI_API_KEY
npm run hello                # smoke test: key + model + adapter
npm run dev                  # http://localhost:3000
```

Free-tier quotas are per model and small (about 20 requests/day on the main Flash model; one full interview uses ~13). See `.env.example` for picking a development model.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the app |
| `npm run hello` | One LLM call to prove the setup works |
| `npm run parse -- <file.pdf>` | Run the resume pipeline from the terminal (add `--text` to only extract text) |
| `npm run simulate -- <file.pdf>` | Scripted candidate runs a 2-topic interview, including a non-answer and a prompt-injection attempt |
| `npm run models` | List the Gemini models your key can use |

`samples/` holds fictional test resumes, including one with a hidden prompt-injection attack in white text.

## Architecture

```
Browser ──PDF──► POST /api/resume          ──► extract text ──► LLM "resume-parser"     ──► Resume JSON
        ──────► POST /api/interview/plan   ──────────────────► LLM "interview-planner" ──► Plan JSON (N topics)
        ──────► POST /api/interview/turn   ──► nextStep() ───► LLM "interviewer" ──stream──► one message
                (repeated each turn, with the full transcript)
```

- **Code owns the flow, the model owns the words.** `lib/interview/flow.ts` decides each turn's step (opening, follow-up, next topic, closing) from the transcript length. The prompt only says what to do for that one step.
- **Stateless server (for now).** The browser sends setup, resume, plan and transcript with every turn. That's simple, but the client can read the plan and edit the transcript; Phase 4 moves state into a database.
- **Streaming.** Turns stream as plain text. The step travels in `X-Interview-*` response headers, which arrive before the body.

| Path | Responsibility |
|---|---|
| `lib/llm/` | The only code that knows which AI vendor we use: adapter, retries with backoff, structured output, streaming, one log line per call |
| `prompts/` | Versioned prompts. Changing wording means bumping the version |
| `lib/resume/` | PDF text extraction, the `Resume` schema, parsing, derived stats |
| `lib/interview/` | Setup and plan schemas, the turn state machine, planning and turn logic |
| `lib/http.ts` | Shared HTTP helpers: error mapping, body size limits, streaming responses |
| `app/api/` | HTTP boundary: input validation and status codes |
| `components/` | Client UI: upload → setup → interview |

## Roadmap

- [x] **Phase 0**: project setup, provider-agnostic LLM layer
- [x] **Phase 1**: resume upload → structured JSON
- [x] **Phase 2**: interview plan + streamed chat loop
- [ ] **Phase 3**: feedback report (LLM-as-judge with a rubric)
- [ ] **Phase 4**: persistence in Postgres, server-side interview state
- [ ] **Phase 5**: evals and LLM call logging
- [ ] Later: auth, voice, role-specific question banks (RAG), rate limiting
