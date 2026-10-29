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

## Study features

- **Reader** (`components/DocumentReader.tsx`): formatted text (`lib/reader/format.ts`), highlights (`Highlight`), reading progress (`ReadingProgress`, resumes where you left off and shows on the Library row), a selection toolbar (highlight, explain, quiz me, save as card), and citations in the console that scroll the reader to the passage (`lib/reader/dom.ts`).
- **Flashcards** are reviewed with spaced repetition (`lib/srs.ts`, `lib/review-queue.ts`, `CardState`). Cards with no row are new; a few are introduced per day. Home shows what is due.
- **Quizzes** are a Studio asset type (`QUIZ`). Finished runs are stored as `QuizAttempt` and feed today's accuracy and the "What is sticking" card on Progress.
- **Exams** (`Exam`, Schedule > Exams): the day-by-day plan is worked out on the client from the exam date and reading progress (`lib/study-plan.ts`), so it is free and uses the student's own time zone.
- **Audio overviews**: see below.
- **Offline**: `app/manifest.ts` and `public/sw.js` make the app installable and remember opened sources and the app's scripts. Audio can be saved on the device (`lib/offline.ts`). Everything is cleared on sign-out.

## Audio overviews

Two stages, so each request fits its time limit and a failed voicing can be retried alone:

1. `POST /api/audio` writes a two-host script (`lib/audio/script.ts`). The format (walkthrough, quiz battle, story, myth-busting, exam coach, rapid-fire) comes from the student's goal and rotates so episodes differ (`lib/audio/formats.ts`). Length is held to 5, 10 or 15 minutes, within 20 percent, with one automatic repair pass; no episode is under 4 or over 20 minutes. Long sources become a series (`lib/audio/parts.ts`). Scripts carry recall pauses and chapters.
2. `POST /api/audio/synthesize` voices it through the provider in `lib/audio/tts.ts` (ElevenLabs), stores the MP3 under `<user id>/audio/`, and records when each turn starts so the player can pause for recall questions and jump by chapter.

Limits live in `lib/plans.ts` (per plan) and `lib/audio/limits.ts` (stored episodes, episodes per month, voiced minutes, and an app-wide monthly voice budget set by `AUDIO_MONTHLY_CHARS`). With no ElevenLabs key, or when a limit is reached, the transcript is still saved and the message says why.

## Plans, credits and billing

- `lib/plans.ts` holds each plan's price and monthly allowances and what one credit buys. `lib/usage.ts` checks an action before the work and records it after it succeeds: the plan's allowance is used first, then credits. A paused account or a switched-off feature is refused there too.
- Credits are a ledger (`CreditLedger`); the balance is the sum. Payments go through Paystack (`lib/billing.ts`, `/api/billing/*`). The webhook and the return page both call the same idempotent `fulfil`, and the amount paid must match the server's price. Every real payment is also kept in `Payment` for finance.
- Students can redeem invite codes (`/api/invites/redeem`).

## Admin (`/admin`)

- Lives in its own route group, `app/(admin)/admin`, with its own layout. The layout and every page call `requireStaffPage` (`lib/admin.ts`): a student is redirected to `/dashboard`, a team member only sees the sections they were given, and a section they were not given sends them back to their own admin home. Every admin API route calls `requireStaff(permission)` and answers a plain 404 to anyone else.
- Owners are the emails in `ADMIN_EMAILS`. They manage the team (`StaffMember`, per-person permissions from `lib/staff.ts`). Moderators are rows, so removing a row removes their access.
- Sections: overview (revenue, estimated cost, break-even, voice budget), users, payments, funds and runway (`Expense`), invite codes (`Invite`), kill switches (`AppSetting`, read by `lib/settings.ts` and enforced in `checkUsage`), and an activity log of every admin action.
- Privacy: the admin area shows account facts and totals only. No route returns chats, notes or study material.

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
