# CogniBase architecture

The README covers setup. This is how the pieces fit.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind v4 (+ typography plugin, enabled in `globals.css`) · Framer Motion · Prisma 7 with `@prisma/adapter-pg` · Postgres + pgvector · Supabase auth and storage · Gemini (`gemini-3.5-flash`, `gemini-embedding-001` truncated to 768 dimensions) through `@google/generative-ai` and the Vercel AI SDK.

## Screens

| Route | Screen | Notes |
|---|---|---|
| `/dashboard` | Home | Next class, resume a guide, focus today, recent sources. Data from `/api/home`. |
| `/vault` | Library | List, search and filter sources; add files, links or pasted text; select sources for bulk delete; per-source menu (open console, read, build a guide, retry indexing, delete). |
| `/study-guides` | Study | Guides list and the guide player (`StudyEngine`); second tab for saved flashcards, mind maps and slides. `/studio-assets` redirects here. |
| `/analytics` | Progress | Streak, today's goals, 7-day focus chart (with table view). |
| `/schedule` | Schedule | Courses and timetable. Imports from photos/PDFs. |
| `/lecture-materials/[id]` | Reader | PDF viewer, or scroll/paged reader for extracted text. Text is run through `lib/reader/format.ts` (headings, lists, paragraphs) at read time; a toggle shows the original. The `>_ console` is attached here. |
| `/settings` | Settings | Profile, daily goal, theme, password, export, delete account. |
| `/share/guide/[id]` | Public guide | Read-only view of a guide shared by its owner. |

The `>_ console` sheet (`components/ask`) is mounted in `app/(app)/layout.tsx` but only attached by the reader. It is bound to one source; leaving the source drops the conversation.

## Data flow

1. **Add a source** (`useLibrary`): files go to Supabase storage under `<user id>/…`; `POST /api/documents` extracts text (Gemini for PDFs and images, Mammoth for Word, officeparser for slides, transcripts for YouTube, Cheerio for web pages) and stores it in `Document.textContent`.
2. **Index** (`POST /api/engine/analyze`, streamed progress): chunks `textContent` (~1000 characters, 200 overlap), embeds each chunk and writes `DocumentChunk` rows in one transaction that replaces the old ones. Chunk ids sort by position so text reads back in order.
3. **Console** (`POST /api/chat`): requires a document id, resolves it with ownership checks (`lib/scope.ts`), then lets the model call `searchSources` (cosine search over that source's chunks). Requests with no readable source are rejected. Answers cite `[•](cite:NAME)`; the client numbers them and lists the sources.
4. **Generate**: `/api/studio/generate` (flashcards, mind map, slides) and `/api/engine/generate-study-guide` build from the scoped text, validate the JSON shape, save it, and credit a metric.

## Schema

`User` owns `Workspace`s (the user's vault is the workspace titled "My Global Vault"; older "desk" workspaces still exist and their documents appear in Library), `Timetable`, `StudyGuide`, `StudyGoal`, `DailyMetric`, `AuditLog`, `UserPreferences`. A `Workspace` has `Message`s, `Document`s and `StudioAsset`s. A `Document` has `DocumentChunk`s (with `vector(768)`) and `StudyGuide`s. `StudyGuide.strategyData` is native JSON (`{ guideTitle, phases: [{ phaseId, title, microBites, flashcards }] }`).

`User.profile` (JSON) holds `courses`. Timetable classes are `{ id, courseCode, courseTitle, day, startTime, endTime, location }`, with times as `HH:MM` or `h:mm AM/PM` (`lib/utils/schedule.ts` reads both).

## Security model

- Auth: Supabase session cookies, refreshed in `proxy.ts` (`utils/supabase/middleware.ts`). Signed-out API calls get 401; signed-out page requests are redirected to `/login`. `/`, `/login`, `/signup`, `/auth/*` and `/share/*` are public.
- Authorisation is in application code on every route. The database also has row-level security enabled on every table, so the Supabase REST API with the public anon key returns nothing. Prisma's role bypasses RLS.
- Inputs: client-supplied file URLs must be this project's storage URLs; website imports reject private and loopback hosts and do not follow redirects.
- Abuse: per-user rate limits on chat, indexing, generation and ingestion (`lib/rate-limit.ts`).

## Not built

- Audio overviews / podcasts.
- Billing: `User.stripeCustomerId` and `planTier` exist but nothing uses them.
- Per-answer accuracy tracking, so Progress has no "retention" measure.
- A shared-store rate limiter (the current one is per server instance).
- Study goals (`StudyGoal` model is unused).
