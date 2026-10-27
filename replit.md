# Margin — Private Study Notebook

A private, source-grounded study notebook for any class. The original CS 202 lectures 02–10 remain the first course.

## Run & Operate

- API: `pnpm --filter @workspace/api-server run dev`
- Frontend: `pnpm --filter @workspace/study-notebook run dev`
- Full typecheck: `pnpm run typecheck`
- Legacy practice/revision helper checks: `pnpm --filter @workspace/scripts exec tsx testing-hub.test.ts`
- Legacy-to-account persistence checks: `pnpm --filter @workspace/scripts exec tsx course-persistence.test.ts`
- Course editing/cascade/private-file cleanup regression: `pnpm --filter @workspace/scripts exec tsx course-management.test.ts` (isolated fixtures only)
- Public-access regression checks: `node scripts/private-access.test.mjs`
- Authenticated upload/tutor/exam/backup journeys require the Clerk browser tester. The earlier cookie-only live scripts explicitly skip their pre-authentication scenarios rather than installing an authentication bypass.
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

- All study content must be behind secure sign-in, including API routes and source text. Access is limited to the configured verified owner.
- Users can create courses, upload PDF/text/Markdown sources, and switch between courses. Tutor history, review items, library, practice, and exams must remain course-scoped.
- Courses support persistent pinning and inline title editing. Pinned courses precede unpinned courses in Manage Courses and the course selector; creation order is preserved within each group.
- Course deletion requires an explicit permanent-loss confirmation and must remove all course-owned originals, extracted sources, conversations, review items, flashcards, and exam history/statistics. Other courses must remain intact. Deleting the last course leaves an empty notebook; never recreate the original lectures automatically afterward.
- Calm, professional, responsive, reading-optimized experience.
- Tutor teaches incrementally, adapts to knowledge level and conversation history, and ends with a checking question.
- Automatic extraction of concepts, terminology, and flashcard questions.
- Every extracted item needs an exact, server-verified source excerpt with a source and page reference.
- Items remain pending until explicitly approved. Edit, approve, merge, and discard are supported; merge preserves both items’ citations.
- Approved items persist in PostgreSQL, not just browser storage.

## Tutor, source reader, and testing

- The source reader occupies the viewport below navigation. Its lecture list and document have independent vertical scrolling, including stacked panels on phones.
- The tutor is Socratic: evaluate the student's reasoning concisely, identify the first misconception, and ask one guiding question rather than immediately presenting a full solution.
- When the student is confused or does not understand, explain only the first small step, use at most 60 words, ask exactly one simple question, and wait. Do not substitute a longer worked solution even if they also request one.
- Changing the Tutor source starts a new source-session identity and clears the visible chat/draft. Model history is scoped by notebook, course, session, and source. A source switch never silently resumes context. Users may explicitly resume a saved conversation; legacy messages are view-only. Stored conversations and review items are not deleted.
- Citation title, page, and excerpt must resolve together from a server-owned evidence chunk; extracted cards use that same resolver, never the current UI selection as substitute metadata.
- Voice input uses browser-native SpeechRecognition or webkitSpeechRecognition. Click to start/stop, review the editable transcript, then explicitly send. Unsupported browsers and denied permissions retain typed input. Browser speech services may process audio externally; the UI discloses this.
- `/library` is the Testing Hub, with Quick Recall, Applied Practice, and Exam Simulator.
- Quick Recall remains the PostgreSQL-backed approved library, filterable by source lecture. Pending items never appear there.
- Applied questions are generated from the selected course sources, not a fixed CS question bank. Use subject-appropriate applied reasoning, exact citations, complete problem inputs, distinct answer choices, and an independent answer-quality check. Missing diagrams must never be invented or described as imported.
- Practice and exam questions are temporary exercises, not automatically approved permanent cards. This separation preserves the user's review-before-library requirement.
- Exams cover selected sources and mix terminology with applied questions. The UI hides solutions until submission; blanks count as wrong. Questions and choices are randomized.
- Frozen exam questions, answers, progress, and scores persist in PostgreSQL. Saves use optimistic concurrency; retries retain the original snapshot. Approved cards and conversations persist as well.

## Privacy and persistence

- Managed Clerk authentication uses same-origin cookies and the canonical Clerk proxy. All content routes verify the configured owner's verified email on the server. Do not add an unauthenticated development bypass.
- Owner configuration belongs in `MARGIN_OWNER_EMAIL`, never in client code or committed instructions. Configure managed sign-in methods through the workspace Auth pane.
- Account ownership uses a stable hash of the verified owner email so development/production identity changes do not invalidate a copied notebook. The original browser's unguessable HttpOnly cookie only authorizes importing its earlier notebook after owner sign-in; it is not authentication.
- Signing in from the earlier browser preserves its approved cards, history, and exams. This import also works if the owner already signed in elsewhere; data is moved atomically into the account without overwriting other courses.
- The app initializes account/course state before parallel content queries. Course switches cancel and clear cached content, reset tutor context, and remount course-specific views. Sign-out clears all private query data.
- Uploaded originals are private App Storage objects; extracted text and metadata are in PostgreSQL. Do not expose storage paths or create public object routes. Uploads accept selectable-text PDFs up to 80 pages, UTF-8 text/Markdown, and at most 15 MB; scanned PDFs require OCR before upload.
- Vite file serving must deny backend data, original uploads, database source, and private workspace directories, including in the component sandbox. An API login guard alone does not protect Vite `/@fs/` endpoints.
- Source excerpts and conversation are sent to the AI provider only on explicit tutoring or practice/exam generation. Browser speech processing may use an external service.
- Download Backup exports a consistent, readable JSON snapshot across every course: approved cards, saved exam attempts/statistics, chats, and extracted sources. It excludes credentials, account identifiers, private storage paths, and original file bytes.
- Never substitute simulated AI replies if the integration is unavailable. The managed OpenAI integration is enabled; missing configuration shows an explicit setup notice.
- The initial welcome lesson and three pending source-grounded starter items are prepared examples, not live AI output. The approved library starts empty.
