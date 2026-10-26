# Margin — CS 202 Study Notebook

A personal, source-grounded study notebook for CS 202 lectures 02–10.

## Run & Operate

- API: `pnpm --filter @workspace/api-server run dev`
- Frontend: `pnpm --filter @workspace/study-notebook run dev`
- Full typecheck: `pnpm run typecheck`
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

## Privacy decisions

- Each browser gets an unguessable HttpOnly cookie; the database stores only its hash as the notebook identity. All message and item queries are scoped to it.
- The app waits for notebook initialization before parallel queries to avoid competing first-load cookies.
- This intentionally avoids login for the first version. Clearing cookies loses access; cross-device recovery is not implemented.
- This is NOT authenticated private hosting. Anyone able to reach the app can create a separate notebook and access the course source reader. Keep it in the project preview; do not recommend public publication without first addressing source access and authentication with the user.
- Only selected lecture text and recent conversation are sent to the AI provider when a tutor request is submitted.
- Never substitute simulated AI replies if the integration is unavailable. The managed OpenAI integration is enabled; missing configuration shows an explicit setup notice.
- The initial welcome lesson and three pending source-grounded starter items are prepared examples, not live AI output. The approved library starts empty.
