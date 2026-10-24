# CogniBase

Add lecture notes, slides, PDFs, YouTube links and web pages. Ask questions that cite their sources, and turn any of it into study guides, flashcards, mind maps and slides.

Next.js 16 (App Router) · React 19 · Tailwind v4 · Prisma 7 + Postgres/pgvector · Supabase (auth + storage) · Gemini via the Vercel AI SDK.

## Run it

```bash
npm install
cp .env.example .env.local   # then fill it in (see below)
npm run db:deploy            # apply database migrations
npm run dev
```

### Environment

| Variable | Used for |
|---|---|
| `DATABASE_URL` | Pooled Postgres connection used by the app |
| `DIRECT_URL` | Direct connection used by Prisma migrations |
| `GEMINI_API_KEY` | Chat, generation, embeddings |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth and storage in the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Needed to delete an account's auth login |

### Database

Migrations live in `prisma/migrations`.

- **New database:** `npm run db:deploy` creates everything, including the `vector` extension.
- **Existing database that was built with `db push`:** mark the baseline as already applied, then deploy the rest:

  ```bash
  npm run db:baseline
  npm run db:deploy
  ```

  The second migration turns on row-level security for every table, replaces the vector index (the old one used L2 distance, but searches use cosine, so it was never used) and adds lookup indexes. It is idempotent.

### Storage

Uploads go to the `workspace-files` bucket under `<user id>/…`. The app reads them through the storage API where it can, so the bucket can be made **private**:

1. In Supabase, set the bucket to private.
2. Add policies so each user can only touch their own folder:

   ```sql
   create policy "own files: read"   on storage.objects for select to authenticated
     using (bucket_id = 'workspace-files' and (storage.foldername(name))[1] = auth.uid()::text);
   create policy "own files: write"  on storage.objects for insert to authenticated
     with check (bucket_id = 'workspace-files' and (storage.foldername(name))[1] = auth.uid()::text);
   create policy "own files: delete" on storage.objects for delete to authenticated
     using (bucket_id = 'workspace-files' and (storage.foldername(name))[1] = auth.uid()::text);
   ```

   Files uploaded before this change sit under `uploads/` and are not covered by those policies. Re-upload them or add a matching policy for that folder.

## How it fits together

- **Library** (`/vault`): add sources, see whether each is searchable, select the ones you want to ask about. Adding a source stores its text and indexes it (chunks + embeddings) for search.
- **Ask**: the bar above the tab bar, available on every screen. `/api/chat` answers from the selected sources (or everything you own when none are selected) and cites them. Flashcards, mind maps, slides and study guides are generated from the same selection.
- **Study** (`/study-guides`): guides with a quest log, a full-screen reader and flashcards, plus saved flashcards, mind maps and slides.
- **Home** (`/dashboard`) and **Progress** (`/analytics`): next class, what to resume, focus minutes and streak. Focus minutes are credited per action, not timed.
- **Schedule** (`/schedule`): courses and timetable, reached from Library.

Every API route calls `requireUser()` and checks ownership of whatever id it is given (`lib/api-auth.ts`, `lib/scope.ts`). Server-side file fetches only accept this project's storage URLs. AI routes are rate limited per user (`lib/rate-limit.ts`; per server instance, so it is a brake, not a hard quota).

## Commands

```bash
npm run dev         # develop
npm run build       # production build
npm run typecheck   # tsc --noEmit
npm run lint
npm run db:deploy   # apply migrations
```
