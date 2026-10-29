<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# CogniBase working rules

- **Navigation is four tabs**: Home (`/dashboard`), Library (`/vault`), Study (`/study-guides`), Progress (`/analytics`). Settings is under the avatar; Schedule is reached from Library. There is no global AI: the `>_ console` (`components/ask`) lives inside a source, in the reader, and only ever answers about that one source.
- **Design tokens** live in `app/globals.css` (`--bg-*`, `--text-*`, `--accent-*`, `--danger`). Use them; do not hard-code hex colours or inline `style={{}}` for theme values. Touch targets are at least 44px. Floating UI (sheets, dialogs, menus) uses `components/ui/Sheet.tsx`, which portals to `body`.
- **Every API route** starts with `requireUser()` and checks ownership of any id it receives (`lib/api-auth.ts`; `lib/scope.ts` for document scope). Never trust ids, user ids or URLs from the client.
- **Server-side fetches** of client-supplied URLs go through `isTrustedStorageUrl` / `isPublicWebUrl` / `readStoredFile`.
- **Raw SQL** uses Prisma's tagged `$queryRaw` with parameters. No string-built SQL.
- **AI**: model name is `gemini-3.5-flash`. Structured output uses `responseMimeType: "application/json"` and is validated before it is saved. Chat is `/api/chat`; generation is `/api/studio/generate` and `/api/engine/generate-study-guide`.
- **Errors**: routes return short human messages, never `error.message`. The client shows them with Sonner.
- **Schema changes** need a migration (`prisma/migrations`). Do not use `db push` against the real database.
- Check with `npm run typecheck` and `npm run lint` before finishing.
