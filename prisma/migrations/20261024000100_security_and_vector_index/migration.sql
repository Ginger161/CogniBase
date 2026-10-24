-- Safe to run on an existing database: every statement is idempotent.

-- 1. Row-level security on every table.
--    The app reaches Postgres through Prisma, whose connection role bypasses RLS, so nothing changes for it.
--    Without this, tables in the public schema are readable through Supabase's REST API with the public anon key.
--    With RLS on and no policy, that API gets no rows. (Existing owner policies from scripts/rls-setup.ts are kept.)
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserPreferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Workspace" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentChunk" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Timetable" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudyGuide" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudyGuideProgress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudioAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudyGoal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DailyMetric" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExtractedFormCache" ENABLE ROW LEVEL SECURITY;

-- 2. Vector index that matches the queries.
--    Searches order by cosine distance (<=>). The old index used vector_l2_ops, so the planner could never use it.
DROP INDEX IF EXISTS "embeddingIndex";
CREATE INDEX IF NOT EXISTS "DocumentChunk_embedding_cosine_idx"
  ON "DocumentChunk" USING hnsw ("embedding" vector_cosine_ops);

-- 3. Lookup indexes (same names Prisma generates, so a fresh database from the baseline already has them).
CREATE INDEX IF NOT EXISTS "Workspace_userId_idx" ON "Workspace"("userId");
CREATE INDEX IF NOT EXISTS "Message_workspaceId_createdAt_idx" ON "Message"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "Document_workspaceId_idx" ON "Document"("workspaceId");
CREATE INDEX IF NOT EXISTS "DocumentChunk_documentId_idx" ON "DocumentChunk"("documentId");
CREATE INDEX IF NOT EXISTS "Timetable_userId_idx" ON "Timetable"("userId");
CREATE INDEX IF NOT EXISTS "StudyGuide_userId_idx" ON "StudyGuide"("userId");
CREATE INDEX IF NOT EXISTS "StudyGuide_sourceDocumentId_idx" ON "StudyGuide"("sourceDocumentId");
CREATE INDEX IF NOT EXISTS "StudioAsset_workspaceId_idx" ON "StudioAsset"("workspaceId");
CREATE INDEX IF NOT EXISTS "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
