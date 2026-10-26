# Margin — CS 202 Study Notebook

A personal, source-grounded study notebook for CS 202 lectures 02–10.

## Run & Operate

- API: `pnpm --filter @workspace/api-server run dev`
- Frontend: `pnpm --filter @workspace/study-notebook run dev`
- Full typecheck: `pnpm run typecheck`
- Practice engine checks: `pnpm --filter @workspace/scripts exec tsx testing-hub.test.ts`
- Testing Hub UI regressions: `pnpm --filter @workspace/study-notebook test` (real components with isolated API fixtures; no running server required)
- API codegen: `pnpm --filter @workspace/api-spec run codegen`
- Development DB schema: `pnpm --filter @workspace/db run push`
- Re-import provided lecture text: `node scripts/import-lectures.mjs`
- Use the existing managed artifact workflows, not standalone dev commands.

## Stack and source of truth

- React/Vite frontend in `artifacts/study-notebook`.
- Express API in `artifacts/api-server`; API contract in `lib/api-spec/openapi.yaml`.
- PostgreSQL and Drizzle schemas in `lib/db/src/schema`.
- Lecture text with original PDF page numbering in `artifacts/api-server/src/data/lectures.json`, bundled only into the server.
- Uploaded original files are in `.local/conversation-workspace/files/attached_assets`.
- AI integration package in `lib/integrations-openai-ai-server`.

## Product and user requirements

- Smallest useful version first; no login screens.
- Calm, professional, responsive, reading-optimized experience.
- Tutor teaches incrementally, adapts to knowledge level and conversation history, and ends with a checking question.
- Automatic extraction of concepts, terminology, and flashcard questions.
- Every extracted item needs an exact, server-verified source excerpt with a lecture and page reference.
- Items remain pending until explicitly approved. Edit, approve, merge, and discard are supported; merge preserves both items’ citations.
- Approved items persist in PostgreSQL, not just browser storage.

## Tutor, source reader, and testing

- The source reader occupies the viewport below navigation. Its lecture list and document have independent vertical scrolling, including stacked panels on phones.
- The tutor is Socratic: evaluate the student's reasoning concisely, identify the first misconception, and ask one guiding question rather than immediately presenting a full solution.
- Voice input uses browser-native SpeechRecognition or webkitSpeechRecognition. Click to start/stop, review the editable transcript, then explicitly send. Unsupported browsers and denied permissions retain typed input. Browser speech services may process audio externally; the UI discloses this.
- `/library` is the Testing Hub, with Quick Recall, Applied Practice, and Exam Simulator.
- Quick Recall remains the PostgreSQL-backed approved library, filterable by source lecture. Pending items never appear there.
- Applied questions are computed practice variations grounded in matching original lecture excerpts. Missing supporting evidence means no question. Missing lecture diagrams must never be invented or described as if imported; FSM variations include their own complete transition specification.
- Practice and exam questions are temporary exercises, not automatically approved permanent cards. This separation preserves the user's review-before-library requirement.
- Exams cover selected lectures and mix terminology with applied questions. Solutions stay hidden until submission; blanks count as wrong. Questions and choices are randomized, but each answer is computed from a defined rule.
- Exam answers/results are session-only and explicitly labelled as not saved on reload. Original approved cards and conversation remain persisted in PostgreSQL.

## Privacy decisions

- Each browser gets an unguessable HttpOnly cookie; the database stores only its hash as the notebook identity. All message and item queries are scoped to it.
- The app waits for notebook initialization before parallel queries to avoid competing first-load cookies.
- This intentionally avoids login for the first version. Clearing cookies loses access; cross-device recovery is not implemented.
- This is NOT authenticated private hosting. Anyone able to reach the app can create a separate notebook and access the course source reader. Keep it in the project preview; do not recommend public publication without first addressing source access and authentication with the user.
- Only selected lecture text and recent conversation are sent to the AI provider when a tutor request is submitted.
- Never substitute simulated AI replies if the integration is unavailable. The managed OpenAI integration is enabled; missing configuration shows an explicit setup notice.
- The initial welcome lesson and three pending source-grounded starter items are prepared examples, not live AI output. The approved library starts empty.
