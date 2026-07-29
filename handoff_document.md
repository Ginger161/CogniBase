# CogniBase - AI Handoff Document

This document is generated to provide Claude (or any AI assistant) with complete context of the CogniBase project to continue development.

## 1. Project Overview
CogniBase is an AI-powered student workspace. Its core features include:
- **Vault & Data Ingestion**: Centralized command center for user data, including document upload, extraction, and a chat console.
- **Transformation Engine**: Converts raw documents into gamified Study Guides (micro-bites, 3D flashcards, mindmaps, PPTs).
- **Zen Reader**: Hybrid reading architecture for Word, TXT, and PDF files.
- **Analytics Dashboard**: Deep work metrics, task completion rings, and streak tracking.

## 2. Tech Stack
- **Frontend**: Next.js 16.2.9 (App Router), React 19.2.4, TailwindCSS v4, Framer Motion
- **Backend/Database**: PostgreSQL with pgvector, Prisma ORM (@prisma/adapter-pg)
- **Auth/Storage**: Supabase
- **AI**: Google Generative AI SDK (gemini-3.5-flash)
- **Parsers**: officeparser, mammoth, pdf2json, pdf2md, youtube-transcript
- **Package Manager**: npm

## 3. Architecture Summary
The platform is designed around a gamified, Edge-ready architecture.
- `app/`: Contains all Next.js App Router routes. App features are grouped under `app/(app)`. API routes are in `app/api`.
- `components/`: Reusable React components (UI elements, interactive widgets, StudyEngine, dashboards).
- `lib/`: Utility functions, database clients, Supabase helpers, and AI logic (model routing).
- `prisma/`: Database schema and migrations.
- `utils/`: Shared helper functions.
- `scripts/`: Maintenance, migration, and testing scripts.

## 4. Environment / Configuration
Keys expected in `.env`:
- `DATABASE_URL`
- `DIRECT_URL`
- `GEMINI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NX_DAEMON`
- `TURBO_CACHE`
- `TURBO_DOWNLOAD_LOCAL_ENABLED`
- `TURBO_REMOTE_ONLY`
- `TURBO_RUN_SUMMARY`
- `VERCEL`
- `VERCEL_ENV`
- `VERCEL_GIT_COMMIT_AUTHOR_LOGIN`
- `VERCEL_GIT_COMMIT_AUTHOR_NAME`
- `VERCEL_GIT_COMMIT_MESSAGE`
- `VERCEL_GIT_COMMIT_REF`
- `VERCEL_GIT_COMMIT_SHA`
- `VERCEL_GIT_PREVIOUS_SHA`
- `VERCEL_GIT_PROVIDER`
- `VERCEL_GIT_PULL_REQUEST_ID`
- `VERCEL_GIT_REPO_ID`
- `VERCEL_GIT_REPO_OWNER`
- `VERCEL_GIT_REPO_SLUG`
- `VERCEL_OIDC_TOKEN`
- `VERCEL_TARGET_ENV`
- `VERCEL_URL`


## 5. Database Schema
```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
  engineType      = "library"
}

datasource db {
  provider   = "postgresql"
  extensions = [vector]
}

model Workspace {
  id           String        @id @default(cuid())
  title        String
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  messages     Message[]
  documents    Document[]
  userId       String?
  user         User?         @relation(fields: [userId], references: [id], onDelete: Cascade)
  studioAssets StudioAsset[]
}

model Message {
  id          String    @id @default(cuid())
  role        String
  text        String
  createdAt   DateTime  @default(now())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
}

model Document {
  id          String          @id @default(cuid())
  name        String // The original file name (e.g., 'ForexCoachings.docx')
  url         String // The Supabase public storage URL or YouTube URL
  sourceType  String          @default("file") // e.g., "file" or "youtube"
  textContent String? // Raw text content
  fileSize    Int? // Size in bytes
  createdAt   DateTime        @default(now())
  workspaceId String
  workspace   Workspace       @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  chunks      DocumentChunk[]
  studyGuides StudyGuide[]
}

model DocumentChunk {
  id         String                      @id @default(cuid())
  documentId String
  content    String
  embedding  Unsupported("vector(768)")?
  pageNumber Int?
  document   Document                    @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([embedding], map: "embeddingIndex")
}

model User {
  id               String        @id @default(cuid()) // Will store Supabase Auth UUID
  email            String        @unique
  username         String?
  school           String?
  department       String?
  stripeCustomerId String?       @unique
  planTier         String        @default("FREE")
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  workspaces       Workspace[]
  timetables       Timetable[]
  studyGuides      StudyGuide[]
  studyGoals       StudyGoal[]
  dailyMetrics     DailyMetric[]
  auditLogs        AuditLog[]
  studyGuideProgress StudyGuideProgress[]
  preferences      UserPreferences?
}

model Timetable {
  id     String @id @default(cuid())
  userId String
  data   Json // Store the timetable object here
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model StudyGuide {
  id                 String   @id @default(cuid())
  userId             String
  sourceDocumentId   String
  sourceDocumentName String?
  sectionConstraint  String?
  markdownContent    String?
  title              String?
  strategyData       Json?
  createdAt          DateTime @default(now())
  user               User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  document           Document @relation(fields: [sourceDocumentId], references: [id], onDelete: Cascade)
  progress           StudyGuideProgress[]
}

model ExtractedFormCache {
  hash      String   @id
  courses   Json
  createdAt DateTime @default(now())
}

model StudioAsset {
  id          String    @id @default(uuid())
  workspaceId String
  title       String
  type        String // 'FLASHCARD', 'MINDMAP', 'PRESENTATION', 'AUDIO'
  content     Json
  createdAt   DateTime  @default(now())
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
}

model StudyGoal {
  id          String   @id @default(cuid())
  title       String // e.g., "Master EDM 205"
  targetDate  DateTime
  targetHours Int // Goal for focus hours
  createdAt   DateTime @default(now())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model DailyMetric {
  id              String   @id @default(cuid())
  date            DateTime @default(now()) // Stored as midnight for easy querying
  focusMinutes    Int      @default(0)
  tasksCompleted  Int      @default(0)
  averageAccuracy Float    @default(0.0) // From knowledge checks
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([date, userId]) // One record per user per day
}

model AuditLog {
  id        String   @id @default(cuid())
  action    String
  userId    String
  details   String   @db.Text
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model StudyGuideProgress {
  id          String   @id @default(cuid())
  userId      String
  guideId     String
  phaseId     String
  completed   Boolean  @default(true)
  createdAt   DateTime @default(now())
  
  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  guide       StudyGuide @relation(fields: [guideId], references: [id], onDelete: Cascade)

  @@unique([userId, guideId, phaseId])
}

model UserPreferences {
  id              String   @id @default(cuid())
  userId          String   @unique
  theme           String   @default("system")
  sidebarMode     String   @default("expanded")
  dailyFocusGoal  Int      @default(120)
  guideComplexity String   @default("standard")

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}


```

## 6. Known Issues (TODOs, FIXMEs, and Warnings)
- **app\(app)\dashboard\page.tsx** (Line 51): `console.error("Failed to delete workspace on the server.");`
- **app\(app)\dashboard\page.tsx** (Line 55): `console.error(e);`
- **app\(app)\dashboard\page.tsx** (Line 91): `console.error);`
- **app\(app)\dashboard\page.tsx** (Line 112): `console.error(e);`
- **app\(app)\dashboard\page.tsx** (Line 147): `console.warn("Caught Backend Error:", err.message);`
- **app\(app)\dashboard\page.tsx** (Line 223): `console.error("Failed to create workspace", e);`
- **app\(app)\dashboard\page.tsx** (Line 246): `console.error("Upload error:", error.message);`
- **app\(app)\dashboard\page.tsx** (Line 311): `console.warn("Analysis failed gracefully", errData);`
- **app\(app)\dashboard\page.tsx** (Line 314): `console.error("Analysis request failed", analyzeError);`
- **app\(app)\dashboard\page.tsx** (Line 325): `console.error("Failed to save to database:", e);`
- **app\(app)\dashboard\page.tsx** (Line 361): `console.error(e)`
- **app\(app)\dashboard\page.tsx** (Line 397): `console.error("Failed to fetch messages:", e);`
- **app\(app)\settings\page.tsx** (Line 100): `console.error("Failed to fetch logs", err);`
- **app\(app)\study-guides\page.tsx** (Line 40): `console.error("Delete failed", error);`
- **app\(app)\study-guides\page.tsx** (Line 54): `console.error(e) }`
- **app\(app)\vault\page.tsx** (Line 157): `console.error("Error fetching timetables", err);`
- **app\(app)\vault\page.tsx** (Line 174): `console.error("Failed to fetch documents:", e) }`
- **app\(app)\vault\page.tsx** (Line 184): `console.error("Error fetching chats:", error);`
- **app\(app)\vault\page.tsx** (Line 193): `console.error(e) }`
- **app\(app)\vault\page.tsx** (Line 257): `console.error(err); }`
- **app\(app)\vault\page.tsx** (Line 274): `console.error(err); }`
- **app\(app)\vault\page.tsx** (Line 304): `console.error(err); }`
- **app\(app)\vault\page.tsx** (Line 373): `console.error(err);`
- **app\(app)\vault\page.tsx** (Line 446): `console.error('Full API Error Response:', data);`
- **app\(app)\vault\page.tsx** (Line 478): `console.error("Supabase Upload Error:", err);`
- **app\(app)\vault\page.tsx** (Line 541): `console.error(err);`
- **app\(app)\vault\page.tsx** (Line 571): `console.error(err);`
- **app\(app)\vault\page.tsx** (Line 617): `console.error(err);`
- **app\(app)\vault\page.tsx** (Line 642): `console.error(err);`
- **app\(app)\vault\page.tsx** (Line 658): `console.error(err);`
- **app\(app)\vault\page.tsx** (Line 682): `console.error(err);`
- **app\(app)\vault\page.tsx** (Line 742): `console.error(err);`
- **app\(app)\vault\page.tsx** (Line 778): `console.error("Failed to sync deletion with database:", err);`
- **app\(app)\vault\page.tsx** (Line 794): `console.error("Failed to sync deletion with database:", err);`
- **app\(app)\vault\page.tsx** (Line 841): `console.error("Supabase Upload Error:", error);`
- **app\(app)\vault\page.tsx** (Line 869): `console.error(`❌ Database Save Failed (Status: ${dbResponse.status})`);`
- **app\(app)\vault\page.tsx** (Line 901): `console.error("❌ Network Error during Database Save:", error);`
- **app\(app)\vault\page.tsx** (Line 1027): `console.error("Failed to load chat", error);`
- **app\(app)\vault\page.tsx** (Line 1165): `console.error("Async title generation failed", e));`
- **app\(app)\vault\page.tsx** (Line 1225): `console.error(err);`
- **app\(app)\vault\page.tsx** (Line 1264): `console.error("Failed to save feedback", e); }`
- **app\api\audit-logs\route.ts** (Line 22): `console.error("API Crash Error:", error);`
- **app\api\chat\route.ts** (Line 74): `console.error("Failed to save user message:", e);`
- **app\api\chat\route.ts** (Line 143): `console.error("Vector search error in tool", e);`
- **app\api\chat\route.ts** (Line 160): `console.error("Failed to save assistant message:", e);`
- **app\api\chat\route.ts** (Line 169): `console.error("Query Error:", error);`
- **app\api\documents\route.ts** (Line 64): `console.error("YouTube transcript extraction failed:", err);`
- **app\api\documents\route.ts** (Line 76): `console.error("Website extraction failed", err);`
- **app\api\documents\route.ts** (Line 98): `console.error("Gemini PDF extraction failed, falling back to plain text:", err);`
- **app\api\documents\route.ts** (Line 118): `console.error("Mammoth failed, falling back to officeparser", err);`
- **app\api\documents\route.ts** (Line 152): `console.error("Gemini Vision Error:", err);`
- **app\api\documents\route.ts** (Line 179): `console.error("Failed to update gamification metric:", metricErr);`
- **app\api\documents\route.ts** (Line 184): `console.error("API Crash Error:", error);`
- **app\api\documents\route.ts** (Line 209): `console.error("API Crash Error:", error);`
- **app\api\documents\route.ts** (Line 246): `console.error("Supabase storage deletion failed:", storageError);`
- **app\api\documents\route.ts** (Line 259): `console.error("API Crash Error:", error);`
- **app\api\documents\study-guide\route.ts** (Line 55): `console.error("Generate Study Guide Error:", error);`
- **app\api\documents\study-guide\route.ts** (Line 79): `console.error("Update Study Guide Error:", error);`
- **app\api\engine\analyze\route.ts** (Line 102): `console.error("Gemini Vision Error:", err);`
- **app\api\engine\analyze\route.ts** (Line 147): `console.error(`Failed to process embedding batch starting at ${i}:`, e);`
- **app\api\engine\analyze\route.ts** (Line 169): `console.error("Bulk insert failed:", e);`
- **app\api\engine\analyze\route.ts** (Line 192): `console.error("Failed to generate workspace title:", titleErr);`
- **app\api\engine\analyze\route.ts** (Line 199): `console.error("Engine Error:", error);`
- **app\api\engine\extract-courses\route.ts** (Line 39): `console.error("Cache read error:", e);`
- **app\api\engine\extract-courses\route.ts** (Line 73): `console.error(`Gemini Attempt ${attempt} failed: ${errMsg}`);`
- **app\api\engine\extract-courses\route.ts** (Line 102): `console.error("Cache write error:", e);`
- **app\api\engine\extract-courses\route.ts** (Line 108): `console.error('Extraction Error:', error);`
- **app\api\engine\extract-timetable\route.ts** (Line 41): `console.error("Office parser error:", err);`
- **app\api\engine\extract-timetable\route.ts** (Line 75): `console.error("JSON Parsing failed", text);`
- **app\api\engine\extract-timetable\route.ts** (Line 80): `console.error("Course extraction error:", error);`
- **app\api\engine\generate-flashcards\route.ts** (Line 31): `console.error(`Failed to fetch file. Status: ${fileRes.status} ${fileRes.statusText}`);`
- **app\api\engine\generate-flashcards\route.ts** (Line 58): `console.error("Parser error:", err);`
- **app\api\engine\generate-flashcards\route.ts** (Line 96): `console.error("Flashcard Gen Error:", aiError);`
- **app\api\engine\generate-flashcards\route.ts** (Line 113): `console.error("Failed to parse flashcards JSON:", out);`
- **app\api\engine\generate-flashcards\route.ts** (Line 117): `console.error("Flashcard Gen Route Error:", error);`
- **app\api\engine\generate-ppt\route.ts** (Line 42): `console.error("PPT Gen Error:", aiError);`
- **app\api\engine\generate-ppt\route.ts** (Line 53): `console.error("JSON Parse failed on raw AI output:", e);`
- **app\api\engine\generate-ppt\route.ts** (Line 65): `console.error("PPT Route Error:", error);`
- **app\api\engine\generate-study-guide\route.ts** (Line 30): `console.error(`Failed to fetch file. Status: ${fileRes.status} ${fileRes.statusText}`);`
- **app\api\engine\generate-study-guide\route.ts** (Line 59): `console.error("Parser error:", err);`
- **app\api\engine\generate-study-guide\route.ts** (Line 109): `console.error("Study Guide Gen Error:", aiError);`
- **app\api\engine\generate-study-guide\route.ts** (Line 120): `console.error("JSON Parse failed on raw AI output:", e);`
- **app\api\engine\generate-study-guide\route.ts** (Line 128): `console.error("Cleaned JSON Parse failed:", cleanError);`
- **app\api\engine\generate-study-guide\route.ts** (Line 141): `console.error("Failed to update gamification metric:", metricErr);`
- **app\api\engine\generate-study-guide\route.ts** (Line 147): `console.error("Study Guide Route Error:", error);`
- **app\api\engine\query\route.ts** (Line 57): `console.error("Failed to save user message:", e);`
- **app\api\engine\query\route.ts** (Line 133): `console.error("Vector search error:", err);`
- **app\api\engine\query\route.ts** (Line 189): `console.error("Failed to save assistant message:", e);`
- **app\api\engine\query\route.ts** (Line 198): `console.error("Query Error:", error);`
- **app\api\engine\title\route.ts** (Line 31): `console.error("Title Generation Error:", error);`
- **app\api\metrics\route.ts** (Line 42): `console.warn("Database error in metrics GET, returning empty metrics:", e);`
- **app\api\metrics\route.ts** (Line 88): `console.error("Metrics GET Error:", error);`
- **app\api\metrics\route.ts** (Line 168): `console.error("Metrics POST Error:", error);`
- **app\api\settings\route.ts** (Line 30): `console.warn("Database error in settings GET, falling back:", e);`
- **app\api\settings\route.ts** (Line 46): `console.error("Settings GET Error:", error);`
- **app\api\settings\route.ts** (Line 103): `console.error("Settings POST Error:", error);`
- **app\api\studio\assets\route.ts** (Line 24): `console.error("Fetch Studio Assets Error:", error);`
- **app\api\studio\flashcards\route.ts** (Line 58): `console.error("Failed to parse Gemini response as JSON:", responseText);`
- **app\api\studio\flashcards\route.ts** (Line 65): `console.error("Flashcards Generation Error:", error);`
- **app\api\studio\mindmap\route.ts** (Line 58): `console.error("Failed to parse Gemini response as JSON:", responseText);`
- **app\api\studio\mindmap\route.ts** (Line 65): `console.error("Mindmap Generation Error:", error);`
- **app\api\studio\presentation\route.ts** (Line 58): `console.error("Failed to parse Gemini response as JSON:", responseText);`
- **app\api\studio\presentation\route.ts** (Line 65): `console.error("Presentation Generation Error:", error);`
- **app\api\studio\save-asset\route.ts** (Line 25): `console.error("Save Guide Error:", error);`
- **app\api\study-guides\progress\route.ts** (Line 32): `console.error("GET Progress Error:", error);`
- **app\api\study-guides\progress\route.ts** (Line 73): `console.error("POST Progress Error:", error);`
- **app\api\study-guides\route.ts** (Line 24): `console.error("API Crash Error:", error);`
- **app\api\study-guides\route.ts** (Line 56): `console.error("API Crash Error:", error);`
- **app\api\study-guides\[id]\route.ts** (Line 31): `console.error("API Crash Error on Delete:", error);`
- **app\api\users\route.ts** (Line 45): `console.error("API Crash Error:", error);`
- **app\api\workspaces\route.ts** (Line 31): `console.error("API Crash Error:", error);`
- **app\api\workspaces\route.ts** (Line 55): `console.error("Failed to upsert user with email, trying fallback:", upsertError);`
- **app\api\workspaces\route.ts** (Line 65): `console.error("Critical failure upserting user:", fallbackError);`
- **app\api\workspaces\route.ts** (Line 81): `console.error("API Crash Error:", error);`
- **app\api\workspaces\[id]\messages\route.ts** (Line 20): `console.error("API Crash Error:", error);`
- **app\api\workspaces\[id]\rename\route.ts** (Line 38): `console.error("API Crash Error:", error);`
- **app\api\workspaces\[id]\route.ts** (Line 50): `console.error("API Crash Error:", error);`
- **app\api\workspaces\[id]\youtube\route.ts** (Line 22): `console.warn("Failed to fetch YouTube title:", e);`
- **app\api\workspaces\[id]\youtube\route.ts** (Line 51): `console.error("YouTube Transcriber Error:", error);`
- **app\error.tsx** (Line 14): `console.error("Global Error Boundary caught an error:", error);`
- **components\CommandCenterUI.tsx** (Line 120): `console.error("YouTube extract error:", error);`
- **components\CommandCenterUI.tsx** (Line 364): `console.error);`
- **components\CommandCenterUI.tsx** (Line 377): `console.error);`
- **components\DocumentReader.tsx** (Line 24): `console.error);`
- **components\FlashcardViewer.tsx** (Line 59): `console.error(e);`
- **components\MermaidViewer.tsx** (Line 70): `console.error(e);`
- **components\MermaidViewer.tsx** (Line 82): `console.error("Mermaid rendering error:", error);`
- **components\PresentationViewer.tsx** (Line 54): `console.error(e);`
- **components\PresentationViewer.tsx** (Line 94): `console.error("PPTX Generation Error:", error);`
- **components\StudioAssetsPanel.tsx** (Line 44): `console.error(e);`
- **components\StudioAssetsPanel.tsx** (Line 88): `console.error);`
- **components\StudioAssetsPanel.tsx** (Line 90): `console.error(err);`
- **components\StudyAnalyticsDashboard.tsx** (Line 87): `console.error("Failed to fetch metrics", err);`
- **components\StudyEngine.tsx** (Line 41): `console.error("Invalid guideData", e);`
- **components\StudyEngine.tsx** (Line 53): `console.error("Failed to fetch progress", err));`
- **components\StudyEngine.tsx** (Line 64): `console.error(err));`
- **components\StudyEngine.tsx** (Line 70): `console.error(err));`
- **components\StudyGuideInteractive.tsx** (Line 50): `console.error("Failed to fetch progress", err);`
- **components\StudyGuideInteractive.tsx** (Line 77): `console.error("Gamification error", err));`
- **components\StudyGuideInteractive.tsx** (Line 136): `console.error(e);`
- **lib\auth-sync.ts** (Line 15): `console.error("Error in ensurePrismaUser:", error);`
- **scripts\migrate-data.ts** (Line 31): `console.error("Could not find service-account.json file at", serviceAccountPath);`
- **scripts\migrate-data.ts** (Line 36): `console.error("Firebase Admin Initialization Error. Please ensure you provide a valid FIREBASE_SERVICE_ACCOUNT environment variable.");`
- **scripts\migrate-data.ts** (Line 69): `console.warn(`⚠️ Skipping user ${user.id} due to duplicate email: ${user.email}`);`
- **scripts\migrate-data.ts** (Line 155): `console.error("❌ Migration Failed:", error);`
- **scripts\purge-firebase.ts** (Line 57): `console.error(e) }\n      }\n    };\n    fetchGuides();``
- **scripts\rls-setup.ts** (Line 77): `console.error("❌ SQL Error:", err);`
- **scripts\schema-create.ts** (Line 89): `console.error("SQL Error:", err);`
- **scripts\schema-index.ts** (Line 32): `console.error("❌ SQL Error:", err);`
- **scripts\schema-vector.ts** (Line 67): `console.error("❌ SQL Error:", err);`
- **scripts\sql-push.ts** (Line 31): `console.error(e.message);`
- **scripts\sql-push.ts** (Line 38): `console.error(e.message);`
- **scripts\sql-push.ts** (Line 45): `console.error(e.message);`
- **scripts\sql-push.ts** (Line 50): `console.error("SQL Error:", err);`
- **scripts\test-upload.ts** (Line 52): `console.error("❌ Test Failed:", error);`


## 7. Status
Based on the architecture and codebase inspection:
- **Fully Working**: Database models, Prisma client, Next.js foundation, Supabase auth integration.
- **Partially Built/Stubbed**: Document ingestion, Study Engine components, and AI generations (mostly structured but some endpoints might just be scaffolded).
- **Not Started**: Advanced Studio Assets (Audio podcasts, PPT export) might be only partially scaffolded. 

## 8. File Tree
```
.
├── .cursor
│   └── rules
│       ├── anti-hallucination.mdc
│       ├── cognibase-core.mdc
│       ├── error-handling.mdc
│       └── vecel-compliance.mdc
├── .gitignore
├── AGENTS.md
├── app
│   ├── (app)
│   │   ├── analytics
│   │   │   └── page.tsx
│   │   ├── dashboard
│   │   │   └── page.tsx
│   │   ├── layout.tsx
│   │   ├── lecture-materials
│   │   │   └── [id]
│   │   │       └── page.tsx
│   │   ├── settings
│   │   │   └── page.tsx
│   │   ├── studio-assets
│   │   │   └── page.tsx
│   │   ├── study-guides
│   │   │   └── page.tsx
│   │   └── vault
│   │       └── page.tsx
│   ├── (auth)
│   │   ├── login
│   │   │   └── page.tsx
│   │   └── signup
│   │       └── page.tsx
│   ├── api
│   │   ├── audit-logs
│   │   │   └── route.ts
│   │   ├── chat
│   │   │   └── route.ts
│   │   ├── documents
│   │   │   ├── route.ts
│   │   │   └── study-guide
│   │   │       └── route.ts
│   │   ├── engine
│   │   │   ├── analyze
│   │   │   │   └── route.ts
│   │   │   ├── extract-courses
│   │   │   │   └── route.ts
│   │   │   ├── extract-timetable
│   │   │   │   └── route.ts
│   │   │   ├── generate-flashcards
│   │   │   │   └── route.ts
│   │   │   ├── generate-ppt
│   │   │   │   └── route.ts
│   │   │   ├── generate-study-guide
│   │   │   │   └── route.ts
│   │   │   ├── query
│   │   │   │   └── route.ts
│   │   │   └── title
│   │   │       └── route.ts
│   │   ├── metrics
│   │   │   └── route.ts
│   │   ├── settings
│   │   │   └── route.ts
│   │   ├── studio
│   │   │   ├── assets
│   │   │   │   └── route.ts
│   │   │   ├── flashcards
│   │   │   │   └── route.ts
│   │   │   ├── mindmap
│   │   │   │   └── route.ts
│   │   │   ├── presentation
│   │   │   │   └── route.ts
│   │   │   └── save-asset
│   │   │       └── route.ts
│   │   ├── study-guides
│   │   │   ├── progress
│   │   │   │   └── route.ts
│   │   │   ├── route.ts
│   │   │   └── [id]
│   │   │       └── route.ts
│   │   ├── users
│   │   │   └── route.ts
│   │   └── workspaces
│   │       ├── route.ts
│   │       └── [id]
│   │           ├── messages
│   │           │   └── route.ts
│   │           ├── rename
│   │           │   └── route.ts
│   │           ├── route.ts
│   │           └── youtube
│   │               └── route.ts
│   ├── auth
│   │   └── callback
│   │       └── route.ts
│   ├── error.tsx
│   ├── globals.css
│   ├── hooks
│   │   └── useThrottle.ts
│   ├── layout.tsx
│   └── page.tsx
├── apply_component_import.js
├── apply_desktop_fixes.js
├── apply_final_layout.js
├── apply_mobile_fixes.js
├── apply_mobile_fixes_2.js
├── apply_multi_source.js
├── apply_props_update.js
├── apply_props_update_title.js
├── apply_tailwind_layout.js
├── CLAUDE.md
├── cognibase-architecture.md
├── components
│   ├── AnalyticsCharts.tsx
│   ├── AnalyticsRings.tsx
│   ├── CommandCenterUI.tsx
│   ├── DocumentReader.tsx
│   ├── FlashcardViewer.tsx
│   ├── MermaidViewer.tsx
│   ├── PresentationViewer.tsx
│   ├── PullToRefresh.tsx
│   ├── Sidebar.tsx
│   ├── StudioAssetsPanel.tsx
│   ├── StudyAnalyticsDashboard.tsx
│   ├── StudyEngine.tsx
│   ├── StudyGuideInteractive.tsx
│   ├── ThemeProvider.tsx
│   └── ui
│       └── CustomSelect.tsx
├── eslint.config.mjs
├── fix-ws.js
├── fix_css.js
├── generate_handoff.js
├── lib
│   ├── ai
│   │   └── model-router.ts
│   ├── auth-sync.ts
│   ├── firebase.ts
│   ├── hooks
│   │   ├── usePullToRefresh.ts
│   │   └── useUserContext.tsx
│   ├── prisma.ts
│   └── utils
│       ├── time.ts
│       └── timetable.ts
├── list_models.ts
├── middleware.ts
├── next-env.d.ts
├── next.config.ts
├── package.json
├── patch_layouts.js
├── postcss.config.mjs
├── prisma
│   └── schema.prisma
├── prisma.config.ts
├── push.sql
├── README.md
├── scratch_test.ts
├── scripts
│   ├── check.ts
│   ├── list-models.ts
│   ├── migrate-data.ts
│   ├── purge-firebase.ts
│   ├── rls-setup.ts
│   ├── schema-create.ts
│   ├── schema-index.ts
│   ├── schema-vector.ts
│   ├── sql-push.ts
│   └── test-upload.ts
├── tailwind.config.ts
├── test-usechat.js
├── test_gemini.ts
├── tsconfig.json
└── utils
    └── supabase
        ├── client.ts
        ├── middleware.ts
        └── server.ts

```

## 9. Full Source Code
The following is the complete contents of all source files (excluding dependencies, lockfiles, and build artifacts).


### `app\(app)\analytics\page.tsx`
```tsx
'use client';

import React from 'react';
import StudyAnalyticsDashboard from '@/components/StudyAnalyticsDashboard';

export default function AnalyticsPage() {
  return (
    <div className="h-full w-full bg-[#09090B] overflow-y-auto">
      <StudyAnalyticsDashboard />
    </div>
  );
}

```

### `app\(app)\dashboard\page.tsx`
```tsx
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '@ai-sdk/react';

import { supabase } from '../../../utils/supabase/client';
import { Pencil, RefreshCcw, ThumbsUp, ThumbsDown, MoreVertical } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

import { useUserContext } from '../../../lib/hooks/useUserContext';
import CommandCenterUI from '../../../components/CommandCenterUI';
import PullToRefresh from '../../../components/PullToRefresh';
import { toast } from 'sonner';

export default function DashboardPage() {
  const pathname = usePathname();
  const router = useRouter();
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [activeSources, setActiveSources] = useState<Array<{ id: string, title: string, type: string, content: string }>>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [activeWorkspaceName, setActiveWorkspaceName] = useState<string | null>("Untitled Workspace");
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false);
  const [sourceModalView, setSourceModalView] = useState<'options' | 'website' | 'youtube' | 'text'>('options');
  const [sourceInputText, setSourceInputText] = useState("");
  const [isExtractingMock, setIsExtractingMock] = useState(false);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [isLoadingVault, setIsLoadingVault] = useState(true);
  

  // Workspace Desk Management State
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<string | null>(null);
  const [editingDeskId, setEditingDeskId] = useState<string | null>(null);
  const [editingDeskTitle, setEditingDeskTitle] = useState("");

  const handleDeleteWorkspace = async () => {
    if (!workspaceToDelete) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceToDelete}`, { method: 'DELETE' });
      if (res.ok) {
        setWorkspaces(prev => prev.filter(w => w.id !== workspaceToDelete));
        setWorkspaceToDelete(null);
        if (activeWorkspaceId === workspaceToDelete) {
          setActiveWorkspaceId(null);
          setActiveSources([]);
          setMessages([{ id: '1', role: 'assistant', content: 'Acknowledged. I am >_console. Ask me anything about your uploaded materials.' } as any]);
        }
      } else {
        console.error("Failed to delete workspace on the server.");
        alert("Failed to delete workspace. Please try again.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleShareWorkspace = (ws: any) => {
    navigator.clipboard.writeText(`https://cognibase.app/share/${ws.id}`);
    alert("Share link copied to clipboard!");
    setActiveDropdownId(null);
  };

  const handleYouTubeSubmit = async (url: string) => {
    if (!activeWorkspaceId) {
      throw new Error("Please select or create a desk first.");
    }
    
    const res = await fetch(`/api/workspaces/${activeWorkspaceId}/youtube`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to extract YouTube transcript");
    }
    
    const newDoc = await res.json();
    
    // Update local state
    setActiveSources(prev => [...prev, { id: newDoc.id, title: newDoc.name, type: 'youtube', content: '' }]);
    
    // Optionally trigger backend analysis asynchronously 
    fetch('/api/engine/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: newDoc.id })
    }).catch(console.error);

    // We don't have to await fetchWorkspaces since state is already updated, but we can do it to sync
    if (typeof fetchWorkspaces === 'function') {
      fetchWorkspaces();
    }
  };

  const submitDeskRename = async (id: string) => {
    if (!editingDeskTitle.trim()) return;
    try {
      const res = await fetch(`/api/workspaces/${id}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manualTitle: editingDeskTitle })
      });
      if (res.ok) {
        setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, title: editingDeskTitle } : w));
        setEditingDeskId(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRetryMessage = () => {
    const lastUserMsg = messages.filter(m => m.role === 'user').pop();
    if (lastUserMsg) {
      const msgText = lastUserMsg.parts ? lastUserMsg.parts.filter(p => p.type === 'text').map(p => (p as any).text).join('\n') : (lastUserMsg as any).text || (lastUserMsg as any).content || '';
      sendMessage({ role: 'user', parts: [{ type: 'text', text: msgText }] } as any, {
        body: {
          activeSources,
          workspaceId: activeWorkspaceId,
          userProfile: {
            name: userData.name,
            school: userData.school,
            department: userData.department,
            courses: userData.profile?.semesters?.find((s: any) => s.isActive)?.courses || []
          }
        }
      });
    }
  };


  const { context, isLoading: isContextLoading } = useUserContext();
  const userData = context || { name: 'Guest Student', email: 'Not signed in', uid: '', profile: null };

  // Console state
  const [input, setInput] = useState('');

  const { messages, setMessages, sendMessage, status, error } = useChat({
    id: activeWorkspaceId || 'default',
    api: '/api/engine/query',
    initialMessages: [{ id: '1', role: 'assistant', parts: [{ type: 'text', text: 'Acknowledged. I am >_console. Ask me anything about your uploaded materials.' }] } as any],
    onError: (err: Error) => {
      console.warn("Caught Backend Error:", err.message);
      if (err.message.includes('503') || err.message.includes('demand')) {
        toast.error("High traffic detected. The AI servers are currently busy. Please try again in a few moments.");
      } else {
        toast.error(err.message || "An error occurred while communicating with the AI.");
      }
    }
  } as any);
  const isLoading = status === 'streaming' || status === 'submitted';

  const [thinkingStatus, setThinkingStatus] = useState('Locating course notes in Vault...');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setThinkingStatus('Locating course notes in Vault...');
      interval = setInterval(() => {
        setThinkingStatus(prev => 
          prev === 'Locating course notes in Vault...' 
          ? 'Parsing context & removing academic jargon...' 
          : 'Locating course notes in Vault...'
        );
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editInput, setEditInput] = useState("");

  const [isDragging, setIsDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [rawFiles, setRawFiles] = useState<any[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [isAssimilating, setIsAssimilating] = useState(false);
  const [assimilationStatus, setAssimilationStatus] = useState('');
  const [progressPercentage, setProgressPercentage] = useState(0);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).slice(0, 10);
    if (files.length === 0) return;

    setIsExtractingMock(true);
    setIsAssimilating(true);
    setProgressPercentage(0);

    let targetWorkspaceId = activeWorkspaceId;
    if (!targetWorkspaceId) {
      try {
        setAssimilationStatus('Creating new workspace...');
        const res = await fetch('/api/workspaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: context?.uid || null, userEmail: context?.email || 'guest@example.com' })
        });
        if (!res.ok) {
          throw new Error('Server returned ' + res.status);
        }
        const ws = await res.json();
        if (ws.id) {
          targetWorkspaceId = ws.id;
          setActiveWorkspaceId(ws.id);
          setActiveSources([]); // Clear any previous desk's sources
          setMessages([{ id: '1', role: 'assistant', content: 'Acknowledged. I am >_console. Ask me anything about your uploaded materials.' } as any]);
        } else {
          throw new Error('No workspace ID returned');
        }
      } catch (e) {
        console.error("Failed to create workspace", e);
        setIsAssimilating(false);
        setIsExtractingMock(false);
        return;
      }
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const getProgress = (stage: number) => Math.round(((i + (stage / 4)) / files.length) * 100);

      setAssimilationStatus('Uploading documents to secure vault...');
      setProgressPercentage(getProgress(0));

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const { data, error } = await supabase.storage
        .from('workspace-files')
        .upload(filePath, file);

      if (error) {
        console.error("Upload error:", error.message);
        continue;
      }

      const { data: publicUrlData } = supabase.storage
        .from('workspace-files')
        .getPublicUrl(filePath);

      const fileUrl = publicUrlData.publicUrl;
      console.log("Successfully uploaded to:", fileUrl);
      
      try {
        setAssimilationStatus('Extracting and structuring text...');
        setProgressPercentage(getProgress(1));
        const res = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name,
            url: fileUrl,
            workspaceId: targetWorkspaceId,
            fileSize: file.size
          })
        });
        if (res.ok) {
          const newDoc = await res.json();
          
          setActiveSources(prev => [...prev, {
            id: newDoc.id,
            title: file.name,
            type: file.name.endsWith('.pdf') ? 'pdf' : 'document',
            content: ''
          }]);

          setAssimilationStatus('Generating AI semantic vectors...');
          setProgressPercentage(getProgress(2));
          
          try {
            const analyzeRes = await fetch('/api/engine/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileUrl: fileUrl,
                fileName: file.name,
                docId: newDoc.id,
                userId: context?.uid || 'guest',
                workspaceId: targetWorkspaceId,
                workspaceName: activeWorkspaceName
              })
            });
            
            if (analyzeRes.ok) {
               const analyzeData = await analyzeRes.json();
               
               if (analyzeData.workspaceTitle) {
                 setActiveWorkspaceName(analyzeData.workspaceTitle);
                 setWorkspaces(prev => prev.map(w => w.id === targetWorkspaceId ? { ...w, title: analyzeData.workspaceTitle } : w));
               }
            } else {
              const errData = await analyzeRes.json();
              if (analyzeRes.status === 503 || errData.isCongested) {
                toast.error("High traffic detected. The AI servers are currently busy. Please try again in a few moments.");
              } else {
                toast.error(errData.error || "Analysis failed.");
              }
              console.warn("Analysis failed gracefully", errData);
            }
          } catch (analyzeError) {
            console.error("Analysis request failed", analyzeError);
          }
        } else {
          const errData = await res.json();
          toast.error(errData.error || "Failed to save document.");
          setAssimilationStatus('');
          setIsAssimilating(false);
          setIsExtractingMock(false);
          continue;
        }
      } catch (e) {
        console.error("Failed to save to database:", e);
      }
      setProgressPercentage(getProgress(3));
    }

    // We removed the old rename workflow here because the title is now 
    // dynamically generated during the document analysis phase directly in /api/engine/analyze
    
    setAssimilationStatus('Finalizing your study desk...');
    setProgressPercentage(100);
    // Trigger Vault refresh so the new workspace shows up
    fetchWorkspaces();

    setTimeout(() => {
       setIsAssimilating(false);
       setIsAddSourceModalOpen(false);
       setSourceModalView('options');
       setIsExtractingMock(false);
       if (event.target) event.target.value = '';
    }, 1000);
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [context?.uid]);

  const fetchWorkspaces = async () => {
    setIsLoadingVault(true);
    try {
      const res = await fetch(`/api/workspaces${context?.uid ? `?userId=${context.uid}` : ''}`);
      const ws = await res.json();
      setWorkspaces(ws);
      
      // Auto-select removed per user request: The user prefers to see the empty state 
      // showing their desks and the option to create a new workspace on load.
    } catch (e) { 
      console.error(e) 
    } finally {
      setIsLoadingVault(false);
    }
  };

  const handleSelectWorkspace = async (workspace: any) => {
    setActiveWorkspaceId(workspace.id);
    setActiveWorkspaceName(workspace.title);
    
    // Set active sources from documents
    if (workspace.documents) {
      setActiveSources(workspace.documents.map((d: any) => ({
        id: d.id,
        title: d.name,
        type: d.name.endsWith('.pdf') ? 'pdf' : 'document',
        content: ''
      })));
    } else {
      setActiveSources([]);
    }

    // Fetch historical messages
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/messages`);
      if (res.ok) {
        const msgs = await res.json();
        // Map Prisma messages to Vercel AI SDK format
        const formattedMsgs = msgs.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.text
        }));
        setMessages(formattedMsgs.length > 0 ? formattedMsgs : [{ id: '1', role: 'assistant', content: 'Acknowledged. I am >_console. Ask me anything about your uploaded materials.' } as any]);
      }
    } catch (e) {
      console.error("Failed to fetch messages:", e);
    }
  };

  const processFiles = (files: File[]) => {
    if (files.length > 20) {
      setUploadStatus('Error: You can only upload a maximum of 20 files at once.');
      setTimeout(() => setUploadStatus(''), 5000);
      return;
    }
    const validFiles = files.filter(f => f.name.match(/\.(pdf|pptx|docx|txt|jpg|jpeg|png|webp|heic)$/i));
    if (validFiles.length !== files.length) {
      setUploadStatus('Error: Unsupported file type. Please upload PDF, DOCX, PPTX, TXT, or Image files.');
      setTimeout(() => setUploadStatus(''), 5000);
      return;
    }
    setPendingFiles((prev) => {
      const combined = [...prev, ...validFiles];
      const unique = combined.filter((file, index, self) =>
        index === self.findIndex((f) => f.name === file.name && f.size === file.size)
      );
      if (unique.length > 20) {
        setUploadStatus('Error: Queue limit reached. Maximum 20 files total.');
        setTimeout(() => setUploadStatus(''), 4000);
        return prev;
      }
      return unique;
    });
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files && e.dataTransfer.files.length > 0) processFiles(Array.from(e.dataTransfer.files)); };
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files.length > 0) processFiles(Array.from(e.target.files)); };

  const handleUploadToVault = async () => {
    if (pendingFiles.length === 0 || !userData.uid || isUploading) return;
    setIsUploading(true); setUploadProgress(0); setUploadStatus('Scanning Vault for existing records...');

    try {
      const docsRes = await fetch('/api/documents');
      const existingFiles = await docsRes.json();

      const newFilesToUpload: File[] = [];
      const duplicateFiles: File[] = [];

      pendingFiles.forEach(file => {
        const isDuplicate = existingFiles.some((ef: any) => ef.fileName === file.name && ef.fileSize === file.size);
        if (isDuplicate) duplicateFiles.push(file);
        else newFilesToUpload.push(file);
      });

      if (newFilesToUpload.length === 0) {
        setUploadStatus('All selected files are already in your Vault.');
        setTimeout(() => { setPendingFiles([]); setIsUploading(false); setUploadStatus(''); setUploadProgress(0); }, 3000);
        return;
      }

      if (duplicateFiles.length > 0) setUploadStatus(`Skipped ${duplicateFiles.length} duplicates. Transmitting new files...`);
      else setUploadStatus('Initializing Secure Transfer...');

      const res = [];
      for (const file of newFilesToUpload) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `uploads/${fileName}`;
        const { error } = await supabase.storage.from('workspace-files').upload(filePath, file);
        if (!error) {
          const { data } = supabase.storage.from('workspace-files').getPublicUrl(filePath);
          res.push({ name: file.name, size: file.size, url: data.publicUrl });
        }
      }

      if (res && res.length > 0) {
        setUploadStatus('Saving records to Database...');
        try {
          for (const fileRes of res) {
            await fetch('/api/documents', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: fileRes.name,
                url: fileRes.url
              })
            });
          }
          setUploadStatus('Transfer Complete. Files Secured.');
        } catch (dbError) {
          setUploadStatus('Warning: Transfer succeeded, but database save failed.');
        }
        setTimeout(() => { setPendingFiles([]); setIsUploading(false); setUploadStatus(''); setUploadProgress(0); }, 3000);
      } else {
        setUploadStatus('Error: Server rejected the batch. Check limits.');
        setIsUploading(false); setUploadProgress(0);
      }
    } catch (error) {
      setUploadStatus('Error: Upload connection failed.');
      setIsUploading(false); setUploadProgress(0);
    }
  };

  const handleInitiateAnalysis = async () => {
    if (!userData.uid) return;
    setAnalysisStatus('Scanning Vault...');

    try {
      const res = await fetch('/api/documents');
      const allDocs = await res.json();
      const querySnapshot = { empty: allDocs.length === 0, docs: allDocs.map((d: any) => ({ id: d.id, data: () => d })) };

      if (querySnapshot.empty) {
        setAnalysisStatus('All files in your Vault are already analyzed!');
        setTimeout(() => setAnalysisStatus(''), 4000);
        return;
      }

      const files = querySnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

      // NEW: Sort files by newest first (reverse chronological)
      files.sort((a: any, b: any) => {
        const timeA = a.uploadedAt?.seconds || 0;
        const timeB = b.uploadedAt?.seconds || 0;
        return timeB - timeA;
      });

      setRawFiles(files);
      setSelectedFileIds([]);
      setIsSelectionMode(true);
      setAnalysisStatus('');
    } catch (error) {
      setAnalysisStatus('Error accessing Vault records.');
      setTimeout(() => setAnalysisStatus(''), 4000);
    }
  };

  const toggleFileSelection = (id: string) => {
    setSelectedFileIds(prev =>
      prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id]
    );
  };

  const handleProcessSelected = async () => {
    if (selectedFileIds.length === 0 || isAnalyzing) return;

    setIsAnalyzing(true);
    setIsSelectionMode(false);

    const filesToProcess = rawFiles.filter(f => selectedFileIds.includes(f.id));
    setAnalysisStatus(`Igniting AI Engine for ${filesToProcess.length} file(s)...`);

    let successCount = 0;

    try {
      for (const file of filesToProcess) {
        setAnalysisStatus(`Extracting: ${file.fileName}...`);

        const response = await fetch('/api/engine/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileUrl: file.downloadURL,
            fileName: file.fileName,
            docId: file.id,
            userId: userData.uid
          })
        });

        const textResponse = await response.text();
        let result;

        try {
          result = JSON.parse(textResponse);
        } catch (parseError) {
          throw new Error(`The AI Engine experienced a critical failure reading "${file.fileName}". The file might be corrupted or too complex.`);
        }

        if (response.ok && result.success) {
          successCount++;
        } else {
          throw new Error(result.error || `Failed to process ${file.fileName}. Please try again.`);
        }
      }

      setAnalysisStatus(`Analysis Complete. ${successCount}/${filesToProcess.length} integrated into AI Brain.`);
      setTimeout(() => setAnalysisStatus(''), 8000);
      setIsAnalyzing(false);

    } catch (error: any) {
      setAnalysisStatus(`${error.message}`);
      setIsAnalyzing(false);
    }
  };


  // --- NEW: Console Query Logic ---
  
  const handleExtractSource = (type: string, inputTitle: string, rawContent?: string) => {
    setIsExtractingMock(true);
    setTimeout(() => {
      let extractedContent = "";
      if (type === 'pdf') extractedContent = rawContent || "Extracted text from newly uploaded file...";
      if (type === 'vault') extractedContent = rawContent || "Mock extracted text from vault file.";
      if (type === 'image') extractedContent = `Mocked OCR text for ${inputTitle}`;
      if (type === 'website') extractedContent = `Mocked scraped text for ${inputTitle}`;
      if (type === 'youtube') extractedContent = `Mocked transcript for ${inputTitle}`;
      if (type === 'text') extractedContent = rawContent || "Manual text input.";

      setActiveSources(prev => [...prev, {
        id: Date.now().toString(),
        title: inputTitle,
        type: type,
        content: extractedContent
      }]);
      
      setIsExtractingMock(false);
      setIsAddSourceModalOpen(false);
      setSourceModalView('options');
      setSourceInputText('');
    }, 1500);
  };

  const handleRenameDocument = async () => {
    if (!newTitle.trim() || newTitle === activeWorkspaceName) {
      setIsEditingTitle(false);
      return;
    }
    const finalName = newTitle.trim();
    setActiveWorkspaceName(finalName);
    setIsEditingTitle(false);
  };

  const handleEditSubmit = (index: number) => {
    // Custom edit logic disabled for Vercel AI SDK simplicity in this refactor
  };

  const handleRegenerate = (index: number) => {
    // Custom regenerate logic disabled for Vercel AI SDK simplicity
  };

  const handleFeedback = async (index: number, type: 'up' | 'down') => {
    // Custom feedback logic disabled
  };

  const handleQueryConsole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    if (isContextLoading) {
      setMessages([...messages, { id: Date.now().toString(), role: 'assistant', parts: [{ type: 'text', text: 'Syncing Academic Data... Please wait.' }] } as any]);
      return;
    }

    console.log('🚀 Sending to backend - Workspace ID:', activeWorkspaceId, 'Sources attached:', activeSources);
    sendMessage({ role: 'user', parts: [{ type: 'text', text: input }] } as any, {
      body: {
        activeSources,
        workspaceId: activeWorkspaceId,
        userProfile: {
          name: context?.name || 'Guest',
          school: context?.school || '',
          department: context?.department || '',
          courses: context?.profile?.semesters?.find((s: any) => s.isActive)?.courses || []
        }
      }
    });
    setInput('');
  };

  const handleRefresh = async () => {
    router.refresh();
    if (typeof fetchWorkspaces === 'function') {
      await fetchWorkspaces();
    }
    // Artificial delay for UI polish
    await new Promise(resolve => setTimeout(resolve, 800));
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      

      <div className="flex flex-col h-full w-full">
        {isAssimilating && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md transition-opacity duration-300">
            <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-gray-900 border border-gray-700 shadow-2xl w-full max-w-md">
              <span className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></span>
              <p className="text-xl font-bold text-white text-center">{assimilationStatus}</p>
              
              {/* Progress Bar Container */}
              <div className="w-full h-2 bg-gray-800 rounded-full mt-4 overflow-hidden">
                <div 
                  className="h-full bg-orange-500 transition-all duration-300 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-400 mt-2">{progressPercentage}% Complete</p>
            </div>
          </div>
        )}
        
        

                <div className="flex-1 flex flex-col h-full overflow-hidden p-6">
          

          {activeSources.length === 0 && (
            <header style={{ borderBottom: '1px solid #27272A', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: '2rem', margin: 0, letterSpacing: '-0.05em' }}>Command Center</h1>
                <p style={{ color: '#A1A1AA', margin: '0.5rem 0 0 0', fontSize: '1rem' }}>Initialize and monitor your study engines.</p>
              </div>
            </header>
          )}

          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
            {activeSources.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '2rem' }}>
                <div style={{ textAlign: 'center', maxWidth: '600px' }}>
                  <h2 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>Unlock the Command Center</h2>
                  <p style={{ color: '#A1A1AA', fontSize: '1.1rem', lineHeight: '1.6' }}>Upload a document or select notes from your Vault to unlock the Command Center.</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', width: '100%', maxWidth: '800px' }}>
                  <div style={{ backgroundColor: '#111111', padding: '2rem', borderRadius: '1rem', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>Upload New Source</h3>
                    <div
                      onClick={() => {
                        setActiveWorkspaceId(null);
                        setActiveWorkspaceName("Untitled Workspace");
                        setMessages([{ id: '1', role: 'assistant', content: 'Acknowledged. I am >_console. Ask me anything about your uploaded materials.' } as any]);
                        setIsAddSourceModalOpen(true);
                      }}
                      style={{ backgroundColor: '#18181B', padding: '2rem', borderRadius: '0.5rem', border: '1px dashed #3F3F46', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', marginTop: 'auto' }}
                    >
                      <span style={{ color: 'white', fontWeight: '500' }}>+ Add Source</span>
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#111111', padding: '2rem', borderRadius: '1rem', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>Select from Desks</h3>
                    <div className="file-list-container" style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {isLoadingVault ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                          <div style={{ display: 'inline-block', width: '24px', height: '24px', border: '3px solid #EA580C', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                        </div>
                      ) : workspaces.length > 0 ? (
                        workspaces.map(ws => (
                          <div key={ws.id} style={{ position: 'relative' }}>
                            {editingDeskId === ws.id ? (
                              <div style={{ backgroundColor: '#18181B', border: '1px solid #EA580C', padding: '0.75rem', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <input
                                  autoFocus
                                  value={editingDeskTitle}
                                  onChange={e => setEditingDeskTitle(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') submitDeskRename(ws.id);
                                    if (e.key === 'Escape') setEditingDeskId(null);
                                  }}
                                  onBlur={() => submitDeskRename(ws.id)}
                                  style={{ backgroundColor: 'transparent', color: 'white', border: 'none', outline: 'none', fontWeight: 'bold', width: '100%' }}
                                />
                                <span style={{ fontSize: '0.8rem', color: '#A1A1AA' }}>{ws.documents?.length || 0} documents</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleSelectWorkspace(ws)}
                                style={{ width: '100%', backgroundColor: '#18181B', color: 'white', border: '1px solid #27272A', padding: '0.75rem', borderRadius: '0.5rem', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.25rem', transition: 'border-color 0.2s' }}
                                onMouseOver={e => e.currentTarget.style.borderColor = '#EA580C'}
                                onMouseOut={e => e.currentTarget.style.borderColor = '#27272A'}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                  <span style={{ fontWeight: 'bold' }}>🗂️ {ws.title}</span>
                                  <div
                                    onClick={(e) => { e.stopPropagation(); setActiveDropdownId(activeDropdownId === ws.id ? null : ws.id); }}
                                    className="p-1 hover:bg-gray-800 rounded z-10 transition-colors"
                                  >
                                    <MoreVertical className="w-5 h-5 text-gray-400 hover:text-white" />
                                  </div>
                                </div>
                                <span style={{ fontSize: '0.8rem', color: '#A1A1AA' }}>{ws.documents?.length || 0} documents</span>
                              </button>
                            )}
                            
                            {activeDropdownId === ws.id && (
                              <div style={{ position: 'absolute', top: '2.5rem', right: '0.5rem', backgroundColor: '#18181B', border: '1px solid #27272A', borderRadius: '0.5rem', zIndex: 20, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)' }}>
                                <button onClick={(e) => { e.stopPropagation(); setEditingDeskId(ws.id); setEditingDeskTitle(ws.title); setActiveDropdownId(null); }} className="px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white text-left transition-colors">Rename</button>
                                <button onClick={(e) => { e.stopPropagation(); handleShareWorkspace(ws); }} className="px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white text-left transition-colors">Share</button>
                                <button onClick={(e) => { e.stopPropagation(); setWorkspaceToDelete(ws.id); setActiveDropdownId(null); }} className="px-4 py-2 text-sm text-red-500 hover:bg-red-950/30 hover:text-red-400 text-left transition-colors border-t border-gray-800">Delete</button>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <span style={{ color: '#71717A', fontSize: '0.9rem', textAlign: 'center', padding: '1rem 0' }}>No saved Desks. Add a new source to start a workspace.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <CommandCenterUI
                workspaceId={activeWorkspaceId || ''}
                title={activeWorkspaceName || (activeSources.length > 0 ? activeSources[0].title : 'Untitled Workspace')}
                activeSources={activeSources}
                onRemoveSource={(id) => {
                  setActiveSources(prev => prev.filter(s => s.id !== id));
                }}
                onAddSource={() => {
                  setActiveWorkspaceId(null);
                  setActiveWorkspaceName("Untitled Workspace");
                  setMessages([{ id: '1', role: 'assistant', content: 'Acknowledged. I am >_console. Ask me anything about your uploaded materials.' } as any]);
                  setIsAddSourceModalOpen(true);
                  setSourceModalView('options');
                }}
                onExit={() => { 
                  setActiveWorkspaceId(null);
                  setActiveSources([]); 
                  setActiveWorkspaceName("Untitled Workspace"); 
                  setMessages([{ id: '1', role: 'assistant', content: 'Acknowledged. I am >_console. Ask me anything about your uploaded materials.' } as any]);
                }}
                onYouTubeSubmit={handleYouTubeSubmit}
                onRetry={handleRetryMessage}
                chatMessages={messages.map(m => ({ role: m.role, text: m.parts ? m.parts.map(p => (p as any).text).join('') : (m as any).content || '' }))}
                chatInput={input}
                setChatInput={setInput}
                onSendMessage={() => {
                  if (!input.trim() || isLoading) return;
                  console.log('🚀 Sending to backend - Workspace ID:', activeWorkspaceId, 'Sources attached:', activeSources);
                  sendMessage({ role: 'user', parts: [{ type: 'text', text: input }] } as any, {
                    body: {
                      activeSources,
                      workspaceId: activeWorkspaceId,
                      userProfile: {
                        name: context?.name || 'Guest',
                        school: context?.school || '',
                        department: context?.department || '',
                        courses: context?.profile?.semesters?.find((s: any) => s.isActive)?.courses || []
                      }
                    }
                  });
                  setInput('');
                }}
                isChatLoading={isLoading}
                isAssimilating={isAssimilating}
                assimilationStatus={assimilationStatus}
                onUpdateTitle={setActiveWorkspaceName}
                chatError={error}
                isWorkspaceReady={!!activeWorkspaceId}
              />
            )}
          </div>
        </div>

        {/* Add Source Modal */}
        {isAddSourceModalOpen && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ backgroundColor: '#111111', border: '1px solid #27272A', borderRadius: '1rem', width: '90%', maxWidth: '500px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
              <button onClick={() => { setIsAddSourceModalOpen(false); setSourceModalView('options'); setSourceInputText(''); }} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#A1A1AA', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{sourceModalView === 'options' ? 'Add Source' : sourceModalView === 'website' ? 'Paste Website URL' : sourceModalView === 'youtube' ? 'Paste YouTube URL' : 'Paste Text'}</h2>
              
              {isExtractingMock ? (
                 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem 0' }}>
                   <div style={{ width: '40px', height: '40px', border: '4px solid #EA580C', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                   <span style={{ color: '#A1A1AA' }}>Extracting content...</span>
                 </div>
              ) : sourceModalView === 'options' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                  <label style={{ backgroundColor: '#18181B', border: '1px solid #27272A', padding: '1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', color: 'white', transition: 'border-color 0.2s' }} >
                    <span style={{ fontSize: '1.5rem' }}>📄</span>
                    <span style={{ fontWeight: 'bold' }}>PDF / Doc</span>
                    <input type="file" multiple accept=".pdf,.doc,.docx,.txt" style={{ display: 'none' }} onChange={handleFileUpload} />
                  </label>
                  <label style={{ backgroundColor: '#18181B', border: '1px solid #27272A', padding: '1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', color: 'white', transition: 'border-color 0.2s' }} >
                    <span style={{ fontSize: '1.5rem' }}>📸</span>
                    <span style={{ fontWeight: 'bold' }}>Image / Camera</span>
                    <input type="file" multiple accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileUpload} />
                  </label>
                  <button onClick={() => setSourceModalView('website')} style={{ backgroundColor: '#18181B', border: '1px solid #27272A', padding: '1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', color: 'white', transition: 'border-color 0.2s' }} >
                    <span style={{ fontSize: '1.5rem' }}>🌐</span>
                    <span style={{ fontWeight: 'bold' }}>Website</span>
                  </button>
                  <button onClick={() => setSourceModalView('youtube')} style={{ backgroundColor: '#18181B', border: '1px solid #27272A', padding: '1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', color: 'white', transition: 'border-color 0.2s' }} >
                    <span style={{ fontSize: '1.5rem' }}>▶️</span>
                    <span style={{ fontWeight: 'bold' }}>YouTube</span>
                  </button>
                  <button onClick={() => setSourceModalView('text')} style={{ backgroundColor: '#18181B', border: '1px solid #27272A', padding: '1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', color: 'white', transition: 'border-color 0.2s' }} >
                    <span style={{ fontSize: '1.5rem' }}>📋</span>
                    <span style={{ fontWeight: 'bold' }}>Copied Text</span>
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {sourceModalView === 'text' ? (
                    <textarea 
                      value={sourceInputText} 
                      onChange={e => setSourceInputText(e.target.value)} 
                      placeholder="Paste your text here..." 
                      style={{ width: '100%', height: '200px', backgroundColor: '#18181B', color: 'white', border: '1px solid #27272A', padding: '1rem', borderRadius: '0.5rem', outline: 'none', resize: 'none' }}
                    />
                  ) : (
                    <input 
                      type="text" 
                      value={sourceInputText} 
                      onChange={e => setSourceInputText(e.target.value)} 
                      placeholder="https://" 
                      style={{ width: '100%', backgroundColor: '#18181B', color: 'white', border: '1px solid #27272A', padding: '1rem', borderRadius: '0.5rem', outline: 'none' }}
                    />
                  )}
                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                    <button onClick={() => setSourceModalView('options')} style={{ padding: '0.75rem 1.5rem', backgroundColor: 'transparent', color: '#A1A1AA', border: 'none', cursor: 'pointer' }}>Back</button>
                    <button 
                      onClick={() => {
                        if(!sourceInputText.trim()) return;
                        handleExtractSource(sourceModalView, sourceModalView === 'text' ? 'Pasted Text Snippet' : sourceInputText, sourceModalView === 'text' ? sourceInputText : undefined);
                      }} 
                      style={{ padding: '0.75rem 1.5rem', backgroundColor: '#EA580C', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      Fetch
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
      {workspaceToDelete && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2">Delete Workspace?</h3>
            <p className="text-gray-400 text-sm mb-6">Are you sure? This will delete all documents and chat history permanently.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setWorkspaceToDelete(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 transition-colors">Cancel</button>
              <button onClick={handleDeleteWorkspace} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-500 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </PullToRefresh>
  );
}

```

### `app\(app)\layout.tsx`
```tsx
'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { useUserContext } from '../../lib/hooks/useUserContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { context, isLoading: isContextLoading } = useUserContext();
  
  const userData = context || { name: 'Guest Student', email: 'Not signed in', uid: '', profile: null };

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#0A1128] text-white w-full max-w-[100vw]">
      {/* Mobile Overlay */}
      <div 
        className={`fixed inset-0 bg-black/70 z-40 transition-opacity duration-300 md:hidden ${isSidebarOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Sidebar */}
      <Sidebar 
        isSidebarOpen={isSidebarOpen} 
        setIsSidebarOpen={setIsSidebarOpen} 
        userData={userData} 
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-[100dvh] relative overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-zinc-800 shrink-0 bg-[#111111]">
          <div className="flex items-center gap-2">
            <button 
              className="p-2 -ml-2 text-white hover:bg-zinc-800 rounded-lg transition-colors"
              onClick={() => setIsSidebarOpen(true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
            </button>
            <span className="font-bold text-zinc-100">CogniBase</span>
          </div>
        </header>

        {/* Content Wrapper */}
        <div className="flex-1 overflow-y-auto relative">
          {children}
        </div>
      </main>
    </div>
  );
}

```

### `app\(app)\lecture-materials\[id]\page.tsx`
```tsx
import { prisma } from '@/lib/prisma';
import DocumentReader from '@/components/DocumentReader';
import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';

export default async function LectureMaterialReader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const document = await prisma.document.findUnique({
    where: { id }
  });

  if (!document) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-white mb-4">Document Not Found</h1>
        <Link href="/vault" className="text-orange-500 hover:underline">
          Return to Vault
        </Link>
      </div>
    );
  }

  const isPdf = document.sourceType === 'application/pdf' || document.name?.toLowerCase().endsWith('.pdf');

  return (
    <div className="h-screen w-screen bg-zinc-950 text-slate-100 flex flex-col overflow-hidden">
      {/* Universal Header */}
      <nav className="shrink-0 h-16 backdrop-blur-xl bg-zinc-900/50 border-b border-zinc-800/50 flex items-center justify-between px-6 z-40">
        <Link href="/vault" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors w-1/3">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium text-sm hidden sm:inline">Back to Vault</span>
        </Link>
        
        <div className="flex-1 text-center font-semibold text-white truncate px-4">
          {document.name}
        </div>
        
        <div className="w-1/3 flex justify-end"></div>
      </nav>

      {/* Core Rendering Area */}
      <div className="flex-1 w-full relative overflow-hidden flex flex-col">
        {isPdf ? (
          <>
            <iframe 
              src={`${document.url}#toolbar=0&navpanes=0`} 
              className="w-full h-full border-none bg-zinc-900 flex-1"
              title={document.name}
            />
            {/* PDF Control HUD */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
               <a 
                 href={document.url || '#'} 
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="flex items-center gap-2 bg-zinc-800/80 backdrop-blur-md border border-zinc-700/50 rounded-full px-5 py-2 shadow-2xl text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
               >
                 <Download className="w-4 h-4" />
                 <span className="text-sm font-medium">Download Original</span>
               </a>
            </div>
          </>
        ) : (
          <DocumentReader document={document} />
        )}
      </div>
    </div>
  );
}

```

### `app\(app)\settings\page.tsx`
```tsx
'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';
import { formatSmartTime } from '@/lib/utils/time';
import { Activity, User, Sliders, Zap, BookOpen, CheckCircle, UploadCloud, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import CustomSelect from '@/components/ui/CustomSelect';
import { useUserContext } from '@/lib/hooks/useUserContext';

type Tab = 'profile' | 'preferences' | 'activity';

export default function SettingsPage() {
  const { context: globalContext, mutate } = useUserContext();
  const [userData, setUserData] = useState<any>({ 
    name: 'Loading...', 
    email: '', 
    uid: '', 
    school: '',
    department: '',
    preferences: {
      theme: 'system',
      sidebarMode: 'expanded',
      dailyFocusGoal: 120,
      guideComplexity: 'standard'
    }
  });
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<any>({});

  const handleSave = async () => {
    setIsSaving(true);
    setErrors({});
    
    // Gather Profile fields
    const displayName = (document.getElementById('displayName') as HTMLInputElement)?.value;
    const school = (document.getElementById('school') as HTMLInputElement)?.value;
    const department = (document.getElementById('department') as HTMLInputElement)?.value;

    // Gather Preference fields
    const theme = (document.querySelector('input[name="theme"]:checked') as HTMLInputElement)?.value || userData.preferences?.theme || 'system';
    const sidebarMode = (document.getElementById('sidebarMode') as HTMLInputElement)?.checked ? 'collapsed' : 'expanded';
    const guideComplexity = (document.getElementById('guideComplexity') as HTMLInputElement)?.value || 'standard';
    const dailyFocusGoal = (document.getElementById('dailyFocusGoal') as HTMLInputElement)?.value || '120';

    if (!displayName || displayName.trim() === '') {
      setErrors({ displayName: true });
      setIsSaving(false);
      return;
    }
    
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: displayName, 
          school, 
          department,
          preferences: {
            theme,
            sidebarMode,
            dailyFocusGoal: parseInt(dailyFocusGoal),
            guideComplexity
          }
        })
      });
      const t = (window as any).toast || console.log;
      if (typeof t.success === 'function') t.success('Settings updated successfully!');
      
      // Update global context
      await mutate();
      
    } catch(e) {
      const t = (window as any).toast || console.log;
      if (typeof t.error === 'function') t.error('Failed to update settings');
    }
    setIsSaving(false);
  };

  useEffect(() => {
    if (globalContext) {
      setUserData(globalContext);
    }
  }, [globalContext]);

  useEffect(() => {
    if (activeTab === 'activity' && userData.uid) {
      setIsLoadingLogs(true);
      fetch(`/api/audit-logs?userId=${userData.uid}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setAuditLogs(data);
          setIsLoadingLogs(false);
        })
        .catch(err => {
          console.error("Failed to fetch logs", err);
          setIsLoadingLogs(false);
        });
    }
  }, [activeTab, userData.uid]);

  const tabs = [
    { id: 'profile', label: 'Profile', icon: <User size={18} /> },
    { id: 'preferences', label: 'Preferences', icon: <Sliders size={18} /> },
    { id: 'activity', label: 'Activity Log', icon: <Activity size={18} /> },
  ];

  return (
    <>
      <style>{`
        body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; background-color: #09090B; color: #F9FAFB; overflow: hidden; }
        .dashboard-layout { display: flex; height: 100dvh; width: 100vw; overflow: hidden; }
        .settings-container { display: flex; flex: 1; overflow: hidden; }
        .settings-sidebar { width: 280px; border-right: 1px solid #27272A; background-color: #111111; padding: 2rem 1.5rem; display: flex; flexDirection: column; gap: 0.5rem; }
        .settings-content { flex: 1; padding: 3rem; overflow-y: auto; background-color: #09090B; }
        .settings-tab { display: flex; alignItems: center; gap: 0.75rem; padding: 0.75rem 1rem; border-radius: 0.5rem; cursor: pointer; transition: all 0.2s; color: #A1A1AA; font-weight: 500; }
        .settings-tab:hover { background-color: #18181B; color: #E4E4E7; }
        .settings-tab.active { background-color: #EA580C; color: white; }
        @media (max-width: 768px) {
          .settings-container { flex-direction: column; }
          .settings-sidebar { width: 100%; border-right: none; border-bottom: 1px solid #27272A; padding: 1rem; display: flex; flexDirection: row; overflow-x: auto; gap: 0.5rem; }
          .settings-tab { white-space: nowrap; }
          .settings-content { padding: 1.5rem; }
        }
      `}</style>
      
      <div className="flex flex-col h-full w-full">
        <div className="flex-1 flex flex-col h-full overflow-hidden p-6">
          <div className="settings-container w-full h-full">
            <div className="settings-sidebar pt-16 lg:pt-8">
              <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4 px-4">User Settings</h2>
              {tabs.map((tab) => (
                <div 
                  key={tab.id}
                  className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id as Tab)}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </div>
              ))}
            </div>

            <div className="settings-content">
              <div className="max-w-3xl">
                
                {activeTab === 'profile' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div>
                      <h1 className="text-3xl font-bold mb-2">My Profile</h1>
                      <p className="text-zinc-400">Manage your identity and basic information.</p>
                    </div>
                    <div className="bg-[#111111] border border-[#27272A] rounded-xl p-6 space-y-6">
                      <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-500 text-2xl font-bold">
                          {userData.name.charAt(0).toUpperCase()}
                        </div>
                        <button disabled={isSaving} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold rounded-lg transition-colors border border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed">Change Avatar</button>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-zinc-300">Email Address</label>
                        <input type="email" disabled className="w-full bg-[#18181B] border border-[#27272A] rounded-lg px-4 py-2.5 text-zinc-500 cursor-not-allowed" value={userData.email} />
                        <p className="text-xs text-zinc-500 mt-1">To change your email, please contact support.</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-zinc-300">Display Name</label>
                        <input id="displayName" type="text" disabled={isSaving} className={`w-full bg-[#18181B] border ${errors.displayName ? 'border-red-500' : 'border-[#27272A]'} rounded-lg px-4 py-2.5 text-white focus:border-orange-500 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed`} defaultValue={userData.name} placeholder="Enter display name" />
                        {errors.displayName && <p className="text-red-500 text-xs mt-1">Display name cannot be empty.</p>}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-zinc-300">University / Institution</label>
                          <input id="school" type="text" disabled={isSaving} defaultValue={userData.school} className="w-full bg-[#18181B] border border-[#27272A] rounded-lg px-4 py-2.5 text-white focus:border-orange-500 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed" placeholder="e.g., Veritas University" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-zinc-300">Major / Department</label>
                          <input id="department" type="text" disabled={isSaving} defaultValue={userData.department} className="w-full bg-[#18181B] border border-[#27272A] rounded-lg px-4 py-2.5 text-white focus:border-orange-500 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed" placeholder="e.g., Educational Management" />
                        </div>
                      </div>
                      <button onClick={handleSave} disabled={isSaving} className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-2.5 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[140px]">
                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'preferences' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div>
                      <h1 className="text-3xl font-bold mb-2">Preferences</h1>
                      <p className="text-zinc-400">Configure your study goals and application behavior.</p>
                    </div>
                    <div className="bg-[#111111] border border-[#27272A] rounded-xl p-6 space-y-8">
                      
                      <div>
                        <div className="mb-4">
                          <h3 className="font-semibold text-white">Theme Selection</h3>
                          <p className="text-sm text-zinc-400 mt-1">Choose how CogniBase looks for you.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <label className="cursor-pointer">
                            <input type="radio" name="theme" value="system" className="peer sr-only" defaultChecked={userData.preferences?.theme === 'system'} />
                            <div className="border border-[#27272A] peer-checked:border-orange-500 peer-checked:ring-1 peer-checked:ring-orange-500 rounded-xl p-4 bg-zinc-900 transition-all relative overflow-hidden group">
                              <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900 opacity-50"></div>
                              <div className="relative z-10 flex flex-col items-center gap-3">
                                <div className="w-full h-16 bg-zinc-800 rounded flex gap-2 p-2">
                                  <div className="w-1/3 bg-zinc-700 rounded"></div>
                                  <div className="w-2/3 bg-zinc-700 rounded"></div>
                                </div>
                                <span className="font-semibold text-zinc-300 peer-checked:text-white text-sm">System</span>
                              </div>
                            </div>
                          </label>
                          <label className="cursor-pointer">
                            <input type="radio" name="theme" value="dark" className="peer sr-only" defaultChecked={userData.preferences?.theme === 'dark'} />
                            <div className="border border-[#27272A] peer-checked:border-orange-500 peer-checked:ring-1 peer-checked:ring-orange-500 rounded-xl p-4 bg-zinc-950 transition-all relative overflow-hidden group">
                              <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-black opacity-50"></div>
                              <div className="relative z-10 flex flex-col items-center gap-3">
                                <div className="w-full h-16 bg-zinc-900 border border-zinc-800 rounded flex gap-2 p-2">
                                  <div className="w-1/3 bg-zinc-800 rounded"></div>
                                  <div className="w-2/3 bg-zinc-800 rounded"></div>
                                </div>
                                <span className="font-semibold text-zinc-300 peer-checked:text-white text-sm">Deep Dark</span>
                              </div>
                            </div>
                          </label>
                          <label className="cursor-pointer">
                            <input type="radio" name="theme" value="midnight" className="peer sr-only" defaultChecked={userData.preferences?.theme === 'midnight'} />
                            <div className="border border-[#27272A] peer-checked:border-orange-500 peer-checked:ring-1 peer-checked:ring-orange-500 rounded-xl p-4 bg-slate-900 transition-all relative overflow-hidden group">
                              <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950 opacity-50"></div>
                              <div className="relative z-10 flex flex-col items-center gap-3">
                                <div className="w-full h-16 bg-slate-800 rounded flex gap-2 p-2">
                                  <div className="w-1/3 bg-slate-700 rounded"></div>
                                  <div className="w-2/3 bg-slate-700 rounded"></div>
                                </div>
                                <span className="font-semibold text-zinc-300 peer-checked:text-white text-sm">Midnight</span>
                              </div>
                            </div>
                          </label>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-6 border-t border-[#27272A]">
                        <div>
                          <h3 className="font-semibold text-white">Study Engine Default</h3>
                          <p className="text-sm text-zinc-400 mt-1">Select the default processing mode for new documents.</p>
                        </div>
                        <CustomSelect 
                          id="guideComplexity"
                          value={userData.preferences?.guideComplexity || 'standard'}
                          onChange={(val) => setUserData((prev: any) => ({...prev, preferences: {...prev.preferences, guideComplexity: val}}))}
                          options={[
                            { value: 'cram', label: 'Cram Mode (Micro-bites)' },
                            { value: 'standard', label: 'Standard' },
                            { value: 'deep', label: 'Deep Dive' }
                          ]}
                        />
                      </div>

                      <div className="flex items-center justify-between pt-6 border-t border-[#27272A]">
                        <div>
                          <h3 className="font-semibold text-white">Focus Mode</h3>
                          <p className="text-sm text-zinc-400 mt-1">Automatically collapse sidebars when viewing a document.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input id="sidebarMode" type="checkbox" className="sr-only peer" defaultChecked={userData.preferences?.sidebarMode === 'collapsed'} />
                          <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                        </label>
                      </div>
                      
                      <div className="flex items-center justify-between pt-6 border-t border-[#27272A]">
                        <div className="pr-4">
                          <h3 className="font-semibold text-white">Daily Focus Goal</h3>
                          <p className="text-sm text-zinc-400 mt-1">Target focus minutes per day for the gamification rings.</p>
                        </div>
                        <input id="dailyFocusGoal" type="number" min="10" max="600" defaultValue={userData.preferences?.dailyFocusGoal || 120} className="w-24 bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-2 text-white text-center focus:border-orange-500 outline-none" />
                      </div>

                      <div className="pt-6 border-t border-[#27272A]">
                        <button onClick={handleSave} disabled={isSaving} className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-2.5 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[140px]">
                          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'activity' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div>
                      <h1 className="text-3xl font-bold mb-2">Activity Log</h1>
                      <p className="text-zinc-400">A timeline of your actions across the system (Last 20).</p>
                    </div>
                    <div className="bg-[#111111] border border-[#27272A] rounded-xl p-6">
                      {isLoadingLogs ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-zinc-500 text-sm">Fetching logs...</span>
                        </div>
                      ) : auditLogs.length > 0 ? (
                        <div className="relative border-l border-zinc-800 ml-4 space-y-10 py-2">
                          {auditLogs.map((log: any, i: number) => {
                            let Icon = Activity;
                            let iconColor = 'text-zinc-400';
                            let glowColor = 'bg-zinc-500/20';
                            
                            if (log.action.toLowerCase().includes('generate') || log.action.toLowerCase().includes('create')) {
                              Icon = Zap;
                              iconColor = 'text-yellow-400';
                              glowColor = 'bg-yellow-500/20';
                            } else if (log.action.toLowerCase().includes('study') || log.action.toLowerCase().includes('read') || log.action.toLowerCase().includes('review')) {
                              Icon = BookOpen;
                              iconColor = 'text-blue-400';
                              glowColor = 'bg-blue-500/20';
                            } else if (log.action.toLowerCase().includes('upload') || log.action.toLowerCase().includes('add')) {
                              Icon = UploadCloud;
                              iconColor = 'text-green-400';
                              glowColor = 'bg-green-500/20';
                            } else if (log.action.toLowerCase().includes('update') || log.action.toLowerCase().includes('edit')) {
                              Icon = CheckCircle;
                              iconColor = 'text-purple-400';
                              glowColor = 'bg-purple-500/20';
                            }

                            return (
                              <div key={log.id} className="relative pl-8 group">
                                <div className={`absolute -left-[18px] top-0.5 w-9 h-9 rounded-full bg-[#111111] border border-zinc-800 flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.5)] z-10 ${glowColor} group-hover:border-zinc-600 transition-colors`}>
                                  <Icon size={16} className={iconColor} />
                                </div>
                                
                                <div className="flex flex-col gap-1.5 pt-1">
                                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">{formatSmartTime(log.createdAt)}</span>
                                  <h3 className="text-base font-bold text-zinc-200">{log.action}</h3>
                                  {log.details && (
                                    <p className="text-sm text-zinc-400 leading-relaxed mt-0.5">{log.details}</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-12 text-zinc-500">
                          <Activity className="mx-auto h-12 w-12 text-zinc-700 mb-4" />
                          <p>No activity logs found for your account.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

```

### `app\(app)\studio-assets\page.tsx`
```tsx
"use client";
import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import StudioAssetsPanel from '../../../components/StudioAssetsPanel';

export default function StudioAssetsPage() {
  const pathname = usePathname();
    const [userData, setUserData] = useState<any>({ name: 'Loading...', email: '', uid: '', profile: null });

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await import('@/utils/supabase/client').then(m => m.supabase.auth.getSession());
      if (session?.user) {
        setUserData({ name: session.user.email?.split('@')[0] || 'Student', email: session.user.email || '', uid: session.user.id });
      }
    };
    fetchUser();
  }, []);

  return (
    <>
      <style>{`
        body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; background-color: #09090B; color: #F9FAFB; overflow: hidden; }
        .dashboard-layout { display: flex; height: 100dvh; width: 100vw; overflow: hidden; }
        .sidebar { position: fixed; top: 0; left: -300px; width: 260px; height: 100dvh; background-color: #111111; border-right: 1px solid #27272A; padding: 1.5rem; display: flex; flex-direction: column; z-index: 50; transition: left 0.3s ease; }
        .sidebar.open { left: 0; }
        .main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative; z-index: 10; background-color: #09090B; padding: 0; }
        @media (min-width: 1024px) {
          .sidebar { position: static; width: 250px; left: 0; transition: none; flex-shrink: 0; }
        }
      `}</style>
      
      <div className="flex flex-col h-full w-full">
        

        <div className="flex-1 flex flex-col h-full overflow-hidden p-6" style={{ padding: '2rem', overflowY: 'auto' }}>
          <div className="lg:hidden mb-4">
            <button onClick={() => setIsSidebarOpen(true)} className="text-white text-2xl">☰</button>
          </div>
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2rem', margin: 0 }}>Studio Assets</h1>
          </header>

          <div style={{ maxWidth: '1200px' }}>
            <p className="text-gray-400 mb-8">View and export all AI-generated assets across your workspaces.</p>
            {userData.uid ? (
              <StudioAssetsPanel userId={userData.uid} />
            ) : (
              <div className="w-full h-20 bg-gray-900 rounded-xl border border-gray-800 animate-pulse" />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

```

### `app\(app)\study-guides\page.tsx`
```tsx
"use client";
import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { StudyEngine } from '@/components/StudyEngine';
import { toast } from 'sonner';
import { formatSmartTime } from '@/lib/utils/time';


export default function StudyGuidesPage() {
  const pathname = usePathname();
  
  const [userData, setUserData] = useState<any>({ name: 'Loading...', email: '', uid: '', profile: null });
  const [studyGuides, setStudyGuides] = useState<any[]>([]);
  const [activeStudyGuide, setActiveStudyGuide] = useState<any>(null);
  const [isStudyGuideViewOpen, setIsStudyGuideViewOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      setTimeout(() => {
        setDeleteConfirmId(null);
      }, 3000);
      return;
    }
    
    try {
      const res = await fetch(`/api/study-guides/${id}?userId=${userData.uid}`, { method: 'DELETE' });
      if (res.ok) {
        setStudyGuides(prev => prev.filter(g => g.id !== id));
        setDeleteConfirmId(null);
        toast.success("Study guide deleted successfully.");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete study guide.");
      }
    } catch (error) {
      console.error("Delete failed", error);
      toast.error("An unexpected error occurred.");
    }
  };

  useEffect(() => {
    const fetchGuides = async () => {
      const { data: { session } } = await import('@/utils/supabase/client').then(m => m.supabase.auth.getSession());
      if (session?.user) {
        setUserData({ name: session.user.email?.split('@')[0] || 'Student', email: session.user.email || '', uid: session.user.id });
        try {
          const res = await fetch('/api/study-guides?userId=' + session.user.id);
          const sGuides = await res.json();
          setStudyGuides(sGuides);
        } catch(e) { console.error(e) }
      }
    };
    fetchGuides();
  }, []);

  return (
    <>
      <style>{`
        body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; background-color: #09090B; color: #F9FAFB; overflow: hidden; }
        .dashboard-layout { display: flex; height: 100dvh; width: 100vw; overflow: hidden; }
        .sidebar { position: fixed; top: 0; left: -300px; width: 260px; height: 100dvh; background-color: #111111; border-right: 1px solid #27272A; padding: 1.5rem; display: flex; flex-direction: column; z-index: 50; transition: left 0.3s ease; }
        .sidebar.open { left: 0; }
        .main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative; z-index: 10; background-color: #09090B; padding: 0; }
        @media (min-width: 1024px) {
          .sidebar { position: static; width: 250px; left: 0; transition: none; flex-shrink: 0; }
        }
      `}</style>
      
      <div className="flex flex-col h-full w-full">
        

        <div className="flex-1 flex flex-col h-full overflow-hidden p-6" style={{ padding: '2rem', overflowY: 'auto' }}>
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2rem', margin: 0 }}>Global Study Guides</h1>
          </header>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {Array.isArray(studyGuides) && studyGuides.length > 0 ? (
              studyGuides.map(guide => (
                <div key={guide.id} className="w-full overflow-hidden px-4 sm:px-6 py-4 sm:py-6 break-words whitespace-normal hover:border-orange-500 hover:-translate-y-1" style={{ backgroundColor: '#18181B', borderRadius: '0.75rem', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '1rem', cursor: 'pointer', transition: 'transform 0.2s, border-color 0.2s' }} onClick={() => { setActiveStudyGuide(guide); setIsStudyGuideViewOpen(true); }}>
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 w-full pr-4">
                      <h3 className="break-words whitespace-normal min-w-0" style={{ margin: 0, color: 'white', fontSize: '1.1rem', marginBottom: '0.25rem' }}>{guide.sectionConstraint}</h3>
                      <span className="break-words whitespace-normal min-w-0 block" style={{ color: '#71717A', fontSize: '0.85rem' }}>{guide.sourceDocumentName}</span>
                    </div>
                    <button 
                      onClick={(e) => handleDelete(e, guide.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex-shrink-0 ${deleteConfirmId === guide.id ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'bg-zinc-800/50 text-zinc-500 hover:text-red-400 hover:bg-zinc-800'}`}
                    >
                      {deleteConfirmId === guide.id ? 'Confirm Delete?' : 'Delete'}
                    </button>
                  </div>
                  <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#52525B', fontSize: '0.75rem' }}>
                      {formatSmartTime(guide.createdAt)}
                    </span>
                    <span style={{ color: '#EA580C', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>Read <ChevronRight size={14}/></span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 2rem', backgroundColor: '#111111', borderRadius: '1rem', border: '1px dashed #27272A' }}>
                <p style={{ color: '#A1A1AA' }}>No study guides found or failed to load.</p>
                <p style={{ color: '#71717A', fontSize: '0.9rem', marginTop: '0.5rem' }}>Go to My Vault, open a document's menu, and click "Generate Study Guide".</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Study Guide View Modal */}
      {isStudyGuideViewOpen && activeStudyGuide && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden break-words whitespace-normal" style={{ backgroundColor: '#111111', border: '1px solid #27272A', borderRadius: '1rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div className="flex justify-between items-start sm:items-center p-4 sm:p-6 border-b border-zinc-800 bg-zinc-900 gap-4" style={{ backgroundColor: '#18181B', borderBottomColor: '#27272A' }}>
              <div className="flex flex-col min-w-0 w-full">
                <h3 className="break-words whitespace-normal min-w-0" style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>📖 Study Guide: {activeStudyGuide.sectionConstraint}</h3>
                <span className="break-words whitespace-normal min-w-0 block" style={{ color: '#71717A', fontSize: '0.85rem' }}>{activeStudyGuide.sourceDocumentName}</span>
              </div>
              <button 
                onClick={() => setIsStudyGuideViewOpen(false)} 
                style={{ background: 'none', border: 'none', color: '#A1A1AA', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            
            <div className="px-3 sm:px-8 py-3 sm:py-8" style={{ flex: 1, overflowY: 'auto', color: '#E4E4E7', lineHeight: '1.6', fontSize: '0.95rem' }}>
              {activeStudyGuide.strategyData ? (
                <StudyEngine guideData={activeStudyGuide.strategyData} guideId={activeStudyGuide.id} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-400 text-center p-8">
                  <p>This guide was generated with an older engine. Please generate a new one for the gamified experience.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

```

### `app\(app)\vault\page.tsx`
```tsx
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { db, collection, addDoc, serverTimestamp, getDocs, query, where, doc, updateDoc, getDoc, arrayUnion, deleteDoc } from '../../../lib/firebase';
import { supabase } from '../../../utils/supabase/client';
import { Pencil, Plus, RefreshCcw, ThumbsUp, ThumbsDown, LayoutGrid, List, Trash2, Calendar, MoreVertical, ChevronLeft, ChevronRight, Save, UploadCloud, File, Play, Loader2, Sparkles, Maximize2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useThrottle } from '../../hooks/useThrottle';
import { checkClash } from '../../../lib/utils/timetable';
import { useUserContext } from '../../../lib/hooks/useUserContext';
import { StudyEngine } from '@/components/StudyEngine';
import StudyAnalyticsDashboard from '@/components/StudyAnalyticsDashboard';


export type VaultChatMessage = { role: 'ai' | 'user' | 'system'; content: string; type?: string; feedback?: 'up' | 'down'; action?: string; payload?: any; };

export default function DashboardPage() {
  const pathname = usePathname();
  const router = useRouter();
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chatList, setChatList] = useState<Array<{ id: string, title: string, updatedAt: any }>>([]);

  // Console state
  const [messages, setMessages] = useState<VaultChatMessage[]>([{ role: 'ai', content: 'Acknowledged. I am >_console. Ask me anything about your uploaded materials.' }]);
  const [consoleInput, setConsoleInput] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState('Locating course notes in Vault...');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isQuerying) {
      setThinkingStatus('Locating course notes in Vault...');
      interval = setInterval(() => {
        setThinkingStatus(prev =>
          prev === 'Locating course notes in Vault...'
            ? 'Parsing context & removing academic jargon...'
            : 'Locating course notes in Vault...'
        );
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isQuerying]);

  const [vaultFiles, setVaultFiles] = useState<any[]>([]);
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editInput, setEditInput] = useState("");

  // Vault state
  const [activeTab, setActiveTab] = useState<'courses' | 'timetable' | 'materials' | 'analytics'>('courses');
  const [timetables, setTimetables] = useState<any[]>([]);
  const [pendingClashes, setPendingClashes] = useState<any[] | null>(null);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  // Courses state
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractingPhaseIndex, setExtractingPhaseIndex] = useState(0);
  const [manualCourseCode, setManualCourseCode] = useState('');
  const [manualCourseTitle, setManualCourseTitle] = useState('');
  const [manualCourseSemester, setManualCourseSemester] = useState('First');
  const [selectedCourseCodes, setSelectedCourseCodes] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Materials state
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<'Note' | 'Assignment'>('Note');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('vaultViewMode') as 'grid' | 'list') || 'grid';
    }
    return 'grid';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vaultViewMode', viewMode);
    }
  }, [viewMode]);
  const [sortBy, setSortBy] = useState<string>('newest');

  // Material Selection State
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [activeFileDropdown, setActiveFileDropdown] = useState<string | null>(null);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

  // Study Guide state
  const [studyGuides, setStudyGuides] = useState<any[]>([]);
  const [isStudyGuideModalOpen, setIsStudyGuideModalOpen] = useState(false);
  const [studyGuideFormat, setStudyGuideFormat] = useState('General Knowledge');
  const [studyGuideTimeframe, setStudyGuideTimeframe] = useState('Standard');
  const [studyGuideLevel, setStudyGuideLevel] = useState('Intermediate');
  const [isGeneratingStudyGuide, setIsGeneratingStudyGuide] = useState(false);
  const [isStudyGuideViewOpen, setIsStudyGuideViewOpen] = useState(false);
  const [activeStudyGuide, setActiveStudyGuide] = useState<any>(null);
  const [openStudyGuideDropdowns, setOpenStudyGuideDropdowns] = useState<string[]>([]);
  const [isTimetableUploading, setIsTimetableUploading] = useState(false);
  const [isExtractingTimetable, setIsExtractingTimetable] = useState(false);
  const [showRawTimetable, setShowRawTimetable] = useState(false);
  const [showManualTimetable, setShowManualTimetable] = useState(false);
  const [manualTimetableCourseCode, setManualTimetableCourseCode] = useState('');
  const [manualTimetableCourseTitle, setManualTimetableCourseTitle] = useState('');
  const [manualTimetableDay, setManualTimetableDay] = useState('Monday');
  const [manualTimetableTime, setManualTimetableTime] = useState('08:00 AM');
  const [manualTimetableEndTime, setManualTimetableEndTime] = useState('09:00 AM');
  const [timetableExtractionError, setTimetableExtractionError] = useState(false);
  const [pendingTimetableFile, setPendingTimetableFile] = useState<File | null>(null);
  const timetableInputRef = useRef<HTMLInputElement>(null);



  const [isDragging, setIsDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [rawFiles, setRawFiles] = useState<any[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [userData, setUserData] = useState<any>({ name: 'Loading...', email: '', uid: '', profile: null });
  const { context, isLoading: isContextLoading } = useUserContext();

  useEffect(() => {
    if (context) {
      setUserData(context);
    } else if (!isContextLoading) {
      setUserData({ name: 'Guest Student', email: 'Not signed in', uid: '', profile: null });
    }
  }, [context, isContextLoading]);

  useEffect(() => {
    if (!context?.uid) {
      setChatList([]);
      setCurrentChatId(null);
      setVaultFiles([]);
      setTimetables([]);
      setStudyGuides([]);
      setIsLoading(false);
      return;
    }

    const fetchVaultData = async () => {
      // Fetch timetables
      try {
        const timetablesSnap = await getDoc(doc(db, 'timetables', context.uid));
        if (timetablesSnap.exists()) {
          const fetchedClasses = (timetablesSnap.data() as any)?.scheduled_classes || [];
          const classesWithIds = fetchedClasses.map((c: any) => c.id ? c : { ...c, id: Date.now().toString(36) + Math.random().toString(36).substring(2) });
          setTimetables(classesWithIds);
        }
      } catch (err) {
        console.error("Error fetching timetables", err);
      }

      // Fetch Vault Files
      try {
        const docsRes = await fetch(`/api/documents?workspaceId=global-vault-001`);
        if (docsRes.ok) {
          const docs = await docsRes.json();
          console.log("📋 Data received by UI on load:", docs);
          setVaultFiles(docs.map((d: any) => ({
            id: d.id,
            fileName: d.name,
            downloadURL: d.url,
            uploadedAt: d.createdAt,
            category: 'Note' // Prisma schema doesn't store category yet
          })));
        }
      } catch (e) { console.error("Failed to fetch documents:", e) }

      // Fetch Chat List
      try {
        const q = query(collection(db, 'chats'), where('userId', '==', context.uid));
        const chatSnap = await getDocs(q);
        const chats = (chatSnap as any).docs.map((d: any) => ({ id: d.id, title: d.data().title, updatedAt: d.data().updatedAt?.toMillis() || 0 }));
        chats.sort((a: any, b: any) => b.updatedAt - a.updatedAt);
        setChatList(chats);
      } catch (error) {
        console.error("Error fetching chats:", error);
      }

      // Fetch Study Guides
      try {
        const resSq = await fetch('/api/study-guides?userId=' + context.uid);
        const sGuides = await resSq.json();
        sGuides.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setStudyGuides(sGuides);
      } catch (e) { console.error(e) }

      setIsLoading(false);
    };

    fetchVaultData();
  }, [context?.uid]);

  const processFiles = (files: File[]) => {
    if (files.length > 20) {
      setUploadStatus('Error: You can only upload a maximum of 20 files at once.');
      setTimeout(() => setUploadStatus(''), 5000);
      return;
    }
    const validFiles = files.filter(f => f.name.match(/\.(pdf|pptx|docx|txt)$/i));
    if (validFiles.length !== files.length) {
      setUploadStatus('Error: Legacy .doc files are not supported. Please save as modern .docx or .pdf.');
      setTimeout(() => setUploadStatus(''), 5000);
      return;
    }
    setPendingFiles((prev) => {
      const combined = [...prev, ...validFiles];
      const unique = combined.filter((file, index, self) =>
        index === self.findIndex((f) => f.name === file.name && f.size === file.size)
      );
      if (unique.length > 20) {
        setUploadStatus('Error: Queue limit reached. Maximum 20 files total.');
        setTimeout(() => setUploadStatus(''), 4000);
        return prev;
      }
      return unique;
    });
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files && e.dataTransfer.files.length > 0) processFiles(Array.from(e.dataTransfer.files)); };
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files.length > 0) processFiles(Array.from(e.target.files)); };

  const handleAddManualCourseCore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCourseCode.trim() || !manualCourseTitle.trim() || !userData.uid) return;

    try {
      const userRef = doc(db, 'users', userData.uid);
      const newCourse = { courseCode: manualCourseCode.toUpperCase(), courseTitle: manualCourseTitle, semester: manualCourseSemester };

      const semesters = [...(userData.profile?.semesters || [])];
      const activeSemIdx = semesters.findIndex((s: any) => s.isActive);
      if (activeSemIdx === -1) return;

      const activeSem = semesters[activeSemIdx];
      if (activeSem.courses.some((c: any) => c.courseCode === newCourse.courseCode)) {
        setToastMessage("Course already exists in this semester!");
        return;
      }

      activeSem.courses.push(newCourse);

      await updateDoc(userRef, { semesters });

      setUserData((prev: any) => ({ ...prev, profile: { ...prev.profile, semesters } }));
      setManualCourseCode('');
      setManualCourseTitle('');
    } catch (err) { console.error(err); }
  };

  const { throttledFunction: handleAddManualCourse, isThrottled: isAddingCourse } = useThrottle(handleAddManualCourseCore);

  const handleDropCourse = async (courseCode: string) => {
    if (!userData.uid) return;
    try {
      const semesters = [...(userData.profile?.semesters || [])];
      const activeSemIdx = semesters.findIndex((s: any) => s.isActive);
      if (activeSemIdx === -1) return;

      semesters[activeSemIdx].courses = semesters[activeSemIdx].courses.filter((c: any) => c.courseCode !== courseCode);

      const userRef = doc(db, 'users', userData.uid);
      await updateDoc(userRef, { semesters });
      setUserData((prev: any) => ({ ...prev, profile: { ...prev.profile, semesters } }));
    } catch (err) { console.error(err); }
  };

  const handleToggleCourseSelection = (courseCode: string) => {
    setSelectedCourseCodes(prev => prev.includes(courseCode) ? prev.filter(c => c !== courseCode) : [...prev, courseCode]);
  };

  const handleToggleSemesterSelection = (semesterCourses: any[], isAllSelected: boolean) => {
    const codes = semesterCourses.map(c => c.courseCode);
    if (isAllSelected) {
      setSelectedCourseCodes(prev => prev.filter(c => !codes.includes(c)));
    } else {
      setSelectedCourseCodes(prev => Array.from(new Set([...prev, ...codes])));
    }
  };

  const handleBulkDeleteCourses = async () => {
    if (selectedCourseCodes.length === 0 || !userData.uid) return;

    try {
      const semesters = [...(userData.profile?.semesters || [])];
      const activeSemIdx = semesters.findIndex((s: any) => s.isActive);
      if (activeSemIdx === -1) return;

      semesters[activeSemIdx].courses = semesters[activeSemIdx].courses.filter((c: any) => !selectedCourseCodes.includes(c.courseCode));

      const userRef = doc(db, 'users', userData.uid);
      await updateDoc(userRef, { semesters });
      setUserData((prev: any) => ({ ...prev, profile: { ...prev.profile, semesters } }));
      setSelectedCourseCodes([]);
    } catch (err) { console.error(err); }
  };

  const processCourseFile = async (file: File) => {
    if (!userData.uid) return;

    setIsExtracting(true);
    try {
      // Step 1: Upload the file to Supabase directly
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}-${Date.now()}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const { data, error } = await supabase.storage
        .from('workspace-files')
        .upload(filePath, file);

      if (error) {
        setToastMessage(`Upload Error: ${error.message}`);
        setIsExtracting(false);
        throw error;
      }

      // Step 2: Wait for response to get the secure file url
      const { data: publicUrlData } = supabase.storage
        .from('workspace-files')
        .getPublicUrl(filePath);

      const fileUrl = publicUrlData.publicUrl;
      console.log("Vault file successfully uploaded to Supabase:", fileUrl);

      const semesters = [...(userData.profile?.semesters || [])];
      const activeSemIdx = semesters.findIndex((s: any) => s.isActive);
      if (activeSemIdx === -1) throw new Error("No active semester found.");

      // Step 3 & 4: Send API request with URL, backend fetches and updates Firestore
      const extractRes = await fetch('/api/engine/extract-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl,
          userId: userData.uid,
          semesterId: semesters[activeSemIdx].semesterId
        })
      });

      let extractedData: any;
      try {
        extractedData = await extractRes.json();
      } catch (e) {
        // Ignore JSON parse error if HTML is returned
      }

      if (!extractRes.ok) {
        throw new Error(extractedData?.error || `API Error: ${extractRes.status} ${extractRes.statusText}`);
      }

      if (extractedData?.courses && Array.isArray(extractedData.courses)) {
        const activeSem = semesters[activeSemIdx];
        const newCourses = extractedData.courses.filter((c: any) => !activeSem.courses.some((ext: any) => ext.courseCode === c.courseCode));
        if (newCourses.length > 0) {
          activeSem.courses = [...activeSem.courses, ...newCourses];
          const userRef = doc(db, 'users', userData.uid);
          await updateDoc(userRef, { semesters });
          setUserData((prev: any) => ({ ...prev, profile: { ...prev.profile, semesters } }));
        }
      }

    } catch (err: any) {
      console.error(err);
      const errorMessage = err.message || "";

      if (errorMessage.includes("503") || errorMessage.includes("Service Unavailable") || errorMessage.includes("fetch failed")) {
        setToastMessage("Our AI is currently analyzing a high volume of course registration forms. Please wait a few seconds and try again.");
      } else if (errorMessage.includes("invalid_document")) {
        setToastMessage("Please upload a valid course form. We couldn't find your courses in this document.");
      } else if (errorMessage.includes("Unexpected token") || errorMessage.includes("JSON")) {
        setToastMessage("We had trouble reading that specific document format. Please try uploading a clearer image or enter the courses manually.");
      } else {
        setToastMessage(errorMessage || "Something went wrong on our end. Please try again or use the manual entry option.");
      }
    } finally {
      setIsExtracting(false);
    }
  };

  const renderErrorCard = (onRetry: () => void) => (
    <div
      style={{
        padding: '2rem',
        backgroundColor: '#7f1d1d', // Deep red
        border: '1px solid #991b1b',
        borderRadius: '1rem',
        textAlign: 'center',
        margin: '1rem 0'
      }}
    >
      <h3 style={{ color: '#fee2e2', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
        Our AI is a bit overwhelmed
      </h3>
      <p style={{ color: '#fecaca', marginBottom: '1.5rem' }}>
        The servers are currently experiencing high traffic. Please wait a moment and try again.
      </p>
      <button
        onClick={onRetry}
        style={{
          backgroundColor: '#f87171',
          color: '#450a0a',
          padding: '0.5rem 1rem',
          borderRadius: '0.5rem',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 'bold'
        }}
      >
        Try Again
      </button>
    </div>
  );

  const handleTimetableUpload = async (e?: React.ChangeEvent<HTMLInputElement>) => {
    const file = e?.target?.files?.[0] || pendingTimetableFile;
    if (!file || !userData.uid) return;

    setTimetableExtractionError(false);
    setIsTimetableUploading(true);
    setIsExtractingTimetable(true);
    try {
      const reader = new FileReader();

      const extractedTimetable = await new Promise<any>((resolve, reject) => {
        reader.readAsDataURL(file);
        reader.onload = async () => {
          try {
            const base64Data = (reader.result as string).split(',')[1];
            const res = await fetch('/api/engine/extract-timetable', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageBase64: base64Data, mimeType: file.type })
            });
            const data = await res.json();
            if (!res.ok) {
              console.error('Full API Error Response:', data);
              reject(new Error(data.error || "Failed to extract timetable"));
              return;
            }
            resolve(data.timetable);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = reject;
      });

      // Since extraction succeeded, we safely upload the file
      let finalTimetableUrl = '';
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}-${Date.now()}.${fileExt}`;
        const filePath = `uploads/${fileName}`;

        const { data, error } = await supabase.storage
          .from('workspace-files')
          .upload(filePath, file);

        if (error) throw error;

        const { data: publicUrlData } = supabase.storage
          .from('workspace-files')
          .getPublicUrl(filePath);

        finalTimetableUrl = publicUrlData.publicUrl;
        console.log("Timetable successfully uploaded to Supabase:", finalTimetableUrl);
      } catch (err: any) {
        console.error("Supabase Upload Error:", err);
        setToastMessage(`Timetable image upload failed: ${err.message}`);
        setIsTimetableUploading(false);
        return;
      }

      const semesters = [...(userData.profile?.semesters || [])];
      const activeSemIdx = semesters.findIndex((s: any) => s.isActive);

      if (finalTimetableUrl && activeSemIdx !== -1) {
        semesters[activeSemIdx].timetableUrl = finalTimetableUrl;
        const userRef = doc(db, 'users', userData.uid);
        await updateDoc(userRef, { semesters });
        setUserData((prev: any) => ({ ...prev, profile: { ...prev.profile, semesters } }));
      }

      if (extractedTimetable && Array.isArray(extractedTimetable)) {
        const currentTimetables = [...timetables];
        const newClasses = [];
        const clashingClasses = [];

        for (const cls of extractedTimetable) {
          const formattedClass = {
            id: Date.now().toString(36) + Math.random().toString(36).substring(2),
            courseCode: cls.courseCode || '',
            courseTitle: cls.courseTitle || '',
            day: cls.day || '',
            startTime: cls.startTime || cls.time || '',
            endTime: cls.endTime || '',
            location: cls.location || cls.venue || ''
          };

          if (!formattedClass.courseCode || !formattedClass.day || !formattedClass.startTime) continue;

          const clashResult = checkClash(formattedClass, currentTimetables);
          if (clashResult.hasClash) {
            clashingClasses.push({ ...formattedClass, clashingWith: clashResult.clashingCourse });
          } else {
            newClasses.push(formattedClass);
            currentTimetables.push(formattedClass);
          }
        }

        if (newClasses.length > 0) {
          const ttRef = doc(db, 'timetables', userData.uid);
          const ttSnap = await getDoc(ttRef);
          if (ttSnap.exists()) {
            await updateDoc(ttRef, { scheduled_classes: currentTimetables });
          } else {
            const { setDoc } = await import('../../../lib/firebase');
            await setDoc(ttRef, { scheduled_classes: currentTimetables });
          }
          setTimetables(currentTimetables);
        }

        if (clashingClasses.length > 0) {
          setPendingClashes(clashingClasses);
        } else if (newClasses.length > 0) {
          setToastMessage("Timetable extracted and saved successfully!");
        }
      }

    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("400")) {
        setToastMessage("Extraction Failed: The image format is not supported or the document is invalid.");
      } else if (err.message?.includes("No timetable detected")) {
        setToastMessage("Extraction Failed: We couldn't detect a valid timetable in that document. Please try a different image or file.");
      } else {
        setTimetableExtractionError(true);
        setPendingTimetableFile(file || null);
      }
    } finally {
      setIsTimetableUploading(false);
      setIsExtractingTimetable(false);
      if (timetableInputRef.current) timetableInputRef.current.value = '';
    }
  };

  const handleOverrideClashes = async () => {
    if (!pendingClashes || !userData.uid) return;
    try {
      const currentTimetables = [...timetables, ...pendingClashes.map(c => {
        const { clashingWith, ...rest } = c;
        return { ...rest, id: rest.id || Date.now().toString(36) + Math.random().toString(36).substring(2) };
      })];

      const ttRef = doc(db, 'timetables', userData.uid);
      await updateDoc(ttRef, { scheduled_classes: currentTimetables });
      setTimetables(currentTimetables);
      setPendingClashes(null);
      setToastMessage("Clashing classes overridden and saved.");
    } catch (err) {
      console.error(err);
    }
  };

  const handleDiscardClashes = () => {
    setPendingClashes(null);
  };

  const handleAddManualTimetableCore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData.uid || !manualTimetableCourseCode.trim() || !manualTimetableCourseTitle.trim()) return;

    try {
      const newClass = {
        id: editingClassId || (Date.now().toString(36) + Math.random().toString(36).substring(2)),
        day: manualTimetableDay,
        startTime: manualTimetableTime,
        endTime: manualTimetableEndTime,
        courseCode: manualTimetableCourseCode.toUpperCase(),
        courseTitle: manualTimetableCourseTitle,
        location: ''
      };

      let newScheduledClasses;
      if (editingClassId) {
        newScheduledClasses = timetables.map(cls => cls.id === editingClassId ? newClass : cls);
      } else {
        newScheduledClasses = [...timetables, newClass];
      }

      const ttRef = doc(db, 'timetables', userData.uid);
      const ttSnap = await getDoc(ttRef);
      if (ttSnap.exists()) {
        await updateDoc(ttRef, { scheduled_classes: newScheduledClasses });
      } else {
        const { setDoc } = await import('../../../lib/firebase');
        await setDoc(ttRef, { scheduled_classes: newScheduledClasses });
      }

      setTimetables(newScheduledClasses);
      setManualTimetableCourseCode('');
      setManualTimetableCourseTitle('');
      setEditingClassId(null);
      setShowManualTimetable(false);
      setToastMessage(editingClassId ? "Class updated successfully!" : "Class added successfully!");
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditClass = (cls: any) => {
    setManualTimetableCourseCode(cls.courseCode);
    setManualTimetableCourseTitle(cls.courseTitle || '');
    setManualTimetableDay(cls.day);
    setManualTimetableTime(cls.startTime);
    setManualTimetableEndTime(cls.endTime || '');
    setEditingClassId(cls.id);
    setShowManualTimetable(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteClass = async (id: string) => {
    if (!userData.uid) return;
    try {
      const newScheduledClasses = timetables.filter(c => c.id !== id);
      const ttRef = doc(db, 'timetables', userData.uid);
      await updateDoc(ttRef, { scheduled_classes: newScheduledClasses });
      setTimetables(newScheduledClasses);
      setSelectedClasses(prev => prev.filter(selectedId => selectedId !== id));
      setToastMessage("Class deleted successfully.");
    } catch (err) {
      console.error(err);
      setToastMessage("Failed to delete class.");
    }
  };

  const handleBulkDelete = async () => {
    if (!userData.uid || selectedClasses.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedClasses.length} classes?`)) return;
    try {
      const newScheduledClasses = timetables.filter(c => !selectedClasses.includes(c.id));
      const ttRef = doc(db, 'timetables', userData.uid);
      await updateDoc(ttRef, { scheduled_classes: newScheduledClasses });
      setTimetables(newScheduledClasses);
      setSelectedClasses([]);
      setToastMessage(`Deleted ${selectedClasses.length} classes.`);
    } catch (err) {
      console.error(err);
      setToastMessage("Failed to delete selected classes.");
    }
  };

  const toggleClassSelection = (id: string) => {
    setSelectedClasses(prev => prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]);
  };

  const handleClearTimetableClick = () => {
    setIsClearModalOpen(true);
  };

  const handleClearTimetableConfirm = async () => {
    if (!userData.uid) return;
    try {
      const ttRef = doc(db, 'timetables', userData.uid);
      await updateDoc(ttRef, { scheduled_classes: [] });
      setTimetables([]);
      setSelectedClasses([]);
      setEditingClassId(null);
      setIsClearModalOpen(false);
      setToastMessage("Timetable cleared successfully.");
    } catch (err) {
      console.error(err);
      setToastMessage("Failed to clear timetable.");
    }
  };

  const { throttledFunction: handleAddManualTimetable, isThrottled: isAddingTimetable } = useThrottle(handleAddManualTimetableCore);

  const handleOpenStudyGuideModal = (file: any) => {
    setActiveFileDropdown(null);
    if (!file.downloadURL) {
      setToastMessage("Cannot generate study guide: Document must be uploaded first.");
      return;
    }
    setActiveDocumentId(file.id);
    setStudyGuideFormat('General Knowledge');
    setStudyGuideTimeframe('Standard');
    setStudyGuideLevel('Intermediate');
    setIsStudyGuideModalOpen(true);
  };

  const handleGenerateStudyGuide = async () => {
    const payloadConstraint = `Format: ${studyGuideFormat} | Timeframe: ${studyGuideTimeframe} | Level: ${studyGuideLevel}`;
    const file = vaultFiles.find(f => f.id === activeDocumentId);
    if (!file) return;

    setIsGeneratingStudyGuide(true);

    try {
      const res = await fetch('/api/engine/generate-study-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl: file.downloadURL, sectionConstraint: payloadConstraint })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to generate study guide.");

      const newGuide = {
        userId: userData.uid,
        sourceDocumentId: file.id,
        sourceDocumentName: file.fileName,
        sectionConstraint: payloadConstraint,
        strategyData: data.studyGuide,
        createdAt: serverTimestamp()
      };

      const docRef = await fetch('/api/study-guides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGuide)
      });
      const fullGuide = await docRef.json();

      setStudyGuides(prev => [fullGuide, ...prev]);

      setIsStudyGuideModalOpen(false);
      setActiveStudyGuide(fullGuide);
      setIsStudyGuideViewOpen(true);

    } catch (err: any) {
      console.error(err);
      setToastMessage(err.message || "Failed to generate study guide.");
    } finally {
      setIsGeneratingStudyGuide(false);
    }
  };

  const handleToggleMaterialSelection = (id: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedMaterials(prev => [...prev, id]);
    } else {
      setSelectedMaterials(prev => prev.filter(m => m !== id));
    }
  };

  const handleSelectAllMaterials = (filteredFiles: any[], isSelectAll: boolean) => {
    if (isSelectAll) {
      const allIds = filteredFiles.map(f => f.id);
      setSelectedMaterials(allIds);
    } else {
      setSelectedMaterials([]);
    }
  };

  const handleBulkDeleteMaterials = async () => {
    if (!userData.uid || selectedMaterials.length === 0) return;
    try {
      // 1. Delete all selected documents from Firebase using the correct collection 'vault_files'
      const deletePromises = selectedMaterials.map(id => fetch('/api/documents?id=' + id, { method: 'DELETE' }));
      await Promise.all(deletePromises);

      // 2. Clear local state only after DB deletion succeeds
      setVaultFiles(prev => prev.filter(m => !selectedMaterials.includes(m.id)));
      setSelectedMaterials([]);
      setToastMessage(`Successfully deleted ${selectedMaterials.length} materials.`);
    } catch (err) {
      console.error("Failed to sync deletion with database:", err);
      setToastMessage("Could not delete materials. Please check your connection.");
    }
  };

  const handleDeleteVaultFile = async (id: string) => {
    setActiveFileDropdown(null);
    if (!userData.uid) return;
    try {
      // 1. Delete single document from Firebase using the correct collection 'vault_files'
      await fetch('/api/documents?id=' + id, { method: 'DELETE' });

      // 2. Clear local state only after DB deletion succeeds
      setVaultFiles(prev => prev.filter(m => m.id !== id));
      setToastMessage("File deleted successfully from your Vault.");
    } catch (err) {
      console.error("Failed to sync deletion with database:", err);
      setToastMessage("Could not delete file. Please check your connection.");
    }
  };

  const handleUploadToVaultCore = async () => {
    if (pendingFiles.length === 0 || !userData.uid || isUploading) return;
    setIsUploading(true); setUploadProgress(0); setUploadStatus('Scanning Vault for existing records...');

    try {
      const res = await fetch('/api/documents');
      const existingFiles = await res.json();

      const newFilesToUpload: File[] = [];
      const duplicateFiles: File[] = [];

      pendingFiles.forEach(file => {
        const isDuplicate = existingFiles.some((ef: any) => ef.fileName === file.name && ef.fileSize === file.size);
        if (isDuplicate) duplicateFiles.push(file);
        else newFilesToUpload.push(file);
      });

      if (newFilesToUpload.length === 0) {
        setUploadStatus('All selected files are already in your Vault.');
        setTimeout(() => { setPendingFiles([]); setIsUploading(false); setUploadStatus(''); setUploadProgress(0); }, 3000);
        return;
      }

      if (duplicateFiles.length > 0) setUploadStatus(`Skipped ${duplicateFiles.length} duplicates. Transmitting new files...`);
      else setUploadStatus('Initializing Secure Transfer...');

      setUploadStatus('Uploading to Secure Storage...');

      const uploadedFiles = [];
      for (let i = 0; i < newFilesToUpload.length; i++) {
        const file = newFilesToUpload[i];
        setUploadProgress(((i + 1) / newFilesToUpload.length) * 100);

        const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-');
        const uniqueSuffix = Math.random().toString(36).substring(2, 8);
        const filePath = `uploads/${uniqueSuffix}-${cleanFileName}`;

        const { data, error } = await supabase.storage
          .from('workspace-files')
          .upload(filePath, file);

        if (error) {
          console.error("Supabase Upload Error:", error);
          setUploadStatus(`Error: ${error.message || 'Supabase Upload failed.'}`);
          setIsUploading(false); setUploadProgress(0);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from('workspace-files')
          .getPublicUrl(filePath);

        const fileUrl = publicUrlData.publicUrl;
        console.log("✅ File uploaded to Bucket:", fileUrl);

        try {
          const dbResponse = await fetch('/api/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: file.name, // Save the original pretty name to Postgres
              url: fileUrl,
              workspaceId: null, // Force Global Vault inside the API
              fileSize: file.size
            })
          });

          // 1. Read as text first to prevent JSON parse crashes on HTML error pages
          const responseText = await dbResponse.text();
          if (!dbResponse.ok) {
            console.error(`❌ Database Save Failed (Status: ${dbResponse.status})`);

            try {
              const errData = JSON.parse(responseText);
              import('sonner').then(mod => mod.toast.error(errData.error || "Failed to save to database."));
            } catch (e) {
              alert("Failed to save to database. Check console for details.");
            }

            setUploadStatus('Upload failed.');
            continue;
          }

          // 2. If OK, it is safe to parse
          const data = JSON.parse(responseText);
          console.log("✅ File saved to Database successfully!", data);

          // Trigger the UI to re-fetch the document list immediately
          const docsRes = await fetch(`/api/documents?workspaceId=global-vault-001`);
          if (docsRes.ok) {
            const docs = await docsRes.json();
            console.log("📋 Data received by UI after upload:", docs);
            setVaultFiles(docs.map((d: any) => ({
              id: d.id,
              fileName: d.name,
              downloadURL: d.url,
              uploadedAt: d.createdAt,
              category: 'Note'
            })));
          }

        } catch (error) {
          console.error("❌ Network Error during Database Save:", error);
          setUploadStatus('Warning: Transfer succeeded, but database save failed.');
        }
      }

      setUploadStatus('Transfer Complete. Files Secured.');
      router.refresh();
      setTimeout(() => { setPendingFiles([]); setIsUploading(false); setUploadStatus(''); setUploadProgress(0); }, 3000);
    } catch (error: any) {
      setUploadStatus(`Error: ${error.message || 'Upload connection failed.'}`);
      setIsUploading(false); setUploadProgress(0);
    }
  };

  const { throttledFunction: handleUploadToVault, isThrottled: isUploadingThrottled } = useThrottle(handleUploadToVaultCore);

  const handleInitiateAnalysis = async () => {
    if (!userData.uid) return;
    setAnalysisStatus('Scanning Vault...');

    try {
      const q = query(collection(db, 'vault_files'), where('userId', '==', userData.uid), where('status', '==', 'raw'));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setAnalysisStatus('All files in your Vault are already analyzed!');
        setTimeout(() => setAnalysisStatus(''), 4000);
        return;
      }

      const files = querySnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

      // NEW: Sort files by newest first (reverse chronological)
      files.sort((a: any, b: any) => {
        const timeA = a.uploadedAt?.seconds || 0;
        const timeB = b.uploadedAt?.seconds || 0;
        return timeB - timeA;
      });

      setRawFiles(files);
      setSelectedFileIds([]);
      setIsSelectionMode(true);
      setAnalysisStatus('');
    } catch (error) {
      setAnalysisStatus('Error accessing Vault records.');
      setTimeout(() => setAnalysisStatus(''), 4000);
    }
  };

  const toggleFileSelection = (id: string) => {
    setSelectedFileIds(prev =>
      prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id]
    );
  };

  const handleProcessSelected = async () => {
    if (selectedFileIds.length === 0 || isAnalyzing) return;

    setIsAnalyzing(true);
    setIsSelectionMode(false);

    const filesToProcess = rawFiles.filter(f => selectedFileIds.includes(f.id));
    setAnalysisStatus(`Igniting AI Engine for ${filesToProcess.length} file(s)...`);

    let successCount = 0;

    try {
      for (const file of filesToProcess) {
        setAnalysisStatus(`Extracting: ${file.fileName}...`);

        const response = await fetch('/api/engine/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileUrl: file.downloadURL,
            fileName: file.fileName,
            docId: file.id,
            userId: userData.uid
          })
        });

        const textResponse = await response.text();
        let result;

        try {
          result = JSON.parse(textResponse);
        } catch (parseError) {
          throw new Error(`The AI Engine experienced a critical failure reading "${file.fileName}". The file might be corrupted or too complex.`);
        }

        if (response.ok && result.success) {
          const docRef = doc(db, 'vault_files', file.id);
          await updateDoc(docRef, { status: 'analyzed' });
          successCount++;
        } else {
          throw new Error(result.error || `Failed to process ${file.fileName}. Please try again.`);
        }
      }

      setAnalysisStatus(`Analysis Complete. ${successCount}/${filesToProcess.length} integrated into AI Brain.`);
      setTimeout(() => setAnalysisStatus(''), 8000);
      setIsAnalyzing(false);

    } catch (error: any) {
      setAnalysisStatus(`${error.message}`);
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    const fetchChatHistory = async () => {
      if (!currentChatId) {
        setMessages([{ role: 'ai', content: 'Acknowledged. I am >_console. Ask me anything about your uploaded materials.' }]);
        return;
      }
      try {
        const chatDoc = await getDoc(doc(db, 'chats', currentChatId));
        if (chatDoc.exists()) {
          const data = chatDoc.data();
          if ((data as any).messages && (data as any).messages.length > 0) {
            setMessages((data as any).messages);
          } else {
            setMessages([{ role: 'ai', content: 'Acknowledged. I am >_console. Ask me anything about your uploaded materials.' }]);
          }
        }
      } catch (error) {
        console.error("Failed to load chat", error);
      }
    };

    fetchChatHistory();
  }, [currentChatId]);

  const handleLoadChat = (chatId: string) => {
    setCurrentChatId(chatId);
    setIsConsoleOpen(true);
  };

  const submitQuery = async (userMessage: string, historyPrefix?: Array<VaultChatMessage>) => {
    if (isQuerying) return;
    const baseMessages = historyPrefix || messages;
    const history = baseMessages.filter(m => m.type !== 'action_required').slice(-10);

    const newUserMsg: VaultChatMessage = { role: 'user', content: userMessage };
    const updatedMessages = [...baseMessages, newUserMsg];

    setMessages(updatedMessages);
    setIsQuerying(true);

    if (isLoading || isContextLoading || !context) {
      setMessages([...updatedMessages, { role: 'ai', content: 'Syncing Academic Data... Please wait.' }]);
      setIsQuerying(false);
      return;
    }

    try {
      const userProfilePayload = {
        name: context.name,
        school: context.school,
        department: context.department,
        courses: context.profile?.semesters?.find((s: any) => s.isActive)?.courses || []
      };

      const response = await fetch('/api/engine/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.filter(m => m.type !== 'action_required').slice(-10),
          activeFileId: activeDocumentId,
          sessionId: currentChatId,
          userProfile: userProfilePayload
        })
      });
      const contentType = response.headers.get('content-type');
      let finalMessages: VaultChatMessage[] = [];

      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();

        if (data.error) {
          setMessages([...updatedMessages, { role: 'ai', content: `System Error: ${data.error}` }]);
          setIsQuerying(false);
          return;
        }

        let newAiMsg: VaultChatMessage;
        if (data.type === 'action_required') {
          let content = '';
          if (data.action === 'add_course') {
            content = `I can add ${data.payload.courseCode} - ${data.payload.courseTitle} to your ${data.payload.semester} semester.`;
          } else if (data.action === 'delete_course') {
            content = `I can remove ${data.payload.courseCode} from your active semester.`;
          } else if (data.action === 'add_to_timetable') {
            content = `I can add ${data.payload.courseCode} to your timetable on ${data.payload.day} from ${data.payload.startTime} to ${data.payload.endTime}.`;
          }
          newAiMsg = {
            role: 'ai',
            content,
            type: 'action_required',
            action: data.action,
            payload: data.payload,
            ...(data.error ? { error: data.error } : {})
          } as any;
        } else {
          newAiMsg = { role: 'ai', content: data.answer };
        }

        finalMessages = [...updatedMessages, newAiMsg];
        setMessages(finalMessages);
      } else if (response.body) {
        // Stream text token by token
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let aiContent = '';
        let newAiMsg: VaultChatMessage = { role: 'ai', content: '' };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          aiContent += decoder.decode(value, { stream: true });
          newAiMsg.content = aiContent;
          setMessages([...updatedMessages, newAiMsg]);
        }
        finalMessages = [...updatedMessages, newAiMsg];
      } else {
        setIsQuerying(false);
        return;
      }

      // Persist to Firestore
      if (currentChatId) {
        const chatRef = doc(db, 'chats', currentChatId);
        await updateDoc(chatRef, {
          messages: finalMessages,
          updatedAt: serverTimestamp()
        });
        setChatList(prev => prev.map(c => c.id === currentChatId ? { ...c, updatedAt: Date.now() } : c).sort((a, b) => b.updatedAt - a.updatedAt));
      } else {
        let title = userMessage.split(' ').slice(0, 4).join(' ') + '...';

        const newChatDoc = await addDoc(collection(db, 'chats'), {
          userId: userData.uid,
          title: title,
          messages: finalMessages,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        setCurrentChatId(newChatDoc.id);
        setChatList(prev => [{ id: newChatDoc.id, title, updatedAt: Date.now() }, ...prev]);

        // Generate title asynchronously
        fetch('/api/engine/title', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: userMessage })
        })
          .then(res => res.json())
          .then(data => {
            if (data.title) {
              updateDoc(doc(db, 'chats', newChatDoc.id), { title: data.title });
              setChatList(prev => prev.map(c => c.id === newChatDoc.id ? { ...c, title: data.title } : c));
            }
          })
          .catch(e => console.error("Async title generation failed", e));
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', content: "Error: Could not reach the brain." }]);
    } finally {
      setIsQuerying(false);
    }
  };

  const executeAction = async (msgIndex: number, action: string, payload: any, confirm: boolean) => {
    if (!userData.uid || !userData.profile || !userData.profile.semesters) return;

    if (!confirm) {
      setMessages(prev => [...prev, { role: 'ai', content: 'Action cancelled.' }]);
      return;
    }

    try {
      const semesters = [...userData.profile.semesters];
      const activeSemIdx = semesters.findIndex((s: any) => s.isActive);
      if (activeSemIdx === -1) {
        setToastMessage("No active semester found.");
        return;
      }

      const activeSem = semesters[activeSemIdx];

      if (action === 'add_course') {
        if (!activeSem.courses.some((c: any) => c.courseCode === payload.courseCode)) {
          activeSem.courses.push({ courseCode: payload.courseCode, courseTitle: payload.courseTitle, semester: payload.semester });
        }
      } else if (action === 'delete_course') {
        activeSem.courses = activeSem.courses.filter((c: any) => c.courseCode !== payload.courseCode);
      } else if (action === 'add_to_timetable') {
        const newClass = {
          day: payload.day,
          startTime: payload.startTime,
          endTime: payload.endTime,
          courseCode: payload.courseCode.toUpperCase(),
          courseTitle: '',
          location: ''
        };
        const newScheduledClasses = [...timetables, newClass];
        const ttRef = doc(db, 'timetables', userData.uid);
        const ttSnap = await getDoc(ttRef);
        if (ttSnap.exists()) {
          await updateDoc(ttRef, { scheduled_classes: newScheduledClasses });
        } else {
          const { setDoc } = await import('../../../lib/firebase');
          await setDoc(ttRef, { scheduled_classes: newScheduledClasses });
        }
        setTimetables(newScheduledClasses);
      }

      const userRef = doc(db, 'users', userData.uid);
      await updateDoc(userRef, { semesters });
      setUserData((prev: any) => ({ ...prev, profile: { ...prev.profile, semesters } }));

      setMessages(prev => [...prev, { role: 'ai', content: 'Action completed successfully.' }]);
    } catch (err: any) {
      console.error(err);
      setToastMessage("Failed to execute action.");
    }
  };

  const handleConsoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consoleInput.trim() || isQuerying) return;
    const msg = consoleInput;
    setConsoleInput('');
    await submitQuery(msg);
  };

  const handleEditSubmit = (index: number) => {
    if (!editInput.trim() || isQuerying) return;
    const historyPrefix = messages.slice(0, index);
    setEditingMessageIndex(null);
    submitQuery(editInput, historyPrefix);
  };

  const handleRegenerate = (index: number) => {
    if (isQuerying) return;
    const userMsg = messages[index - 1];
    if (userMsg && userMsg.role === 'user') {
      const historyPrefix = messages.slice(0, index - 1);
      submitQuery(userMsg.content, historyPrefix);
    }
  };

  const handleFeedback = async (index: number, type: 'up' | 'down') => {
    const newMessages = [...messages];
    newMessages[index] = { ...newMessages[index], feedback: type };
    setMessages(newMessages);

    if (currentChatId) {
      try {
        await updateDoc(doc(db, 'chats', currentChatId), {
          messages: newMessages
        });
      } catch (e) { console.error("Failed to save feedback", e); }
    }
  };

  const extractionPhases = ['Uploading document...', 'Scanning document structure...', 'Analyzing course codes...', 'Optimizing for high traffic...', 'Finalizing extraction...'];

  useEffect(() => {
    let interval: any;
    if (isExtracting) {
      setExtractingPhaseIndex(0);
      interval = setInterval(() => {
        setExtractingPhaseIndex(prev => (prev < extractionPhases.length - 1 ? prev + 1 : prev));
      }, 3000);
    } else {
      setExtractingPhaseIndex(0);
    }
    return () => clearInterval(interval);
  }, [isExtracting]);

  return (
    <>
      

      <div className="flex flex-col h-full w-full">
        
        
        
        <div className="flex-1 flex flex-col h-full overflow-hidden p-6" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1, overflowY: 'auto' }}>
          

          <header style={{ borderBottom: '1px solid #27272A', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '2rem', margin: 0, letterSpacing: '-0.05em' }}>My Vault</h1>
              <p style={{ color: '#A1A1AA', margin: '0.5rem 0 0 0', fontSize: '1rem' }}>Your Student Operating System.</p>
            </div>
          </header>

          <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #27272A', paddingBottom: '1rem' }}>
            <button onClick={() => setActiveTab('courses')} style={{ background: 'none', border: 'none', color: activeTab === 'courses' ? 'white' : '#A1A1AA', fontWeight: activeTab === 'courses' ? 'bold' : 'normal', cursor: 'pointer', fontSize: '1rem', padding: '0.5rem 1rem', borderBottom: activeTab === 'courses' ? '2px solid #EA580C' : '2px solid transparent' }}>My Courses</button>
            <button onClick={() => setActiveTab('timetable')} style={{ background: 'none', border: 'none', color: activeTab === 'timetable' ? 'white' : '#A1A1AA', fontWeight: activeTab === 'timetable' ? 'bold' : 'normal', cursor: 'pointer', fontSize: '1rem', padding: '0.5rem 1rem', borderBottom: activeTab === 'timetable' ? '2px solid #EA580C' : '2px solid transparent' }}>My Timetable</button>
            <button onClick={() => setActiveTab('materials')} style={{ background: 'none', border: 'none', color: activeTab === 'materials' ? 'white' : '#A1A1AA', fontWeight: activeTab === 'materials' ? 'bold' : 'normal', cursor: 'pointer', fontSize: '1rem', padding: '0.5rem 1rem', borderBottom: activeTab === 'materials' ? '2px solid #EA580C' : '2px solid transparent' }}>Lecture Materials</button>
            <button onClick={() => setActiveTab('analytics')} style={{ background: 'none', border: 'none', color: activeTab === 'analytics' ? 'white' : '#A1A1AA', fontWeight: activeTab === 'analytics' ? 'bold' : 'normal', cursor: 'pointer', fontSize: '1rem', padding: '0.5rem 1rem', borderBottom: activeTab === 'analytics' ? '2px solid #EA580C' : '2px solid transparent' }}>Deep Work</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
            {activeTab === 'courses' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                <div style={{ backgroundColor: '#111111', padding: '2rem', borderRadius: '1rem', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>Extract from Portal</h3>
                  <p style={{ color: '#A1A1AA', fontSize: '0.9rem', margin: 0 }}>Upload a screenshot of your course registration to auto-fill.</p>

                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        processCourseFile(e.dataTransfer.files[0]);
                      }
                    }}
                    style={{ backgroundColor: isDragging ? '#27272A' : '#18181B', padding: '1.5rem', borderRadius: '0.5rem', border: isDragging ? '1px dashed #EA580C' : '1px dashed #3F3F46', textAlign: 'center', position: 'relative', transition: 'all 0.2s' }}
                  >
                    <input type="file" accept="image/*,application/pdf" onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        processCourseFile(e.target.files[0]);
                      }
                    }} style={{ opacity: 0, position: 'absolute', inset: 0, cursor: 'pointer' }} />
                    <span style={{ color: isDragging ? '#EA580C' : 'white', fontWeight: 'bold' }}>{isDragging ? 'Drop form here...' : '+ Select Registration Form'}</span>
                    <p style={{ color: '#71717A', fontSize: '0.75rem', margin: '0.5rem 0 0 0' }}>PNG, JPG, PDF</p>
                  </div>

                  {isExtracting && (
                    <div style={{ backgroundColor: '#27272A', padding: '1.5rem', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '16px', height: '16px', border: '2px solid #EA580C', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                        <span style={{ color: '#E4E4E7', fontWeight: '500', fontSize: '0.95rem' }}>
                          {extractionPhases[extractingPhaseIndex]}
                        </span>
                      </div>

                      <div style={{ width: '100%', height: '4px', backgroundColor: '#3F3F46', borderRadius: '2px', overflow: 'hidden', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '30%', backgroundColor: '#EA580C', borderRadius: '2px', animation: 'indeterminate-bar 1.5s infinite ease-in-out' }}></div>
                      </div>

                      <p style={{ color: '#71717A', fontSize: '0.75rem', margin: 0 }}>
                        This usually takes a few seconds, but may take up to 30 seconds during high network traffic.
                      </p>
                    </div>
                  )}
                </div>

                <div style={{ backgroundColor: '#111111', padding: '2rem', borderRadius: '1rem', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>Manual Entry</h3>
                  <form onSubmit={handleAddManualCourse} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <input type="text" placeholder="Course Code (e.g., CS101)" value={manualCourseCode} onChange={e => setManualCourseCode(e.target.value)} style={{ backgroundColor: '#18181B', color: 'white', border: '1px solid #27272A', padding: '0.75rem', borderRadius: '0.5rem', outline: 'none' }} />
                    <input type="text" placeholder="Course Title" value={manualCourseTitle} onChange={e => setManualCourseTitle(e.target.value)} style={{ backgroundColor: '#18181B', color: 'white', border: '1px solid #27272A', padding: '0.75rem', borderRadius: '0.5rem', outline: 'none' }} />
                    <select value={manualCourseSemester} onChange={e => setManualCourseSemester(e.target.value)} style={{ backgroundColor: '#18181B', color: 'white', border: '1px solid #27272A', padding: '0.75rem', borderRadius: '0.5rem', outline: 'none' }}>
                      <option value="First">First Semester</option>
                      <option value="Second">Second Semester</option>
                    </select>
                    <button type="submit" style={{ backgroundColor: '#EA580C', color: 'white', border: 'none', padding: '0.75rem', borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer' }}>Add Course</button>
                  </form>
                </div>

                {toastMessage && (
                  <div style={{ gridColumn: '1 / -1', backgroundColor: 'rgba(220, 38, 38, 0.1)', border: '1px solid #DC2626', color: '#FCA5A5', padding: '1rem', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{toastMessage}</span>
                    <button onClick={() => setToastMessage(null)} style={{ background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                  </div>
                )}

                <div className="w-full max-w-full" style={{ gridColumn: '1 / -1', backgroundColor: '#111111', padding: '2rem', borderRadius: '1rem', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>My Registered Courses</h3>
                    {selectedCourseCodes.length > 0 && (
                      <button onClick={handleBulkDeleteCourses} style={{ backgroundColor: '#DC2626', color: 'white', border: '1px solid #B91C1C', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Trash2 size={16} /> Delete Selected ({selectedCourseCodes.length})
                      </button>
                    )}
                  </div>
                  <div className="w-full max-w-full" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {isLoading ? (
                      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', marginTop: '0.5rem' }}>
                        {/* Injecting raw CSS to bypass Tailwind completely */}
                        <style>{`
                          @keyframes wavePulse {
                            0%, 100% { opacity: 1; }
                            50% { opacity: 0.3; }
                          }
                        `}</style>

                        {[1, 2, 3].map((n, index) => (
                          <div
                            key={n}
                            style={{
                              width: '100%',
                              height: '68px',
                              backgroundColor: '#374151',
                              borderRadius: '0.75rem',
                              marginBottom: '0.75rem',
                              border: '1px solid #4b5563',
                              /* The Sequential Animation Logic */
                              animation: 'wavePulse 1.5s infinite ease-in-out',
                              animationDelay: `${index * 0.2}s`
                            }}
                          ></div>
                        ))}
                      </div>
                    ) : (() => {
                      const activeSem = userData.profile?.semesters?.find((s: any) => s.isActive);
                      if (!activeSem || !activeSem.courses) return <p style={{ color: '#A1A1AA' }}>No courses added yet for the active academic year.</p>;

                      const firstSemesterCourses = activeSem.courses.filter((c: any) => c.semester === 'First');
                      const secondSemesterCourses = activeSem.courses.filter((c: any) => c.semester === 'Second');

                      return (
                        <>
                          <div className="w-full max-w-full">
                            {firstSemesterCourses.length > 0 ? (
                              <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', borderBottom: '1px solid #27272A', paddingBottom: '0.5rem' }}>
                                  <input type="checkbox" checked={firstSemesterCourses.every((c: any) => selectedCourseCodes.includes(c.courseCode))} onChange={(e) => handleToggleSemesterSelection(firstSemesterCourses, !e.target.checked)} style={{ accentColor: '#EA580C', width: '1rem', height: '1rem', cursor: 'pointer' }} title="Select All First Semester" />
                                  <h4 style={{ color: '#A1A1AA', fontSize: '1rem', margin: 0, fontWeight: 'normal' }}>First Semester</h4>
                                </div>
                                <div className="w-full max-w-full" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                  {firstSemesterCourses.map((course: any, index: number) => {
                                    const isSelected = selectedCourseCodes.includes(course.courseCode);

                                    return (
                                      <div
                                        key={course.courseCode || index}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          width: '100%',
                                          padding: '1rem',
                                          marginBottom: '0.75rem',
                                          borderRadius: '0.75rem',
                                          border: '1px solid #374151',
                                          backgroundColor: '#1f2937' /* Forces the dark gray */
                                        }}
                                      >

                                        {/* Left: Checkbox and Course Code */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => handleToggleCourseSelection(course.courseCode)}
                                            style={{ width: '1.25rem', height: '1.25rem', accentColor: '#f97316', cursor: 'pointer' }}
                                          />
                                          <span style={{ fontWeight: 'bold', fontSize: '1.125rem', color: '#f97316' }}>
                                            {course.courseCode}
                                          </span>
                                        </div>

                                        {/* Right: Trash Icon */}
                                        <button
                                          onClick={() => handleDropCourse(course.courseCode)}
                                          style={{ padding: '0.5rem', color: '#9ca3af', background: 'transparent', border: 'none', cursor: 'pointer' }}
                                        >
                                          <Trash2 size={20} />
                                        </button>

                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            ) : (
                              <p style={{ color: '#71717A', fontSize: '0.9rem', fontStyle: 'italic' }}>No First Semester courses added yet.</p>
                            )}
                          </div>
                          <div className="w-full max-w-full">
                            {secondSemesterCourses.length > 0 ? (
                              <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', borderBottom: '1px solid #27272A', paddingBottom: '0.5rem' }}>
                                  <input type="checkbox" checked={secondSemesterCourses.every((c: any) => selectedCourseCodes.includes(c.courseCode))} onChange={(e) => handleToggleSemesterSelection(secondSemesterCourses, !e.target.checked)} style={{ accentColor: '#EA580C', width: '1rem', height: '1rem', cursor: 'pointer' }} title="Select All Second Semester" />
                                  <h4 style={{ color: '#A1A1AA', fontSize: '1rem', margin: 0, fontWeight: 'normal' }}>Second Semester</h4>
                                </div>
                                <div className="w-full max-w-full" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                  {secondSemesterCourses.map((course: any, index: number) => {
                                    const isSelected = selectedCourseCodes.includes(course.courseCode);

                                    return (
                                      <div
                                        key={course.courseCode || index}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          width: '100%',
                                          padding: '1rem',
                                          marginBottom: '0.75rem',
                                          borderRadius: '0.75rem',
                                          border: '1px solid #374151',
                                          backgroundColor: '#1f2937' /* Forces the dark gray */
                                        }}
                                      >

                                        {/* Left: Checkbox and Course Code */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => handleToggleCourseSelection(course.courseCode)}
                                            style={{ width: '1.25rem', height: '1.25rem', accentColor: '#f97316', cursor: 'pointer' }}
                                          />
                                          <span style={{ fontWeight: 'bold', fontSize: '1.125rem', color: '#f97316' }}>
                                            {course.courseCode}
                                          </span>
                                        </div>

                                        {/* Right: Trash Icon */}
                                        <button
                                          onClick={() => handleDropCourse(course.courseCode)}
                                          style={{ padding: '0.5rem', color: '#9ca3af', background: 'transparent', border: 'none', cursor: 'pointer' }}
                                        >
                                          <Trash2 size={20} />
                                        </button>

                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            ) : (
                              <p style={{ color: '#71717A', fontSize: '0.9rem', fontStyle: 'italic' }}>No Second Semester courses added yet.</p>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'timetable' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ backgroundColor: '#111111', padding: '2rem', borderRadius: '1rem', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Calendar className="w-5 h-5 mr-2 text-neutral-400" />
                    <h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>My Timetable</h3>
                  </div>
                  <p style={{ color: '#A1A1AA', fontSize: '0.9rem', margin: 0 }}>Upload your class schedule to keep it handy.</p>

                  <input type="file" accept=".pdf,image/*,.docx,.csv,.xls,.xlsx" ref={timetableInputRef} onChange={handleTimetableUpload} style={{ display: 'none' }} />

                  {timetableExtractionError && renderErrorCard(() => handleTimetableUpload())}

                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                      onClick={() => timetableInputRef.current?.click()}
                      disabled={isTimetableUploading || isExtractingTimetable}
                      style={{
                        backgroundColor: '#f97316',
                        color: '#ffffff',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '0.5rem',
                        fontWeight: '600',
                        border: 'none',
                        cursor: 'pointer',
                        opacity: (isTimetableUploading || isExtractingTimetable) ? 0.5 : 1
                      }}
                    >
                      {/* If timetable exists, show 'Replace', otherwise show 'Add' */}
                      {isExtractingTimetable ? 'Analyzing timetable...' : isTimetableUploading ? 'Uploading...' : (timetables.length > 0 ? "Replace timetable" : "Add timetable")}
                    </button>
                    <button onClick={() => setShowManualTimetable(!showManualTimetable)} style={{ backgroundColor: showManualTimetable ? '#27272A' : '#18181B', color: 'white', border: '1px solid #27272A', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}>
                      {showManualTimetable ? 'Cancel Manual Entry' : 'Add Manually'}
                    </button>
                    {timetables.length > 0 && (
                      <button onClick={handleClearTimetableClick} style={{ backgroundColor: 'transparent', color: '#EF4444', border: '1px solid #EF4444', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}>
                        Clear Timetable
                      </button>
                    )}
                  </div>

                  {showManualTimetable && (
                    <form onSubmit={handleAddManualTimetable} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', backgroundColor: '#18181B', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #27272A', width: '100%', textAlign: 'left', marginTop: '1rem' }}>
                      <input type="text" placeholder="Course Code (e.g., CS101)" value={manualTimetableCourseCode} onChange={e => setManualTimetableCourseCode(e.target.value)} style={{ backgroundColor: '#111111', color: 'white', border: '1px solid #27272A', padding: '0.75rem', borderRadius: '0.5rem', outline: 'none' }} required />
                      <input type="text" placeholder="Course Title" value={manualTimetableCourseTitle} onChange={e => setManualTimetableCourseTitle(e.target.value)} style={{ backgroundColor: '#111111', color: 'white', border: '1px solid #27272A', padding: '0.75rem', borderRadius: '0.5rem', outline: 'none' }} required />
                      <select value={manualTimetableDay} onChange={e => setManualTimetableDay(e.target.value)} style={{ backgroundColor: '#111111', color: 'white', border: '1px solid #27272A', padding: '0.75rem', borderRadius: '0.5rem', outline: 'none' }}>
                        <option value="Monday">Monday</option>
                        <option value="Tuesday">Tuesday</option>
                        <option value="Wednesday">Wednesday</option>
                        <option value="Thursday">Thursday</option>
                        <option value="Friday">Friday</option>
                        <option value="Saturday">Saturday</option>
                      </select>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <select title="Start Time" value={manualTimetableTime} onChange={e => setManualTimetableTime(e.target.value)} style={{ flex: 1, backgroundColor: '#111111', color: 'white', border: '1px solid #27272A', padding: '0.75rem', borderRadius: '0.5rem', outline: 'none' }}>
                          {Array.from({ length: 15 }).map((_, i) => {
                            const hour = i + 7; // 7 AM to 9 PM
                            const ampm = hour >= 12 ? 'PM' : 'AM';
                            const displayHour = hour > 12 ? hour - 12 : hour;
                            const t1 = `${displayHour < 10 ? '0' : ''}${displayHour}:00 ${ampm}`;
                            const t2 = `${displayHour < 10 ? '0' : ''}${displayHour}:30 ${ampm}`;
                            return <React.Fragment key={i}><option value={t1}>{t1}</option><option value={t2}>{t2}</option></React.Fragment>;
                          })}
                        </select>
                        <select title="End Time" value={manualTimetableEndTime} onChange={e => setManualTimetableEndTime(e.target.value)} style={{ flex: 1, backgroundColor: '#111111', color: 'white', border: '1px solid #27272A', padding: '0.75rem', borderRadius: '0.5rem', outline: 'none' }}>
                          {Array.from({ length: 15 }).map((_, i) => {
                            const hour = i + 7; // 7 AM to 9 PM
                            const ampm = hour >= 12 ? 'PM' : 'AM';
                            const displayHour = hour > 12 ? hour - 12 : hour;
                            const t1 = `${displayHour < 10 ? '0' : ''}${displayHour}:00 ${ampm}`;
                            const t2 = `${displayHour < 10 ? '0' : ''}${displayHour}:30 ${ampm}`;
                            return <React.Fragment key={i}><option value={t1}>{t1}</option><option value={t2}>{t2}</option></React.Fragment>;
                          })}
                        </select>
                      </div>
                      <button type="submit" style={{ gridColumn: '1 / -1', backgroundColor: '#EA580C', color: 'white', border: 'none', padding: '0.75rem', borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer' }}>{editingClassId ? 'Update Class' : 'Save Class'}</button>
                    </form>
                  )}
                </div>

                {(() => {
                  const activeSem = userData.profile?.semesters?.find((s: any) => s.isActive);

                  return (
                    <>
                      {pendingClashes && pendingClashes.length > 0 && (
                        <div style={{ backgroundColor: 'rgba(153, 27, 27, 0.1)', border: '1px solid #DC2626', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <h4 style={{ color: '#FCA5A5', margin: 0, fontSize: '1.1rem', fontWeight: 'bold' }}>⚠️ Clashes Detected in Upload</h4>
                          <p style={{ color: '#E4E4E7', fontSize: '0.9rem', margin: 0 }}>The following extracted classes clash with your existing timetable:</p>
                          <ul style={{ listStyleType: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {pendingClashes.map((c, i) => (
                              <li key={i} style={{ color: '#A1A1AA', fontSize: '0.85rem', backgroundColor: '#18181B', padding: '0.5rem 1rem', borderRadius: '0.25rem' }}>
                                <span style={{ color: '#EA580C', fontWeight: 'bold' }}>{c.courseCode}</span> on {c.day} at {c.startTime} (Clashes with {c.clashingWith})
                              </li>
                            ))}
                          </ul>
                          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                            <button onClick={handleDiscardClashes} style={{ backgroundColor: 'transparent', color: '#A1A1AA', border: '1px solid #3F3F46', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>Discard Clashes</button>
                            <button onClick={handleOverrideClashes} style={{ backgroundColor: '#DC2626', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>Override & Save All</button>
                          </div>
                        </div>
                      )}
                      {timetables.length > 0 && !showRawTimetable && (() => {
                        // Compute clashes
                        const timetableWithClashes = timetables.map((cls: any, i: number, arr: any[]) => {
                          const isClash = arr.some((otherCls, j) => i !== j && otherCls.day.toLowerCase() === cls.day.toLowerCase() && otherCls.startTime === cls.startTime);
                          return { ...cls, isClash };
                        });

                        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                              <button onClick={() => setShowRawTimetable(true)} style={{ background: 'none', border: '1px solid #3F3F46', color: '#A1A1AA', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', transition: 'color 0.2s' }}>
                                View Raw File
                              </button>
                            </div>
                            {selectedClasses.length > 0 && (
                              <div style={{ backgroundColor: '#18181B', border: '1px solid #EA580C', borderRadius: '0.75rem', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                                <span style={{ color: 'white', fontWeight: 'bold' }}>{selectedClasses.length} Selected</span>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                  <button onClick={() => setSelectedClasses(timetables.map(c => c.id))} style={{ background: 'transparent', color: '#A1A1AA', border: '1px solid #3F3F46', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>Select All</button>
                                  <button onClick={() => setSelectedClasses([])} style={{ background: 'transparent', color: '#A1A1AA', border: '1px solid #3F3F46', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>Deselect All</button>
                                  <button onClick={handleBulkDelete} style={{ backgroundColor: '#DC2626', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>Delete Selected</button>
                                </div>
                              </div>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                              {days.map(day => {
                                const classesForDay = timetableWithClashes.filter((c: any) => c.day.toLowerCase() === day.toLowerCase());
                                if (classesForDay.length === 0) return null;
                                return (
                                  <div key={day} style={{ backgroundColor: '#111111', border: '1px solid #27272A', borderRadius: '0.75rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <h4 style={{ color: 'white', margin: 0, fontSize: '1.1rem', borderBottom: '1px solid #27272A', paddingBottom: '0.5rem' }}>{day}</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                      {classesForDay.map((cls: any, i: number) => (
                                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', backgroundColor: cls.isClash ? 'rgba(153, 27, 27, 0.1)' : '#18181B', padding: '0.75rem', borderRadius: '0.5rem', border: cls.isClash ? '1px solid rgba(153, 27, 27, 0.5)' : (selectedClasses.includes(cls.id) ? '1px solid #EA580C' : '1px solid #27272A'), transition: 'all 0.2s' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                                              <input type="checkbox" checked={selectedClasses.includes(cls.id)} onChange={() => toggleClassSelection(cls.id)} style={{ accentColor: '#EA580C', cursor: 'pointer', marginTop: '0.2rem' }} />
                                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ color: '#EA580C', fontWeight: 'bold', fontSize: '0.95rem' }}>{cls.courseCode}</span>
                                                {cls.courseTitle && <span className="text-sm text-neutral-400">{cls.courseTitle}</span>}
                                              </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                                              {cls.location || cls.venue ? (
                                                <span style={{ color: '#A1A1AA', fontSize: '0.75rem' }}>{cls.location || cls.venue}</span>
                                              ) : (
                                                <span style={{ color: '#71717A', fontSize: '0.75rem', padding: '0.1rem 0.4rem', border: '1px solid #27272A', borderRadius: '0.25rem' }}>[ TBD ]</span>
                                              )}
                                              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                                                <button onClick={() => handleEditClass(cls)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0 }} title="Edit">
                                                  <Pencil className="w-3.5 h-3.5 hover:text-white transition-colors" />
                                                </button>
                                                <button onClick={() => handleDeleteClass(cls.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0 }} title="Delete">
                                                  <Trash2 className="w-3.5 h-3.5 hover:text-red-500 transition-colors" />
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                            <span style={{ color: cls.isClash ? '#ef4444' : '#71717A', fontSize: '0.75rem', fontWeight: cls.isClash ? 'bold' : 'normal' }}>{cls.startTime} {cls.endTime ? `- ${cls.endTime}` : ''}</span>
                                            {cls.isClash && (
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                <span style={{ fontSize: '0.75rem' }} title="Schedule Clash">⚠️</span>
                                                <span className="text-xs font-bold text-red-500 uppercase tracking-wider">CLASH</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  );
                })()}

                {(() => {
                  const activeSem = userData.profile?.semesters?.find((s: any) => s.isActive);
                  if (activeSem && activeSem.timetableUrl) {
                    const isPdf = activeSem.timetableUrl.toLowerCase().endsWith('.pdf');
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {timetables.length > 0 && showRawTimetable && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowRawTimetable(false)} style={{ background: 'none', border: '1px solid #3F3F46', color: '#A1A1AA', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', transition: 'color 0.2s' }}>
                              Back to Dashboard
                            </button>
                          </div>
                        )}
                        <div style={{ backgroundColor: '#111111', padding: '1rem', borderRadius: '1rem', border: '1px solid #27272A', display: 'flex', justifyContent: 'center' }}>
                          {isPdf ? (
                            <iframe src={activeSem.timetableUrl} width="100%" height="600px" style={{ border: 'none', borderRadius: '0.5rem' }} title="Timetable PDF" />
                          ) : (
                            <div style={{ color: '#A1A1AA', padding: '2rem', textAlign: 'center' }}>
                              Raw preview not available for this file format.
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div style={{ backgroundColor: '#111111', padding: '3rem', borderRadius: '1rem', border: '1px dashed #27272A', textAlign: 'center' }}>
                      <p style={{ color: '#A1A1AA' }}>No timetable uploaded for the active semester.</p>
                    </div>
                  );
                })()}
              </div>
            )}

            {activeTab === 'materials' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
                <div style={{ backgroundColor: '#111111', padding: '2rem', borderRadius: '1rem', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>Upload Material</h3>
                  <p style={{ color: '#A1A1AA', fontSize: '0.9rem', margin: 0 }}>Upload lecture slides or PDFs to build your knowledge base.</p>
                  <input type="file" disabled={isUploading} multiple accept=".pdf,.pptx,.docx,.txt" ref={fileInputRef} onChange={handleFileInput} style={{ display: 'none' }} />
                  <div
                    onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}
                    style={{ backgroundColor: isDragging ? '#27272A' : '#18181B', padding: '1.5rem', borderRadius: '0.5rem', border: isDragging ? '1px dashed #EA580C' : '1px dashed #3F3F46', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginTop: 'auto', opacity: isUploading ? 0.5 : 1, pointerEvents: isUploading ? 'none' : 'auto' }}
                  >
                    <span className="mobile-text" style={{ color: isDragging ? '#EA580C' : 'white', fontWeight: '500' }}>+ Tap to Stage Files</span>
                    <span className="desktop-text" style={{ color: isDragging ? '#EA580C' : 'white', fontWeight: '500' }}>{isDragging ? 'Drop files now...' : '+ Click or Drag Files to Stage'}</span>
                    <span style={{ color: '#71717A', fontSize: '0.75rem' }}>PDF, PPTX, DOCX, TXT (Max 20)</span>
                  </div>

                  {(pendingFiles.length > 0 || uploadStatus) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <div className="file-list-container" style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.25rem' }}>
                        {pendingFiles.map((file, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#18181B', padding: '0.5rem 0.75rem', borderRadius: '0.25rem', fontSize: '0.8rem', border: '1px solid #27272A' }}>
                            <span style={{ color: '#D4D4D8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{file.name}</span>
                            <span style={{ color: '#71717A' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                          </div>
                        ))}
                      </div>

                      {pendingFiles.length > 0 && !isUploading && (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                          <select
                            value={selectedCategory}
                            onChange={(e: any) => setSelectedCategory(e.target.value)}
                            className="transition-colors hover:border-[#EA580C] focus:border-[#EA580C]"
                            style={{ backgroundColor: '#18181B', color: 'white', border: '1px solid #3F3F46', padding: '0.5rem', borderRadius: '0.25rem', outline: 'none', flex: 1 }}
                          >
                            <option value="Note">Note</option>
                            <option value="Assignment">Assignment</option>
                          </select>
                          <button
                            onClick={handleUploadToVault} disabled={isUploading}
                            style={{ backgroundColor: '#EA580C', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.25rem', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', transition: 'all 0.2s' }}
                          >
                            Upload to Vault
                          </button>
                        </div>
                      )}

                      {isUploading && (
                        <div style={{ width: '100%', backgroundColor: '#27272A', borderRadius: '0.25rem', height: '6px', overflow: 'hidden', marginTop: '0.25rem' }}>
                          <div style={{ width: `${uploadProgress}%`, backgroundColor: '#EA580C', height: '100%', transition: 'width 0.2s ease' }}></div>
                        </div>
                      )}

                      {uploadStatus ? (
                        <div style={{ backgroundColor: uploadStatus.includes('Error') || uploadStatus.includes('Warning') || uploadStatus.includes('Limit') ? '#7F1D1D' : '#27272A', color: uploadStatus.includes('Error') || uploadStatus.includes('Warning') || uploadStatus.includes('Limit') ? '#FECACA' : '#A1A1AA', padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'center', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                          {uploadStatus}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                {(() => {
                  const filteredSortedFiles = [...vaultFiles].sort((a, b) => {
                    if (sortBy === 'newest') return (b.uploadedAt?.seconds || 0) - (a.uploadedAt?.seconds || 0);
                    if (sortBy === 'oldest') return (a.uploadedAt?.seconds || 0) - (b.uploadedAt?.seconds || 0);
                    if (sortBy === 'nameAsc') return (a.fileName || '').localeCompare(b.fileName || '');
                    if (sortBy === 'nameDesc') return (b.fileName || '').localeCompare(a.fileName || '');
                    if (sortBy === 'category') return (a.category || '').localeCompare(b.category || '');
                    return 0;
                  });
                  const allSelected = filteredSortedFiles.length > 0 && filteredSortedFiles.every(f => selectedMaterials.includes(f.id));

                  return (
                    <div style={{ backgroundColor: '#111111', padding: '2rem', borderRadius: '1rem', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '1rem', gridColumn: '1 / -1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                          <h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>My Files</h3>
                          {filteredSortedFiles.length > 0 && (
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#A1A1AA', fontSize: '0.85rem' }}>
                              <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={(e) => handleSelectAllMaterials(filteredSortedFiles, e.target.checked)}
                                style={{ accentColor: '#EA580C', width: '1rem', height: '1rem', cursor: 'pointer' }}
                              />
                              Select All
                            </label>
                          )}
                          {selectedMaterials.length > 0 && (
                            <button onClick={handleBulkDeleteMaterials} style={{ backgroundColor: '#DC2626', color: 'white', border: '1px solid #B91C1C', padding: '0.4rem 0.75rem', borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s' }}>
                              <Trash2 size={14} /> Delete Selected ({selectedMaterials.length})
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                          <select value={sortBy} onChange={(e: any) => setSortBy(e.target.value)} style={{ backgroundColor: '#18181B', color: 'white', border: '1px solid #3F3F46', padding: '0.5rem', borderRadius: '0.25rem', outline: 'none', fontSize: '0.85rem' }}>
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                            <option value="nameAsc">Name (A-Z)</option>
                            <option value="nameDesc">Name (Z-A)</option>
                            <option value="category">Category</option>
                          </select>
                          <div style={{ display: 'flex', backgroundColor: '#18181B', border: '1px solid #3F3F46', borderRadius: '0.25rem', overflow: 'hidden' }}>
                            <button onClick={() => setViewMode('list')} style={{ backgroundColor: viewMode === 'list' ? '#27272A' : 'transparent', color: viewMode === 'list' ? 'white' : '#71717A', border: 'none', padding: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <List size={16} />
                            </button>
                            <button onClick={() => setViewMode('grid')} style={{ backgroundColor: viewMode === 'grid' ? '#27272A' : 'transparent', color: viewMode === 'grid' ? 'white' : '#71717A', border: 'none', padding: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <LayoutGrid size={16} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: viewMode === 'grid' ? 'grid' : 'flex', flexDirection: viewMode === 'list' ? 'column' : 'row', gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(200px, 1fr))' : 'none', gap: viewMode === 'grid' ? '1rem' : '0.5rem', flex: 1, overflowY: 'auto' }}>
                        {isLoading ? (
                          <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(200px, 1fr))' : '1fr', gap: '1rem', width: '100%' }}>
                            <style>{`
                              @keyframes wavePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
                            `}</style>
                            {[1, 2, 3, 4].map((n, index) => (
                              <div
                                key={n}
                                style={{
                                  height: viewMode === 'grid' ? '150px' : '68px',
                                  backgroundColor: '#27272A',
                                  borderRadius: '0.75rem',
                                  animation: 'wavePulse 1.5s infinite ease-in-out',
                                  animationDelay: `${index * 0.2}s`
                                }}
                              ></div>
                            ))}
                          </div>
                        ) : (
                          <>
                            {filteredSortedFiles.map(file => (
                              viewMode === 'list' ? (
                                <div key={file.id} className="w-full px-3 sm:px-4" style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#18181B', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid #27272A', gap: '0.5rem' }}>
                                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 justify-between items-start sm:items-center w-full min-w-0">
                                    <div className="flex flex-row min-w-0 w-full items-center gap-3">
                                      <input
                                        type="checkbox"
                                        checked={selectedMaterials.includes(file.id)}
                                        onChange={(e) => handleToggleMaterialSelection(file.id, e.target.checked)}
                                        style={{ accentColor: '#EA580C', width: '1.1rem', height: '1.1rem', cursor: 'pointer', flexShrink: 0 }}
                                      />
                                      <div className="flex flex-col min-w-0 w-full">
                                        <a href={`/lecture-materials/${file.id}`} className="hover:text-[#EA580C] hover:underline break-words whitespace-normal min-w-0 block transition-colors" style={{ color: 'white', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{file.fileName}</a>
                                        <span style={{ color: '#71717A', fontSize: '0.75rem' }}>{(file.fileSize ? (file.fileSize / 1024 / 1024).toFixed(2) : '0.00')} MB</span>
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                      <span style={{ backgroundColor: '#27272A', color: '#A1A1AA', fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '1rem', border: '1px solid #3F3F46' }}>{file.category || 'Note'}</span>
                                      <div style={{ position: 'relative' }}>
                                        <button onClick={() => setActiveFileDropdown(activeFileDropdown === file.id ? null : file.id)} style={{ background: 'none', border: 'none', color: '#A1A1AA', cursor: 'pointer', padding: '0.25rem' }}>
                                          <MoreVertical size={16} />
                                        </button>
                                        {activeFileDropdown === file.id && (
                                          <div className="absolute right-0 mt-2 origin-top-right z-50" style={{ top: '100%', backgroundColor: '#27272A', border: '1px solid #3F3F46', borderRadius: '0.5rem', padding: '0.5rem', display: 'flex', flexDirection: 'column', minWidth: '180px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}>
                                            <button onClick={() => handleOpenStudyGuideModal(file)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', color: 'white', padding: '0.5rem', cursor: 'pointer', textAlign: 'left', borderRadius: '0.25rem', fontSize: '0.85rem' }} className="hover:bg-zinc-600 transition-colors">
                                              📚 Generate Study Guide
                                            </button>
                                            <button onClick={() => handleDeleteVaultFile(file.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', color: '#EF4444', padding: '0.5rem', cursor: 'pointer', textAlign: 'left', borderRadius: '0.25rem', fontSize: '0.85rem', marginTop: '0.25rem' }} className="hover:bg-zinc-600 transition-colors">
                                              <Trash2 size={14} /> Delete File
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {studyGuides.filter(g => g.sourceDocumentId === file.id).length > 0 && (
                                    <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed #3F3F46' }}>
                                      <button onClick={() => setOpenStudyGuideDropdowns(prev => prev.includes(file.id) ? prev.filter(id => id !== file.id) : [...prev, file.id])} style={{ background: 'none', border: 'none', color: '#A1A1AA', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: 0 }}>
                                        {openStudyGuideDropdowns.includes(file.id) ? <ChevronLeft size={14} style={{ transform: 'rotate(-90deg)' }} /> : <ChevronRight size={14} />} Study Guides ({studyGuides.filter(g => g.sourceDocumentId === file.id).length})
                                      </button>
                                      {openStudyGuideDropdowns.includes(file.id) && (
                                        <div className="flex flex-col min-w-0 w-full" style={{ gap: '0.25rem', marginTop: '0.5rem', paddingLeft: '1rem' }}>
                                          {studyGuides.filter(g => g.sourceDocumentId === file.id).map(guide => (
                                            <button key={guide.id} onClick={() => { setActiveStudyGuide(guide); setIsStudyGuideViewOpen(true); }} className="hover:underline break-words whitespace-normal min-w-0 w-full text-left" style={{ background: 'none', border: 'none', color: '#60A5FA', fontSize: '0.8rem', cursor: 'pointer', padding: '0.25rem 0' }}>
                                              📖 Study Guide: {guide.sectionConstraint}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div key={file.id} className="w-full px-3 sm:px-4" style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#18181B', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #27272A', gap: '0.5rem', position: 'relative' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <input
                                        type="checkbox"
                                        checked={selectedMaterials.includes(file.id)}
                                        onChange={(e) => handleToggleMaterialSelection(file.id, e.target.checked)}
                                        style={{ accentColor: '#EA580C', width: '1.1rem', height: '1.1rem', cursor: 'pointer' }}
                                      />
                                      <span style={{ backgroundColor: '#27272A', color: '#A1A1AA', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '1rem', alignSelf: 'flex-start', border: '1px solid #3F3F46' }}>{file.category || 'Note'}</span>
                                    </div>
                                    <div style={{ position: 'relative' }}>
                                      <button onClick={() => setActiveFileDropdown(activeFileDropdown === file.id ? null : file.id)} style={{ background: 'none', border: 'none', color: '#A1A1AA', cursor: 'pointer', padding: 0 }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" /></svg>
                                      </button>
                                      {activeFileDropdown === file.id && (
                                        <div className="absolute right-0 mt-2 origin-top-right z-50" style={{ top: '100%', width: '200px', backgroundColor: '#27272A', border: '1px solid #3F3F46', borderRadius: '0.5rem', padding: '0.25rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}>
                                          <button onClick={() => handleOpenStudyGuideModal(file)} style={{ width: '100%', textAlign: 'left', padding: '0.5rem', background: 'none', border: 'none', color: '#F9FAFB', cursor: 'pointer', borderRadius: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3F3F46'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                            📚 Generate Study Guide
                                          </button>
                                          <button onClick={() => handleDeleteVaultFile(file.id)} style={{ width: '100%', textAlign: 'left', padding: '0.5rem', background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', borderRadius: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', marginTop: '0.25rem' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3F3F46'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                            Delete File
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <a href={`/lecture-materials/${file.id}`} className="hover:text-[#EA580C] hover:underline break-words whitespace-normal min-w-0 block transition-colors" style={{ color: 'white', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }} title={file.fileName}>{file.fileName}</a>
                                  <span style={{ color: '#71717A', fontSize: '0.75rem', marginTop: 'auto' }}>{(file.fileSize ? (file.fileSize / 1024 / 1024).toFixed(2) : '0.00')} MB</span>

                                  {studyGuides.filter(g => g.sourceDocumentId === file.id).length > 0 && (
                                    <div style={{ marginTop: '0.25rem', paddingTop: '0.5rem', borderTop: '1px dashed #3F3F46' }}>
                                      <button onClick={() => setOpenStudyGuideDropdowns(prev => prev.includes(file.id) ? prev.filter(id => id !== file.id) : [...prev, file.id])} style={{ background: 'none', border: 'none', color: '#A1A1AA', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: 0 }}>
                                        {openStudyGuideDropdowns.includes(file.id) ? <ChevronLeft size={12} style={{ transform: 'rotate(-90deg)' }} /> : <ChevronRight size={12} />} Study Guides ({studyGuides.filter(g => g.sourceDocumentId === file.id).length})
                                      </button>
                                      {openStudyGuideDropdowns.includes(file.id) && (
                                        <div className="flex flex-col min-w-0 w-full" style={{ gap: '0.25rem', marginTop: '0.5rem', paddingLeft: '0.5rem' }}>
                                          {studyGuides.filter(g => g.sourceDocumentId === file.id).map(guide => (
                                            <button key={guide.id} onClick={() => { setActiveStudyGuide(guide); setIsStudyGuideViewOpen(true); }} className="hover:underline truncate min-w-0 w-full text-left" style={{ background: 'none', border: 'none', color: '#60A5FA', fontSize: '0.75rem', cursor: 'pointer', padding: '0.1rem 0' }} title={`Study Guide: ${guide.sectionConstraint}`}>
                                              📖 {guide.sectionConstraint}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )
                            ))}
                            {vaultFiles.length === 0 && <p style={{ color: '#A1A1AA', fontSize: '0.9rem', gridColumn: '1 / -1' }}>Your vault is empty.</p>}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            
            {activeTab === 'analytics' && (
              <StudyAnalyticsDashboard />
            )}
          </div>
        </div>
        <aside className={`console-panel ${isConsoleOpen ? 'open' : ''}`}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #27272A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: '#EA580C', fontWeight: 'bold' }}>&gt;_</span>
              <span style={{ fontWeight: 'bold', letterSpacing: '0.05em' }}>console</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  setCurrentChatId(null);
                  setToastMessage("Fresh session started");
                }}
                className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center' }}
                title="New Chat"
              >
                <Plus className="w-5 h-5" />
              </button>
              <button className="menu-btn lg:hidden" onClick={() => setIsConsoleOpen(false)}>✕</button>
            </div>
          </div>
          <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ color: '#A1A1AA', fontSize: '0.75rem', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px dashed #27272A', paddingBottom: '0.5rem' }}>Secure Session Established</div>

            {messages.map((msg, i) => {
              const isError = msg.content.startsWith("Error:") || msg.content.includes("Failed to query the AI brain.");

              const lowerMsg = msg.content.toLowerCase();
              const needsDisambiguation = lowerMsg.includes("which specific") || lowerMsg.includes("which document") || lowerMsg.includes("tell me which");

              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: msg.role === 'user' ? '#A1A1AA' : isError ? '#EF4444' : '#EA580C', fontWeight: 'bold', fontSize: '0.85rem' }}>
                      {msg.role === 'user' ? userData.name.split(' ')[0] : '>_console'}
                    </span>
                    {msg.role === 'user' && (
                      <button onClick={() => { setEditingMessageIndex(i); setEditInput(msg.content); }} className="hover:text-white transition-colors cursor-pointer" style={{ background: 'none', border: 'none', color: '#9CA3AF', padding: 0 }} title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {editingMessageIndex === i ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', maxWidth: '90%', alignItems: 'flex-end' }}>
                      <textarea
                        value={editInput}
                        onChange={e => setEditInput(e.target.value)}
                        style={{ width: '100%', backgroundColor: '#27272A', color: 'white', border: '1px solid #EA580C', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.9rem', outline: 'none', resize: 'vertical', minHeight: '80px' }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => setEditingMessageIndex(null)} style={{ background: 'transparent', color: '#A1A1AA', border: '1px solid #3F3F46', padding: '0.4rem 0.75rem', borderRadius: '0.25rem', fontSize: '0.8rem', cursor: 'pointer' }}>Cancel</button>
                        <button onClick={() => handleEditSubmit(i)} style={{ backgroundColor: '#EA580C', color: 'white', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '0.25rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold' }}>Save & Resubmit</button>
                      </div>
                    </div>
                  ) : msg.type === 'action_required' ? (
                    <div className="w-full max-w-md overflow-hidden break-words whitespace-pre-wrap" style={{ backgroundColor: '#18181B', padding: '1rem', borderRadius: '0.5rem', border: (msg as any).error?.status === 'clash' ? '1px solid #DC2626' : '1px solid #EA580C', color: '#E4E4E7', fontSize: '0.9rem' }}>
                      <p className="min-w-0 break-words" style={{ margin: '0 0 1rem 0', fontWeight: 'bold' }}>{msg.content}</p>
                      {(msg as any).error?.status === 'clash' && (
                        <p style={{ margin: '0 0 1rem 0', color: '#FCA5A5', fontWeight: 'bold', fontSize: '0.85rem' }}>
                          ⚠️ WARNING: This class clashes with {(msg as any).error.existingCourse}.
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button onClick={() => executeAction(i, msg.action!, msg.payload, false)} style={{ background: 'transparent', color: '#A1A1AA', border: '1px solid #3F3F46', padding: '0.5rem 1rem', borderRadius: '0.25rem', fontSize: '0.85rem', cursor: 'pointer' }}>Cancel</button>
                        {(msg as any).error?.status === 'clash' ? (
                          <button onClick={() => executeAction(i, msg.action!, msg.payload, true)} style={{ backgroundColor: '#DC2626', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.25rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 'bold' }}>Override & Save</button>
                        ) : (
                          <button onClick={() => executeAction(i, msg.action!, msg.payload, true)} style={{ backgroundColor: '#EA580C', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.25rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 'bold' }}>Confirm Action</button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-full sm:max-w-[90%] break-words whitespace-pre-wrap min-w-0" style={{
                      backgroundColor: msg.role === 'user' ? '#27272A' : isError ? '#450a0a' : '#18181B',
                      padding: '1rem',
                      borderRadius: '0.5rem',
                      border: isError ? '1px solid #7f1d1d' : '1px solid #27272A',
                      color: isError ? '#fca5a5' : '#E4E4E7',
                      fontSize: '0.9rem',
                      lineHeight: '1.6'
                    }}>
                      {msg.content}
                    </div>
                  )}

                  {/* Smart Vault Selector for Disambiguation */}
                  {msg.role === 'ai' && needsDisambiguation && !isError && i === messages.length - 1 && vaultFiles.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem', maxWidth: '90%' }}>
                      {vaultFiles.map(file => (
                        <button
                          key={file.id}
                          disabled={isQuerying}
                          onClick={() => submitQuery(`Please use the document: ${file.fileName} as the context.`)}
                          style={{ backgroundColor: '#18181B', color: '#A1A1AA', border: '1px solid #EA580C', padding: '0.4rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', cursor: isQuerying ? 'not-allowed' : 'pointer', opacity: isQuerying ? 0.5 : 1, transition: 'all 0.2s', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}
                        >
                          📄 {file.fileName}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* AI Action Buttons & Controls */}
                  {msg.role === 'ai' && msg.type !== 'action_required' && !isError && i > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem', alignItems: 'center' }}>
                      {!needsDisambiguation && (
                        <>

                          <button disabled={isQuerying} onClick={() => submitQuery("Please extract and summarize the absolute key terms from the response above into a bulleted list.")} style={{ backgroundColor: '#27272A', color: '#A1A1AA', border: '1px solid #3F3F46', padding: '0.4rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', cursor: isQuerying ? 'not-allowed' : 'pointer', opacity: isQuerying ? 0.5 : 1, transition: 'all 0.2s' }}>
                            📝 Summarize Key Terms
                          </button>
                          <button disabled={isQuerying} onClick={() => submitQuery("Please generate a quick 3-question multiple-choice quiz based on the information above to test my understanding.")} style={{ backgroundColor: '#27272A', color: '#A1A1AA', border: '1px solid #3F3F46', padding: '0.4rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', cursor: isQuerying ? 'not-allowed' : 'pointer', opacity: isQuerying ? 0.5 : 1, transition: 'all 0.2s' }}>
                            🧠 Generate Practice Quiz
                          </button>
                        </>
                      )}
                      <div style={{ flex: 1 }}></div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button disabled={isQuerying} onClick={() => handleRegenerate(i)} className="hover:text-white transition-colors cursor-pointer" style={{ background: 'none', border: 'none', color: '#9CA3AF', opacity: isQuerying ? 0.5 : 1, padding: 0 }} title="Regenerate">
                          <RefreshCcw className="w-3.5 h-3.5" />
                        </button>
                        <button disabled={isQuerying} onClick={() => handleFeedback(i, 'up')} className="hover:text-green-500 transition-colors cursor-pointer" style={{ background: 'none', border: 'none', color: msg.feedback === 'up' ? '#22C55E' : '#9CA3AF', opacity: isQuerying ? 0.5 : 1, padding: 0 }} title="Good response">
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button disabled={isQuerying} onClick={() => handleFeedback(i, 'down')} className="hover:text-red-500 transition-colors cursor-pointer" style={{ background: 'none', border: 'none', color: msg.feedback === 'down' ? '#EF4444' : '#9CA3AF', opacity: isQuerying ? 0.5 : 1, padding: 0 }} title="Bad response">
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {isQuerying && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
                <span style={{ color: '#EA580C', fontWeight: 'bold', fontSize: '0.85rem' }}>&gt;_console</span>
                <div style={{ backgroundColor: '#18181B', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #27272A', color: '#E4E4E7', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid #EA580C', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                  {thinkingStatus}
                </div>
              </div>
            )}
          </div>
          <div style={{ padding: '1.5rem', borderTop: '1px solid #27272A', backgroundColor: '#000000' }}>
            <form style={{ display: 'flex', gap: '0.5rem' }} onSubmit={handleConsoleSubmit}>
              <input
                value={consoleInput}
                onChange={(e) => setConsoleInput(e.target.value)}
                type="text"
                placeholder="Enter command or query..."
                style={{ flex: 1, backgroundColor: '#18181B', color: 'white', border: '1px solid #27272A', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '16px', outline: 'none', minWidth: '0' }}
              />
              <button type="submit" disabled={isQuerying} style={{ backgroundColor: '#EA580C', color: 'white', border: 'none', padding: '0 1rem', borderRadius: '0.5rem', cursor: isQuerying ? 'not-allowed' : 'pointer', fontWeight: 'bold', flexShrink: 0, opacity: isQuerying ? 0.5 : 1 }}>→</button>
            </form>
          </div>
        </aside>
      </div>

      {/* Clear Timetable Custom Modal */}
      {isClearModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)' }}>
          <div style={{ backgroundColor: '#18181B', border: '1px solid #27272A', borderRadius: '1rem', padding: '2rem', width: '90%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1.5rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div>
              <h3 style={{ color: 'white', margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>Clear Timetable?</h3>
              <p style={{ color: '#A1A1AA', margin: 0, fontSize: '0.95rem', lineHeight: '1.5' }}>
                Are you sure you want to delete your entire timetable? This action cannot be undone.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                onClick={() => setIsClearModalOpen(false)}
                style={{ backgroundColor: 'transparent', color: '#E4E4E7', border: '1px solid #3F3F46', padding: '0.6rem 1.25rem', borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                Cancel
              </button>
              <button
                onClick={handleClearTimetableConfirm}
                style={{ backgroundColor: '#DC2626', color: 'white', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s' }}
              >
                Wipe Schedule
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Study Guide Guardrail Modal */}
      {isStudyGuideModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-xl mx-4 overflow-hidden p-4 sm:p-8 break-words whitespace-normal flex flex-col gap-6" style={{ backgroundColor: '#111111', border: '1px solid #27272A', borderRadius: '1rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📚 Generate Study Guide
              </h3>
              <button
                onClick={() => setIsStudyGuideModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#A1A1AA', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-6">
              {/* Target Format */}
              <div className="flex flex-col gap-3">
                <label className="text-zinc-400 font-semibold text-sm uppercase tracking-wider">Target Format</label>
                <div className="flex flex-wrap gap-2">
                  {['Multiple Choice', 'Written Essay', 'General Knowledge'].map(format => (
                    <button
                      key={format}
                      onClick={() => setStudyGuideFormat(format)}
                      className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${studyGuideFormat === format
                        ? 'bg-[#EA580C] text-white shadow-[0_0_15px_rgba(234,88,12,0.4)] border border-[#EA580C]'
                        : 'bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800 border border-zinc-800'
                        }`}
                    >
                      {format}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timeframe */}
              <div className="flex flex-col gap-3">
                <label className="text-zinc-400 font-semibold text-sm uppercase tracking-wider">Timeframe</label>
                <div className="flex flex-wrap gap-2">
                  {['Cramming (<24h)', 'Standard', 'Deep Study'].map(timeframe => (
                    <button
                      key={timeframe}
                      onClick={() => setStudyGuideTimeframe(timeframe)}
                      className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${studyGuideTimeframe === timeframe
                        ? 'bg-[#EA580C] text-white shadow-[0_0_15px_rgba(234,88,12,0.4)] border border-[#EA580C]'
                        : 'bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800 border border-zinc-800'
                        }`}
                    >
                      {timeframe}
                    </button>
                  ))}
                </div>
              </div>

              {/* Current Level */}
              <div className="flex flex-col gap-3">
                <label className="text-zinc-400 font-semibold text-sm uppercase tracking-wider">Current Level</label>
                <div className="flex flex-wrap gap-2">
                  {['Beginner', 'Intermediate', 'Expert'].map(level => (
                    <button
                      key={level}
                      onClick={() => setStudyGuideLevel(level)}
                      className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${studyGuideLevel === level
                        ? 'bg-[#EA580C] text-white shadow-[0_0_15px_rgba(234,88,12,0.4)] border border-[#EA580C]'
                        : 'bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800 border border-zinc-800'
                        }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
              <button
                onClick={() => setIsStudyGuideModalOpen(false)}
                style={{ backgroundColor: 'transparent', color: '#E4E4E7', border: '1px solid #3F3F46', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateStudyGuide}
                disabled={isGeneratingStudyGuide}
                style={{ backgroundColor: '#EA580C', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 'bold', cursor: isGeneratingStudyGuide ? 'not-allowed' : 'pointer', opacity: isGeneratingStudyGuide ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {isGeneratingStudyGuide ? 'Generating...' : 'Generate Guide'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Study Guide View Modal */}
      {isStudyGuideViewOpen && activeStudyGuide && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-4xl mx-4 h-[85vh] overflow-hidden break-words whitespace-normal flex flex-col" style={{ backgroundColor: '#111111', border: '1px solid #27272A', borderRadius: '1rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-zinc-800 bg-zinc-900 p-4 sm:p-6 gap-4" style={{ backgroundColor: '#18181B', borderBottomColor: '#27272A' }}>
              <div className="flex flex-col min-w-0 w-full">
                <h3 className="break-words whitespace-normal min-w-0" style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>📖 Study Guide: {activeStudyGuide.sectionConstraint}</h3>
                <span className="break-words whitespace-normal min-w-0" style={{ color: '#71717A', fontSize: '0.85rem' }}>{activeStudyGuide.sourceDocumentName}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>

                <button
                  onClick={() => setIsStudyGuideViewOpen(false)}
                  style={{ background: 'none', border: 'none', color: '#A1A1AA', fontSize: '1.5rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="px-3 sm:px-8 py-3 sm:py-8" style={{ flex: 1, overflowY: 'auto', color: '#E4E4E7', lineHeight: '1.6', fontSize: '0.95rem' }}>
              <StudyEngine guideData={activeStudyGuide.strategyData || activeStudyGuide.markdownContent} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

```

### `app\(auth)\login\page.tsx`
```tsx
"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { error: supaError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (supaError) throw supaError;
      
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Failed to login.');
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError('');
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      });
    } catch (err: any) {
      setError('Google Sign-In failed.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0A1128', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem', color: 'white', fontFamily: 'sans-serif' }}>
      <div style={{ backgroundColor: '#111111', padding: '3rem', borderRadius: '1rem', border: '1px solid #27272A', width: '100%', maxWidth: '400px' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ margin: 0, fontSize: '2rem', color: 'white' }}>CogniBase</h1>
          <p style={{ color: '#A1A1AA', marginTop: '0.5rem' }}>
            Welcome back. Please log in.
          </p>
        </div>

        {error && <div style={{ backgroundColor: '#7F1D1D', color: '#FECACA', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1.5rem', fontSize: '0.85rem', textAlign: 'center' }}>{error}</div>}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#A1A1AA' }}>Email Address</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#18181B', border: '1px solid #3F3F46', color: 'white' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#A1A1AA' }}>Password</label>
            <input 
              type="password" 
              required 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#18181B', border: '1px solid #3F3F46', color: 'white' }} 
            />
          </div>
          
          <button type="submit" disabled={isLoading} style={{ width: '100%', padding: '0.75rem', marginTop: '1rem', backgroundColor: '#EA580C', color: 'white', borderRadius: '0.5rem', border: 'none', fontWeight: 'bold', cursor: isLoading ? 'not-allowed' : 'pointer' }}>
            {isLoading ? 'Logging in...' : 'Log In'}
          </button>

          <div style={{ textAlign: 'center', margin: '1.5rem 0', color: '#71717A', fontSize: '0.85rem' }}>OR</div>

          <button type="button" onClick={handleGoogleLogin} style={{ width: '100%', padding: '0.75rem', backgroundColor: 'white', color: 'black', borderRadius: '0.5rem', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
            Log in with Google
          </button>

          <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', color: '#A1A1AA' }}>
            Don't have an account? <Link href="/signup" style={{ color: '#EA580C', textDecoration: 'none', fontWeight: 'bold' }}>Sign up</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
```

### `app\(auth)\signup\page.tsx`
```tsx
"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase/client';

export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1 State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2 State (Optional)
  const [username, setUsername] = useState('');
  const [school, setSchool] = useState('');
  const [department, setDepartment] = useState('');
  const [source, setSource] = useState('');

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Security Check: Match passwords
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Supabase Auth
      const { data, error: supaError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name }
        }
      });

      if (supaError) throw supaError;

      // Handle Supabase's silent duplicate email protection
      if (data?.user && data.user.identities && data.user.identities.length === 0) {
        throw new Error('This email is already registered. Try logging in!');
      }
      
      // Auto-login immediately to ensure session is created if signUp doesn't attach it automatically
      if (!data.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (signInError) throw signInError;
      }
      
      setStep(2);
      setIsLoading(false);
    } catch (err: any) {
      if (err.message && err.message.includes('already registered')) {
        setError('This email is already registered. Try logging in!');
      } else {
        setError(err.message || 'Failed to create account.');
      }
      setIsLoading(false);
    }
  };

  const handleFinishSetup = async (e?: React.FormEvent, skipped = false) => {
    if (e) e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Create Prisma Profile via Supabase session
      const { data: { user: supaUser } } = await supabase.auth.getUser();
      if (supaUser) {
         await fetch('/api/users', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             id: supaUser.id,
             email: supaUser.email,
             username: skipped ? '' : username,
             school: skipped ? '' : school,
             department: skipped ? '' : department,
           })
         });
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError('Failed to save details, but account was created. Redirecting...');
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 2000);
    }
  };

  const handleGoogleSignup = async () => {
    try {
      setError('');
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      });
    } catch (err: any) {
      setError('Google Sign-In failed.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0A1128', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem', color: 'white', fontFamily: 'sans-serif' }}>
      <div style={{ backgroundColor: '#111111', padding: '3rem', borderRadius: '1rem', border: '1px solid #27272A', width: '100%', maxWidth: '450px' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ margin: 0, fontSize: '2rem', color: 'white' }}>CogniBase</h1>
          <p style={{ color: '#A1A1AA', marginTop: '0.5rem' }}>
            {step === 1 ? 'Create your secure study terminal.' : 'Tell us about your studies.'}
          </p>
        </div>

        {error && <div style={{ backgroundColor: '#7F1D1D', color: '#FECACA', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1.5rem', fontSize: '0.85rem', textAlign: 'center' }}>{error}</div>}

        {step === 1 ? (
          <form onSubmit={handleCreateAccount} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#A1A1AA' }}>Full Name</label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#18181B', border: '1px solid #3F3F46', color: 'white' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#A1A1AA' }}>Email Address</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#18181B', border: '1px solid #3F3F46', color: 'white' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#A1A1AA' }}>Password (Min 8 chars, 1 Uppercase, 1 Number)</label>
              <input 
                type="password" 
                required 
                pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$"
                title="Password must be at least 8 characters long and contain at least one uppercase letter and one number."
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#18181B', border: '1px solid #3F3F46', color: 'white' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#A1A1AA' }}>Confirm Password</label>
              <input 
                type="password" 
                required 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#18181B', border: '1px solid #3F3F46', color: 'white' }} 
              />
            </div>
            
            <button type="submit" disabled={isLoading} style={{ width: '100%', padding: '0.75rem', marginTop: '1rem', backgroundColor: '#EA580C', color: 'white', borderRadius: '0.5rem', border: 'none', fontWeight: 'bold', cursor: isLoading ? 'not-allowed' : 'pointer' }}>
              {isLoading ? 'Creating Account...' : 'Continue'}
            </button>

            <div style={{ textAlign: 'center', margin: '1.5rem 0', color: '#71717A', fontSize: '0.85rem' }}>OR</div>

            <button type="button" onClick={handleGoogleSignup} style={{ width: '100%', padding: '0.75rem', backgroundColor: 'white', color: 'black', borderRadius: '0.5rem', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
              Sign up with Google
            </button>

            <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', color: '#A1A1AA' }}>
              Already have an account? <Link href="/login" style={{ color: '#EA580C', textDecoration: 'none', fontWeight: 'bold' }}>Log in</Link>
            </p>
          </form>
        ) : (
          <form onSubmit={(e) => handleFinishSetup(e, false)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#A1A1AA' }}>Username</label>
              <input type="text" placeholder="e.g. study_ninja" value={username} onChange={e => setUsername(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#18181B', border: '1px solid #3F3F46', color: 'white' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#A1A1AA' }}>University / School</label>
              <input type="text" placeholder="e.g. Veritas University" value={school} onChange={e => setSchool(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#18181B', border: '1px solid #3F3F46', color: 'white' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#A1A1AA' }}>Department / Major</label>
              <input type="text" placeholder="e.g. Educational Management" value={department} onChange={e => setDepartment(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#18181B', border: '1px solid #3F3F46', color: 'white' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#A1A1AA' }}>How did you hear about us?</label>
              <select value={source} onChange={e => setSource(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#18181B', border: '1px solid #3F3F46', color: 'white' }}>
                <option value="">Select an option...</option>
                <option value="Friend">A Friend / Classmate</option>
                <option value="Twitter">Twitter / X</option>
                <option value="TikTok">TikTok</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button type="button" onClick={() => handleFinishSetup(undefined, true)} disabled={isLoading} style={{ flex: 1, padding: '0.75rem', backgroundColor: 'transparent', color: '#A1A1AA', border: '1px solid #3F3F46', borderRadius: '0.5rem', cursor: 'pointer' }}>
                Skip for now
              </button>
              <button type="submit" disabled={isLoading} style={{ flex: 2, padding: '0.75rem', backgroundColor: '#EA580C', color: 'white', borderRadius: '0.5rem', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
                Complete Setup
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

```

### `app\api\audit-logs\route.ts`
```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const logs = await prisma.auditLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error("API Crash Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

```

### `app\api\chat\route.ts`
```ts
import { streamText, tool } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const urlWorkspaceId = url.searchParams.get('workspaceId');
    const urlSources = url.searchParams.get('sources');
    const { messages, data, activeSources: bodyActiveSources, workspaceId: bodyWorkspaceId, userProfile } = await req.json();
    
    const workspaceId = data?.workspaceId || urlWorkspaceId || bodyWorkspaceId;

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Ignore in route handlers
            }
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized: Please log in." }), { status: 401 });
    }

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Missing messages." }), { status: 400 });
    }

    const normalizedMessages = messages.map((msg: any) => ({
      ...msg,
      content: msg.content || (msg.parts ? msg.parts.map((p: any) => p.text || '').join('') : '')
    }));

    const userQueryText = normalizedMessages[normalizedMessages.length - 1]?.content || "";
    
    if (workspaceId) {
      try {
        await prisma.message.create({
          data: {
            role: 'user',
            text: userQueryText,
            workspaceId
          }
        });
      } catch (e) {
        console.error("Failed to save user message:", e);
      }
    }

    // Agentic Tool-Calling: System Prompt focuses strictly on identity and tool delegation
    const systemPrompt = `You are CogniBase, an elite academic AI co-pilot. Here is your current user context, which you must use silently to calibrate your responses, unless explicitly helpful to bring up:
${JSON.stringify(userProfile)}

If the user asks a general question unrelated to this context, ignore the context and answer directly. Use your tools to fetch their timetable, metrics, or search their workspace files when appropriate. Maintain continuity across the conversation history.`;

    const result = streamText({
      model: google('gemini-3.5-flash'),
      system: systemPrompt,
      messages: normalizedMessages,
      maxSteps: 5,
      tools: {
        getUserTimetable: tool({
          description: "Get the user's timetable/schedule data. Use this when the user asks about their classes or timings.",
          parameters: z.object({}),
          execute: async () => {
             try {
               const timetable = await prisma.timetable.findFirst({ where: { userId: user.id } });
               return timetable ? timetable.data : { error: "No timetable found" };
             } catch(e) { return { error: "Failed to fetch timetable" }; }
          }
        }),
        getDailyMetrics: tool({
          description: "Get the user's daily performance metrics for today (focus hours, tasks completed, accuracy). Use this when the user asks for coaching feedback or focus metrics.",
          parameters: z.object({}),
          execute: async () => {
             try {
               const startOfDay = new Date();
               startOfDay.setHours(0, 0, 0, 0);
               const metric = await prisma.dailyMetric.findFirst({
                 where: { userId: user.id, date: { gte: startOfDay } }
               });
               return metric || { error: "No metrics recorded for today." };
             } catch(e) { return { error: "Failed to fetch metrics" }; }
          }
        }),
        searchWorkspaceFiles: tool({
          description: "Search the contents of the user's uploaded workspace files. Use this when the user asks questions about the content of their documents.",
          parameters: z.object({
            query: z.string().describe("The specific search query to run against the document contents")
          }),
          execute: async ({ query }) => {
            if (!workspaceId) return { error: "No active workspace. Please open a workspace to search files." };
            try {
              const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
              const queryResult = await embeddingModel.embedContent(query);
              let queryEmbedding = queryResult.embedding.values;
              if (queryEmbedding.length > 768) {
                queryEmbedding = queryEmbedding.slice(0, 768);
              }
              const embeddingString = `[${queryEmbedding.join(',')}]`;

              // SECURE: Parameterized Prisma.$queryRaw
              const matches: any[] = await prisma.$queryRaw`
                SELECT c."content", d."name" as "documentName", 1 - (c."embedding" <=> CAST(${embeddingString} AS vector)) as similarity
                FROM "DocumentChunk" c
                JOIN "Document" d ON c."documentId" = d."id"
                WHERE d."workspaceId" = ${workspaceId}
                ORDER BY c."embedding" <=> CAST(${embeddingString} AS vector)
                LIMIT 10
              `;
              
              if (!matches || matches.length === 0) return { result: "No matching content found in workspace files." };
              return matches.map(m => `[Source Document: ${m.documentName}]\n${m.content}`).join("\n\n---\n\n");
            } catch(e: any) {
              console.error("Vector search error in tool", e);
              return { error: e.message };
            }
          }
        })
      },
      async onFinish({ text }) {
        if (workspaceId && text) {
          try {
            await prisma.message.create({
              data: {
                role: 'assistant',
                text,
                workspaceId
              }
            });
          } catch (e) {
            console.error("Failed to save assistant message:", e);
          }
        }
      }
    });

    return result.toUIMessageStreamResponse();

  } catch (error: any) {
    console.error("Query Error:", error);
    if (error.message?.includes("503") || error.message?.includes("high demand") || error.message?.includes("Service Unavailable")) {
      return new Response("The AI servers are currently experiencing high demand. Please try again in a few minutes.", { status: 503 });
    }
    return new Response(error.message || "Failed to generate response", { status: 500 });
  }
}

```

### `app\api\documents\route.ts`
```ts
// ============================================================================
// FILE: app/api/documents/route.ts
// ============================================================================
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as cheerio from 'cheerio';

const PDFParser = require("pdf2json");
const officeParser = require("officeparser");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

function extractPDFText(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, 1);
    pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
    pdfParser.on("pdfParser_dataReady", () => {
      resolve(pdfParser.getRawTextContent());
    });
    pdfParser.parseBuffer(buffer);
  });
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, url, workspaceId, fileSize } = await req.json();

    let targetWorkspaceId = workspaceId;

    if (!targetWorkspaceId) {
      const globalWorkspace = await prisma.workspace.upsert({
        where: { id: 'global-vault-001' },
        update: {},
        create: {
          id: 'global-vault-001',
          title: 'My Global Vault',
        },
      });
      targetWorkspaceId = globalWorkspace.id;
    }

    let extractedText = "";
    let sourceType = "file";
    
    // Check URL Type
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
    const isWebsite = url.startsWith('http') && !url.includes('supabase.co');

    if (isYouTube) {
      sourceType = 'youtube';
      try {
        const { YoutubeTranscript } = require('youtube-transcript');
        const transcript = await YoutubeTranscript.fetchTranscript(url);
        extractedText = transcript.map((t: any) => t.text).join(' ');
      } catch (err) {
        console.error("YouTube transcript extraction failed:", err);
        extractedText = ""; // Leave empty if extraction fails (e.g., no captions)
      }
    } else if (isWebsite) {
      sourceType = 'website';
      try {
        const response = await fetch(url);
        const html = await response.text();
        const $ = cheerio.load(html);
        $('script, style, nav, footer, header').remove();
        extractedText = $('body').text().replace(/\s+/g, ' ').trim();
      } catch (err) {
        console.error("Website extraction failed", err);
        return NextResponse.json({ error: "Could not fetch website content." }, { status: 400 });
      }
    } else {
      // Physical File Logic
      sourceType = 'file';
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const extension = name.includes('.') ? name.split('.').pop()?.toLowerCase() : 'unknown';

      if (extension === "pdf") {
        try {
          const generativeModel = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
          const prompt = "Please extract all text from this document accurately and format it as Markdown. Preserve headings (#, ##), bulleted lists, and bold text. Do not summarize, extract the full text. Output ONLY the markdown text without any other comments.";
          const result = await generativeModel.generateContent([
            prompt,
            { inlineData: { data: buffer.toString("base64"), mimeType: "application/pdf" } }
          ]);
          extractedText = result.response.text();
        } catch (err) {
          console.error("Gemini PDF extraction failed, falling back to plain text:", err);
          let rawText = await extractPDFText(buffer);
          const lines = rawText.split('\n');
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.length > 0 && line.length < 60 && line === line.toUpperCase()) {
               lines[i] = `### ${line}`;
            }
          }
          extractedText = lines.join('\n');
        }
      } else if (extension === "docx") {
        try {
          const mammoth = require("mammoth");
          const Turndown = require("turndown");
          const TurndownService = Turndown.default || Turndown;
          const docxResult = await mammoth.convertToHtml({ buffer });
          const turndownService = new TurndownService();
          extractedText = turndownService.turndown(docxResult.value);
        } catch (err) {
          console.error("Mammoth failed, falling back to officeparser", err);
          if (typeof officeParser.parseOffice === 'function') {
            const ast = await officeParser.parseOffice(buffer, { fileType: extension });
            extractedText = typeof ast === 'string' ? ast : (ast.toText ? ast.toText() : JSON.stringify(ast));
          } else if (typeof officeParser.parseOfficeAsync === 'function') {
            extractedText = await officeParser.parseOfficeAsync(buffer);
          }
        }
      } else if (extension === "doc" || extension === "pptx") {
        if (typeof officeParser.parseOffice === 'function') {
          const ast = await officeParser.parseOffice(buffer, { fileType: extension });
          extractedText = typeof ast === 'string' ? ast : (ast.toText ? ast.toText() : JSON.stringify(ast));
        } else if (typeof officeParser.parseOfficeAsync === 'function') {
          extractedText = await officeParser.parseOfficeAsync(buffer);
        }
      } else if (extension === "txt") {
        extractedText = buffer.toString("utf-8");
      } else if (["png", "jpg", "jpeg", "webp", "heic"].includes(extension as string)) {
        try {
          const generativeModel = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
          const prompt = "Please extract all text from this image accurately. If there are diagrams, describe them in text. If there is no text or diagrams, just describe the visual content in detail so a student can study it.";
          const mimeType = extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;
          
          const result = await generativeModel.generateContent([
            prompt,
            {
              inlineData: {
                data: buffer.toString("base64"),
                mimeType
              }
            }
          ]);
          extractedText = result.response.text();
        } catch (err) {
          console.error("Gemini Vision Error:", err);
        }
      }
    }

    if (!extractedText) extractedText = "";
    try { extractedText = decodeURIComponent(extractedText); } catch(e) {}
    
    extractedText = extractedText.trim();

    if (sourceType !== 'youtube' && extractedText.length === 0) {
      return NextResponse.json({ error: "Could not read text from this file. Please ensure it is a valid, text-based document." }, { status: 400 });
    }

    const newDoc = await prisma.document.create({
      data: { name, url, workspaceId: targetWorkspaceId, fileSize, textContent: extractedText, sourceType }
    });

    try {
      const origin = req.headers.get('origin') || new URL(req.url).origin;
      const cookieHeader = req.headers.get('cookie');
      await fetch(`${origin}/api/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(cookieHeader ? { 'cookie': cookieHeader } : {}) },
        body: JSON.stringify({ action: 'upload_document' })
      });
    } catch (metricErr) {
      console.error("Failed to update gamification metric:", metricErr);
    }

    return NextResponse.json(newDoc);
  } catch (error) {
    console.error("API Crash Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'global-vault-001';

    const docs = await prisma.document.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(docs);
  } catch (error) {
    console.error("API Crash Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: "Missing document id" }, { status: 400 });
    }

    const doc = await prisma.document.findUnique({
      where: { id }
    });

    if (!doc) {
       return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Cleanup Supabase Storage FIRST
    if (doc.url && doc.url.includes('workspace-files/')) {
      const urlParts = doc.url.split('workspace-files/');
      if (urlParts.length > 1) {
        const pathToDelete = urlParts[1];
        const { error: storageError } = await supabase.storage.from('workspace-files').remove([pathToDelete]);
        if (storageError) {
           console.error("Supabase storage deletion failed:", storageError);
           return NextResponse.json({ error: "Failed to delete file from storage" }, { status: 500 });
        }
      }
    }

    // Delete from DB only after storage cleanup is successful
    await prisma.document.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API Crash Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

```

### `app\api\documents\study-guide\route.ts`
```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { documentId, text, userId } = await req.json();

    if (!documentId || !text || !userId) {
      return NextResponse.json({ error: "Missing documentId, text, or userId" }, { status: 400 });
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId }
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash', generationConfig: { responseMimeType: "application/json" } });

    const systemPrompt = `You are a tactical academic strategist. Analyze the document and create an actionable study plan. Output strictly as a JSON object containing a 'phases' array. Each phase object must have a 'phaseTitle' (e.g., "Phase 1: High-Yield Concepts", "Phase 2: Rote Memorization") and a 'tasks' array. Each task must be an object with:
- id (a unique string)
- text (the actionable study instruction)
- isCompleted (boolean, default false)
- knowledgeCheck: an object containing:
  - question (string: a quick multiple-choice question to test the specific task)
  - options (array of exactly 4 strings)
  - correctAnswer (string: exact match to the correct option)

Do not use markdown formatting. Output strictly JSON.`;

    const prompt = `${systemPrompt}\n\nDocument Text:\n${text}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const strategyData = JSON.parse(responseText);

    const studyGuide = await prisma.studyGuide.create({
      data: {
        userId,
        sourceDocumentId: documentId,
        sourceDocumentName: document.name,
        title: `Interactive Guide: ${document.name}`,
        strategyData,
      }
    });

    return NextResponse.json({ studyGuide });

  } catch (error: any) {
    console.error("Generate Study Guide Error:", error);
    return NextResponse.json({ 
      error: "The AI servers are currently busy or out of quota. Please try again later.",
      isCongested: true 
    }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, strategyData } = await req.json();

    if (!id || !strategyData) {
      return NextResponse.json({ error: "Missing id or strategyData" }, { status: 400 });
    }

    const studyGuide = await prisma.studyGuide.update({
      where: { id },
      data: { strategyData }
    });

    return NextResponse.json({ studyGuide });

  } catch (error: any) {
    console.error("Update Study Guide Error:", error);
    return NextResponse.json({ error: "Failed to save progress. Please try again later." }, { status: 500 });
  }
}

```

### `app\api\engine\analyze\route.ts`
```ts
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { createClient } from '@/utils/supabase/server';

const PDFParser = require("pdf2json");
const officeParser = require("officeparser");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

function extractPDFText(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, 1);
    pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
    pdfParser.on("pdfParser_dataReady", () => {
      resolve(pdfParser.getRawTextContent());
    });
    pdfParser.parseBuffer(buffer);
  });
}

function chunkText(text: string, maxChunkSize: number = 1000, overlapSize: number = 200) {
  const words = text.replace(/\s+/g, " ").split(" ");
  const chunks = [];
  let currentChunk: string[] = [];
  let currentLength = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (currentLength + word.length > maxChunkSize) {
      chunks.push(currentChunk.join(" "));
      
      let overlapChunk: string[] = [];
      let overlapLength = 0;
      for (let j = currentChunk.length - 1; j >= 0; j--) {
        const overlapWord = currentChunk[j];
        if (overlapLength + overlapWord.length > overlapSize) break;
        overlapChunk.unshift(overlapWord);
        overlapLength += overlapWord.length + 1;
      }
      currentChunk = [...overlapChunk];
      currentLength = overlapLength;
    }
    currentChunk.push(word);
    currentLength += word.length + 1;
  }
  if (currentChunk.length > 0) chunks.push(currentChunk.join(" "));
  return chunks;
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized: Please log in." }, { status: 401 });
    }

    const { fileUrl, fileName, docId, userId, workspaceId, workspaceName } = await req.json();

    if (!fileUrl || !fileName || !userId) {
      return NextResponse.json({ error: "Missing required file data." }, { status: 400 });
    }

    const response = await fetch(fileUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let extractedText = "";
    const extension = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : 'unknown';

    if (extension === "pdf") {
      extractedText = await extractPDFText(buffer);
    } else if (["docx", "pptx"].includes(extension as string)) {
      if (typeof officeParser.parseOffice === 'function') {
        const ast = await officeParser.parseOffice(buffer, { fileType: extension });
        extractedText = typeof ast === 'string' ? ast : (ast.toText ? ast.toText() : JSON.stringify(ast));
      } else if (typeof officeParser.parseOfficeAsync === 'function') {
        extractedText = await officeParser.parseOfficeAsync(buffer);
      } else {
        return NextResponse.json({ error: "The server's document parsing engine is missing a valid parsing method." }, { status: 500 });
      }
    } else if (extension === "txt") {
      extractedText = buffer.toString("utf-8");
    } else if (["png", "jpg", "jpeg", "webp", "heic"].includes(extension as string)) {
      try {
        const generativeModel = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
        const prompt = "Please extract all text from this image accurately. If there are diagrams, describe them in text. If there is no text or diagrams, just describe the visual content in detail so a student can study it.";
        const mimeType = extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;
        
        const result = await generativeModel.generateContent([
          prompt,
          {
            inlineData: {
              data: buffer.toString("base64"),
              mimeType
            }
          }
        ]);
        extractedText = result.response.text();
      } catch (err) {
        console.error("Gemini Vision Error:", err);
        return NextResponse.json({ error: "Failed to process image with AI Vision." }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: `Unsupported file extension: .${extension}` }, { status: 400 });
    }

    // Clean up the text
    if (!extractedText) extractedText = "";
    // Decode URI components that some parsers leave behind (like %20 for spaces)
    try { extractedText = decodeURIComponent(extractedText); } catch(e) {}

    const chunks = chunkText(extractedText);
    
    // SAFEGUARD: Filter out empty chunks
    const validChunks = chunks.filter(c => c.trim().length > 0);

    if (validChunks.length === 0) {
      return NextResponse.json({ error: "No readable text found. If this is a scanned document, the AI cannot read the images yet." }, { status: 400 });
    }
    
    const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

    // Generate embeddings and insert into Postgres via Prisma
    let chunksInserted = 0;
    const batchSize = 5;
    const allEmbeddings: { id: string; content: string; embeddingStr: string }[] = [];

    for (let i = 0; i < validChunks.length; i += batchSize) {
      const batchChunks = validChunks.slice(i, i + batchSize);
      try {
        const batchResults = await Promise.all(
          batchChunks.map(async (chunk, batchIdx) => {
            const result = await embeddingModel.embedContent(chunk);
            let embedding = result.embedding.values;
            if (embedding.length > 768) embedding = embedding.slice(0, 768);
            return {
              id: `${docId}-chunk-${i + batchIdx}`,
              content: chunk,
              embeddingStr: `[${embedding.join(',')}]`
            };
          })
        );
        allEmbeddings.push(...batchResults);
      } catch (e) {
        console.error(`Failed to process embedding batch starting at ${i}:`, e);
      }
    }

    if (allEmbeddings.length > 0) {
      // Build a single bulk insert query
      const values: string[] = [];
      const parameters: any[] = [];
      let paramIndex = 1;

      for (const item of allEmbeddings) {
        values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}::vector)`);
        parameters.push(item.id, docId, item.content, item.embeddingStr);
        paramIndex += 4;
      }

      const query = `INSERT INTO "DocumentChunk" ("id", "documentId", "content", "embedding") VALUES ${values.join(', ')}`;
      
      try {
        await prisma.$executeRawUnsafe(query, ...parameters);
        chunksInserted = allEmbeddings.length;
      } catch (e) {
        console.error("Bulk insert failed:", e);
      }
    }

    if (chunksInserted === 0) {
       return NextResponse.json({ error: "Failed to generate AI data from this file." }, { status: 400 });
    }

    let generatedTitle = null;
    
    // Only generate a title if it's the default or generic name, or if we want to auto-update
    if (workspaceId && (!workspaceName || workspaceName.toLowerCase().includes('untitled') || workspaceName.toLowerCase().includes('optimizing academic'))) {
      try {
        const titleModel = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
        const titlePrompt = `Based on the following academic text, generate a short, highly relevant title (3 to 5 words maximum) for a study workspace. Do not use quotes or special characters. Text excerpt: ${extractedText.substring(0, 1500)}`;
        const titleResult = await titleModel.generateContent(titlePrompt);
        generatedTitle = titleResult.response.text().trim().replace(/^["'](.*)["']$/, '$1');
        
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: { title: generatedTitle }
        });
      } catch (titleErr) {
        console.error("Failed to generate workspace title:", titleErr);
      }
    }

    return NextResponse.json({ success: true, chunksProcessed: chunksInserted, workspaceTitle: generatedTitle });

  } catch (error: any) {
    console.error("Engine Error:", error);
    
    if (error.message?.includes("503") || error.message?.includes("high demand") || error.message?.includes("Service Unavailable")) {
      return NextResponse.json({ 
        error: "The AI servers are currently experiencing high demand from students. Please try again in a few minutes.",
        isCongested: true
      }, { status: 503 });
    }

    return NextResponse.json({ error: error.message || "Failed to process document." }, { status: 500 });
  }
}

```

### `app\api\engine\extract-courses\route.ts`
```ts
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function POST(req: Request) {
  try {
    const { fileUrl, userId, semesterId } = await req.json();

    if (!fileUrl || !userId || !semesterId) {
      return NextResponse.json({ error: "Missing fileUrl, userId, or semesterId." }, { status: 400 });
    }

    // Step 4: Backend API fetches the file from the URL
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) throw new Error("Failed to fetch file from URL");
    const arrayBuffer = await fileRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const imageBase64 = buffer.toString('base64');
    
    // Extract dynamic MIME type, stripping out any charset directives
    const rawContentType = fileRes.headers.get('content-type') || 'application/pdf';
    const mimeType = rawContentType.split(';')[0].trim();

    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
    // Defense Layer 1: Smart Caching
    try {
      const cacheDoc = await prisma.extractedFormCache.findUnique({
        where: { hash: fileHash }
      });
      if (cacheDoc) {
        console.log(`Cache hit for file hash: ${fileHash}`);
        return NextResponse.json({ success: true, courses: cacheDoc.courses });
      }
    } catch (e) {
      // Gracefully continue if DB fails
      console.error("Cache read error:", e);
    }

    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
    const prompt = `First, verify if this document is a university course registration form or student schedule. If it is NOT, do not extract any courses. Instead, return a JSON object containing strictly: { "error": "invalid_document" }.\n\nIf it IS a valid form, you are analyzing a university course registration form. This form may contain multiple semesters. Please extract the courses and the semester they belong to. Return ONLY a raw JSON array of objects with keys "courseCode", "courseTitle", and "semester" (strictly string values of either 'First' or 'Second').\n\nCRITICAL: Do NOT wrap the response in markdown code blocks (e.g., no \`\`\`json). Return ONLY the raw array bracket structure or the error JSON object.`;
    const imageParts = [{ inlineData: { data: imageBase64, mimeType } }];

    // Defense Layer 2: Exponential Backoff (Invisible Retries)
    let extractedCourses = null;
    let attempt = 0;
    const backoffDelays = [2000, 4000, 8000, 12000, 15000];
    const maxAttempts = backoffDelays.length;

    while (attempt < maxAttempts) {
      try {
        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        let text = response.text();
        
        text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        if (text.startsWith('`') && text.endsWith('`')) {
          text = text.substring(1, text.length - 1).trim();
        }
        
        const parsed = JSON.parse(text);
        if (parsed.error === 'invalid_document') {
          return NextResponse.json({ error: "Please upload a valid course form. We couldn't find your courses in this document." }, { status: 400 });
        }
        
        extractedCourses = Array.isArray(parsed) ? parsed : [parsed];
        break; // Success! Break the retry loop
      } catch (err: any) {
        attempt++;
        const errMsg = String(err.message || err);
        console.error(`Gemini Attempt ${attempt} failed: ${errMsg}`);
        
        if (attempt >= maxAttempts) {
          throw err; // Out of retries, throw the final error
        }
        
        // Retry on rate limits (429), server overloads (503), or network issues
        if (errMsg.includes('503') || errMsg.includes('429') || errMsg.includes('fetch failed')) {
          const delay = backoffDelays[attempt - 1];
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(res => setTimeout(res, delay));
        } else {
          // Do not retry fatal errors (like 400 Bad Request or JSON Parsing crashes)
          throw err; 
        }
      }
    }

    // Save successful extraction to Cache
    if (extractedCourses) {
      try {
        await prisma.extractedFormCache.create({
          data: {
            hash: fileHash,
            courses: extractedCourses
          }
        });
        console.log(`Saved extracted courses to cache for hash: ${fileHash}`);
      } catch (e) {
        console.error("Cache write error:", e);
      }
    }

    return NextResponse.json({ success: true, courses: extractedCourses });
  } catch (error: any) {
    console.error('Extraction Error:', error);
    return NextResponse.json({ error: String(error.message || error) }, { status: 500 });
  }
}

```

### `app\api\engine\extract-timetable\route.ts`
```ts
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { parseOffice } from "officeparser";
import { createClient } from '@/utils/supabase/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized: Please log in." }, { status: 401 });
    }

    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64 || !mimeType) {
      return NextResponse.json({ error: "Missing image or mimeType." }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    const prompt = `First, evaluate the document. If it does not contain a recognizable timetable or schedule, immediately return a JSON object exactly like this: { "error": "NOT_A_TIMETABLE" }. Do not attempt to guess.\n\nRegardless of the input format (handwritten photo, Excel sheet, plain text), extract all detected classes into this standardized JSON format. Return ONLY a clean JSON array of objects. Each object must have the following exact keys: "courseCode" (e.g. "CSC 101"), "day" (e.g. "Monday", "Tuesday"), "startTime" (e.g. "10:00 AM"), "endTime" (e.g. "11:30 AM"), and "location" (e.g. "Room 404"). If the location is missing, set it to an empty string. Do not include any markdown backticks. Return the raw JSON array or the error object.`;

    let contentParts: any[] = [];
    
    // Check if it's an office document or csv
    if (mimeType.includes("officedocument") || mimeType.includes("ms-excel") || mimeType.includes("csv") || mimeType.includes("text/csv") || mimeType.includes("msword")) {
      const buffer = Buffer.from(imageBase64, 'base64');
      const ext = mimeType.includes("csv") ? "csv" 
                : mimeType.includes("spreadsheetml") ? "xlsx" 
                : mimeType.includes("ms-excel") ? "xls" 
                : "docx";
                
      try {
        const doc = await parseOffice(buffer, { fileType: ext as any });
        contentParts = [doc.toText()];
      } catch (err) {
        console.error("Office parser error:", err);
        return NextResponse.json({ error: "Failed to parse document format." }, { status: 400 });
      }
    } else {
      contentParts = [
        {
          inlineData: {
            data: imageBase64,
            mimeType
          },
        },
      ];
    }

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [prompt, ...contentParts].map(p => typeof p === 'string' ? { text: p } : p) }],
      generationConfig: { responseMimeType: "application/json" }
    });
    const response = await result.response;
    let text = response.text();
    
    // Clean up potential markdown formatting
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      const parsed = JSON.parse(text);
      if (parsed.error === 'NOT_A_TIMETABLE') {
        return NextResponse.json({ error: "Invalid document: No timetable detected." }, { status: 400 });
      }
      if (!Array.isArray(parsed)) {
          return NextResponse.json({ timetable: [parsed] });
      }
      return NextResponse.json({ timetable: parsed });
    } catch(e) {
      console.error("JSON Parsing failed", text);
      return NextResponse.json({ error: "Failed to parse JSON", rawText: text }, { status: 500 });
    }

  } catch (error) {
    console.error("Course extraction error:", error);
    return NextResponse.json({ error: "Internal error processing the image." }, { status: 500 });
  }
}

```

### `app\api\engine\generate-flashcards\route.ts`
```ts
import { NextResponse } from "next/server";
import { getAIModel } from "@/lib/ai/model-router";
import { parseOffice } from "officeparser";
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized: Please log in." }, { status: 401 });
    }

    const { fileUrl, text: providedText } = await req.json();

    let text = providedText || '';
    let mimeType = 'text/plain';
    let buffer = Buffer.from('');

    if (!providedText) {
      if (!fileUrl || typeof fileUrl !== 'string') {
        return NextResponse.json({ error: "Missing fileUrl or text." }, { status: 400 });
      }

      console.log("Fetching fileUrl:", fileUrl);
      const fileRes = await fetch(fileUrl);
      if (!fileRes.ok) {
        console.error(`Failed to fetch file. Status: ${fileRes.status} ${fileRes.statusText}`);
        if (fileRes.status === 404) {
          return NextResponse.json({ error: "The file could not be found on the storage server. It may have been deleted or expired." }, { status: 404 });
        }
        return NextResponse.json({ error: `Failed to fetch file from storage provider. Status: ${fileRes.status}` }, { status: fileRes.status });
      }
      const arrayBuffer = await fileRes.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      
      const rawContentType = fileRes.headers.get('content-type') || 'application/pdf';
      mimeType = rawContentType.split(';')[0].trim();
      
      let ext: any = mimeType.includes("csv") ? "csv" 
                : mimeType.includes("spreadsheetml") ? "xlsx" 
                : mimeType.includes("officedocument.presentationml") ? "pptx"
                : mimeType.includes("officedocument.wordprocessingml") ? "docx"
                : mimeType.includes("text/plain") ? "txt"
                : "pdf"; // Fallback extension
                
      try {
        if (ext === 'txt') {
          text = buffer.toString('utf-8');
        } else {
          const doc = await parseOffice(buffer, { fileType: ext });
          text = typeof doc === 'string' ? doc : (doc.toText ? doc.toText() : JSON.stringify(doc));
        }
      } catch (err) {
        console.error("Parser error:", err);
        // Fallback for PDFs if officeparser fails or is incomplete
        text = "Attached document content for extraction."; // Simplified fallback
      }
    }

    if (!text || text.trim() === '') {
      return NextResponse.json({ error: "Document text could not be extracted or downloaded from storage. Please try again." }, { status: 400 });
    }

    const model = getAIModel('simple');
    
    const prompt = `You are an expert tutor. Read the following text context from an uploaded document and extract the most important concepts, definitions, and theories. Output a strict JSON array of objects, where each object has exactly two keys: "front" (the term, question, or concept) and "back" (the definition, answer, or explanation). Do not include any markdown formatting or backticks. Return ONLY the raw JSON array.

Context:
${text.substring(0, 40000)} // Limit context if very large
`;

    // If text extraction failed completely and we just have the fallback string, we can't do much. 
    // Ideally we should pass the raw buffer to Gemini like in the timetable route, but officeparser should work for most formats.
    let contentParts: any[] = [prompt];
    if (text === "Attached document content for extraction.") {
       // Passing document as inline data for gemini-1.5 multimodal if parsing failed
       contentParts = [
         prompt, 
         { inlineData: { data: buffer.toString('base64'), mimeType } }
       ];
    }

    let result;
    try {
      result = await model.generateContent({
        contents: [{ role: "user", parts: contentParts.map(p => typeof p === 'string' ? { text: p } : p) }],
        generationConfig: {
          responseMimeType: "application/json",
        }
      });
    } catch (aiError: any) {
      console.error("Flashcard Gen Error:", aiError);
      return NextResponse.json({ error: aiError.message || "Failed to communicate with AI model." }, { status: 500 });
    }
    
    const response = await result.response;
    let out = response.text();
    
    // Clean up potential markdown formatting
    out = out.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      const parsed = JSON.parse(out);
      if (!Array.isArray(parsed)) {
          return NextResponse.json({ flashcards: [parsed] });
      }
      return NextResponse.json({ flashcards: parsed });
    } catch(e) {
      console.error("Failed to parse flashcards JSON:", out);
      return NextResponse.json({ error: "Failed to generate valid flashcards format." }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Flashcard Gen Route Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

```

### `app\api\engine\generate-ppt\route.ts`
```ts
import { NextResponse } from "next/server";
import { getAIModel } from "@/lib/ai/model-router";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { documentText } = await req.json();

    if (!documentText || typeof documentText !== 'string') {
      return NextResponse.json({ error: "Missing or invalid documentText." }, { status: 400 });
    }

    const model = getAIModel('complex');
    
    const prompt = `You are a master presentation designer. Create a highly structured JSON presentation based on the following document content.

You MUST return a raw JSON array of slide objects that EXACTLY matches this schema. Do not include markdown wrappers.
[
  {
    "slide": 1,
    "title": "Title of the Slide",
    "bullets": [
      "First key point",
      "Second key point"
    ],
    "speakerNotes": "Details that the speaker should mention..."
  }
]

Document Context:
${documentText.substring(0, 40000)}
`;

    let result;
    try {
      result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      });
    } catch (aiError: any) {
      console.error("PPT Gen Error:", aiError);
      return NextResponse.json({ error: aiError.message || "Failed to communicate with AI model." }, { status: 500 });
    }
    
    const response = await result.response;
    const markdownOut = response.text();
    
    let parsedJson;
    try {
      parsedJson = JSON.parse(markdownOut);
    } catch (e) {
      console.error("JSON Parse failed on raw AI output:", e);
      try {
        const cleaned = markdownOut.replace(/```json/g, '').replace(/```/g, '').trim();
        parsedJson = JSON.parse(cleaned);
      } catch (cleanError) {
        throw new Error("AI returned malformed JSON");
      }
    }
    
    return NextResponse.json({ slides: parsedJson });

  } catch (error: any) {
    console.error("PPT Route Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

```

### `app\api\engine\generate-study-guide\route.ts`
```ts
import { NextResponse } from "next/server";
import { getAIModel } from "@/lib/ai/model-router";
import { parseOffice } from "officeparser";
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized: Please log in." }, { status: 401 });
    }

    const { fileUrl, sectionConstraint } = await req.json();

    if (!fileUrl || typeof fileUrl !== 'string') {
      return NextResponse.json({ error: "Missing or invalid fileUrl." }, { status: 400 });
    }

    if (!sectionConstraint || typeof sectionConstraint !== 'string') {
      return NextResponse.json({ error: "Missing or invalid sectionConstraint." }, { status: 400 });
    }

    console.log("Fetching fileUrl for Study Guide:", fileUrl);
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) {
      console.error(`Failed to fetch file. Status: ${fileRes.status} ${fileRes.statusText}`);
      if (fileRes.status === 404) {
        return NextResponse.json({ error: "The file could not be found on the storage server. It may have been deleted or expired." }, { status: 404 });
      }
      return NextResponse.json({ error: `Failed to fetch file from storage provider. Status: ${fileRes.status}` }, { status: fileRes.status });
    }
    
    const arrayBuffer = await fileRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const rawContentType = fileRes.headers.get('content-type') || 'application/pdf';
    const mimeType = rawContentType.split(';')[0].trim();
    
    let text = '';
    let ext: any = mimeType.includes("csv") ? "csv" 
              : mimeType.includes("spreadsheetml") ? "xlsx" 
              : mimeType.includes("officedocument.presentationml") ? "pptx"
              : mimeType.includes("officedocument.wordprocessingml") ? "docx"
              : mimeType.includes("text/plain") ? "txt"
              : "pdf";
              
    try {
      if (ext === 'txt') {
        text = buffer.toString('utf-8');
      } else {
        const doc = await parseOffice(buffer, { fileType: ext });
        text = typeof doc === 'string' ? doc : (doc.toText ? doc.toText() : JSON.stringify(doc));
      }
    } catch (err) {
      console.error("Parser error:", err);
      text = "Attached document content for extraction.";
    }

    if (!text || text.trim() === '') {
      return NextResponse.json({ error: "Document text could not be extracted or downloaded from storage. Please try again." }, { status: 400 });
    }

    const model = getAIModel('complex');
    
    const prompt = `You are a master tutor. Create a highly structured JSON study guide based on the following document content, strictly adhering to the user's Study Brief Configuration parameters.
Study Brief Configuration: ${sectionConstraint}

You MUST return a raw JSON object that EXACTLY matches this schema. Do not include markdown wrappers.
{
  "guideTitle": "Mastering EDM 205",
  "phases": [
    {
      "phaseId": "1",
      "title": "Phase 1: Core Definitions",
      "microBites": [
        "Educational Planning is the systematic process of...",
        "It requires resource allocation and..."
      ],
      "flashcards": [
        { "question": "What is Educational Planning?", "answer": "A systematic process..." }
      ]
    }
  ]
}

Document Context:
${text.substring(0, 40000)}
`;

    let contentParts: any[] = [prompt];
    if (text === "Attached document content for extraction.") {
       contentParts = [
         prompt, 
         { inlineData: { data: buffer.toString('base64'), mimeType } }
       ];
    }

    let result;
    try {
      result = await model.generateContent({
        contents: [{ role: "user", parts: contentParts.map(p => typeof p === 'string' ? { text: p } : p) }],
        generationConfig: { responseMimeType: "application/json" }
      });
    } catch (aiError: any) {
      console.error("Study Guide Gen Error:", aiError);
      return NextResponse.json({ error: aiError.message || "Failed to communicate with AI model." }, { status: 500 });
    }
    
    const response = await result.response;
    const markdownOut = response.text();
    
    let parsedJson;
    try {
      parsedJson = JSON.parse(markdownOut);
    } catch (e) {
      console.error("JSON Parse failed on raw AI output:", e);
      console.log("--- RAW AI OUTPUT START ---");
      console.log(markdownOut);
      console.log("--- RAW AI OUTPUT END ---");
      try {
        const cleaned = markdownOut.replace(/```json/g, '').replace(/```/g, '').trim();
        parsedJson = JSON.parse(cleaned);
      } catch (cleanError) {
        console.error("Cleaned JSON Parse failed:", cleanError);
        throw new Error("AI returned malformed JSON");
      }
    }
    try {
      const origin = req.headers.get('origin') || new URL(req.url).origin;
      const cookieHeader = req.headers.get('cookie');
      await fetch(`${origin}/api/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(cookieHeader ? { 'cookie': cookieHeader } : {}) },
        body: JSON.stringify({ action: 'generate_guide' })
      });
    } catch (metricErr) {
      console.error("Failed to update gamification metric:", metricErr);
    }

    return NextResponse.json({ studyGuide: parsedJson });

  } catch (error: any) {
    console.error("Study Guide Route Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

```

### `app\api\engine\query\route.ts`
```ts
import { streamText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const urlWorkspaceId = url.searchParams.get('workspaceId');
    const urlSources = url.searchParams.get('sources');
    const { messages, data, activeSources: bodyActiveSources, workspaceId: bodyWorkspaceId, userProfile } = await req.json();
    
    const workspaceId = data?.workspaceId || urlWorkspaceId || bodyWorkspaceId;

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized: Please log in." }), { status: 401 });
    }

    const explicitlyPassedDocIds = (data?.activeSources || bodyActiveSources || []).map((s: any) => s.id).filter(Boolean);
    if (explicitlyPassedDocIds.length === 0 && urlSources) {
      explicitlyPassedDocIds.push(...urlSources.split(',').filter(Boolean));
    }

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Missing messages." }), { status: 400 });
    }

    const normalizedMessages = messages.map((msg: any) => ({
      ...msg,
      content: msg.content || (msg.parts ? msg.parts.map((p: any) => p.text || '').join('') : '')
    }));

    const userQueryText = normalizedMessages[normalizedMessages.length - 1]?.content || "";
    
    // Save user message to database if workspaceId is present
    if (workspaceId) {
      try {
        await prisma.message.create({
          data: {
            role: 'user',
            text: userQueryText,
            workspaceId
          }
        });
      } catch (e) {
        console.error("Failed to save user message:", e);
      }
    }

    // 1. Fetch Workspace Metadata First
    // Prioritize activeSources (which are the files the user specifically clicked in their workspace UI)
    let docNames = "";
    let targetDocIds: string[] = [];
    let fetchedDocs: any[] = [];
    
    // We prioritize explicit URL sources to bypass stale frontend body closures
    if (explicitlyPassedDocIds.length > 0) {
      fetchedDocs = await prisma.document.findMany({
        where: { 
          id: { in: explicitlyPassedDocIds },
          ...(workspaceId ? { workspaceId } : {}) // STRICT ISOLATION only if workspaceId exists
        }
      });
    } else if (workspaceId) {
      // Fallback to fetching all workspace docs
      fetchedDocs = await prisma.document.findMany({
        where: { workspaceId }
      });
    }
    
    docNames = fetchedDocs.map((d: any) => d.name).join(', ');
    targetDocIds = fetchedDocs.map((d: any) => d.id);

    let searchContext = "";

    // 2. pgvector similarity search
    if (targetDocIds.length > 0 && userQueryText.trim().length > 0) {
      try {
        const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
        const queryResult = await embeddingModel.embedContent(userQueryText);
        let queryEmbedding = queryResult.embedding.values;
        if (queryEmbedding.length > 768) {
          queryEmbedding = queryEmbedding.slice(0, 768);
        }

        // Use Prisma raw query to search vectors, scoped to the active document IDs
        const docIdsParam = targetDocIds.map(id => `'${id}'`).join(',');
        
        // Execute pgvector search
        const matches: any[] = await prisma.$queryRawUnsafe(`
          SELECT c."content", d."name" as "documentName", 1 - (c."embedding" <=> $1::vector) as similarity
          FROM "DocumentChunk" c
          JOIN "Document" d ON c."documentId" = d."id"
          WHERE c."documentId" IN (${docIdsParam}) ${workspaceId ? `AND d."workspaceId" = '${workspaceId}'` : ''}
          ORDER BY c."embedding" <=> $1::vector
          LIMIT 20
        `, `[${queryEmbedding.join(',')}]`);

        // 3. Build a Meta-Query Fallback
        const highestSimilarity = matches.length > 0 ? matches[0].similarity : 0;
        
        if (highestSimilarity < 0.65 || matches.length === 0) {
          // Fallback: If similarity is low, it's likely a meta-question like "what is this about?"
          // Pull the first 3 chunks of each document to summarize
          const fallbackChunks: any[] = await prisma.$queryRawUnsafe(`
            SELECT sub."content", d."name" as "documentName"
            FROM (
              SELECT "content", "documentId",
                     ROW_NUMBER() OVER(PARTITION BY "documentId" ORDER BY "id" ASC) as rn
              FROM "DocumentChunk"
              WHERE "documentId" IN (${docIdsParam})
            ) sub
            JOIN "Document" d ON sub."documentId" = d."id"
            WHERE sub.rn <= 3
          `);
          searchContext += fallbackChunks.map(m => `[Source Document: ${m.documentName}]\n${m.content}`).join("\n\n---\n\n");
        } else {
          // Use the high-confidence vector matches
          searchContext += matches.map(m => `[Source Document: ${m.documentName}]\n${m.content}`).join("\n\n---\n\n");
        }
      } catch (err) {
        console.error("Vector search error:", err);
      }
    }

    // 3. Format Conversation History for Strict Memory Tracking
    let formattedConversationHistory = "";
    normalizedMessages.slice(0, -1).forEach((msg: any, index: number) => {
      formattedConversationHistory += `[interaction_id: ${index + 1}]`;
      if (index > 0) {
        formattedConversationHistory += ` [previous_interaction_id: ${index}]\n`;
      } else {
        formattedConversationHistory += `\n`;
      }
      formattedConversationHistory += `Role: ${msg.role}\nMessage: ${msg.content}\n\n`;
    });

    // 4. Hard-Inject File Awareness into the System Prompt
    const systemPrompt = `CRITICAL CONTEXT: The user is currently inside a workspace that contains the following uploaded study documents: [${docNames}]. You have full access to these materials via the injected chunks below. Never say you do not have access to these files.

YOU ARE AN ELITE ACADEMIC TUTOR AND EXAM STRATEGIST. Your sole purpose is to help university students master their course materials, synthesize complex information, and ace their exams. You are empathetic, proactive, and highly structured.

Rule 1: Your primary knowledge must come strictly from the provided DocumentChunks. If the user asks what the materials are about, analyze the text and mention the specific details present (e.g., specific instructors, specific technical indicators like Dojis or Ema mentioned in the text). Do not speak in broad, generic subject terms if they aren't in the chunks.

Rule 2: If the user asks a question that requires external knowledge or goes beyond what is written in the document, you MUST explicitly state: "This information is not explicitly found in your uploaded materials, but based on general best practices..." before providing the answer. Never hallucinate that external information is part of the document.

Rule 3: You must maintain perfect continuity across the entire conversation history. When the user uses pronouns or references previous explanations (e.g., "explain that rule further"), cross-reference the chat history to identify the exact topic before querying the vector database or answering.

[WORKSPACE METADATA]
User Profile Context (Name, School, Department, Courses):
${JSON.stringify(userProfile)}

[VECTOR CHUNKS]
Extracted Context from Workspace Files:
${searchContext ? searchContext : "No relevant content found in the files for this specific query."}

[LINKED CONVERSATION HISTORY]
${formattedConversationHistory ? formattedConversationHistory : "No previous conversation history."}`;

    // 5. Stream response using Vercel AI SDK
    console.log("🧠 AI System Prompt Length:", searchContext.length, "| First 100 chars:", searchContext.substring(0, 100));
    
    const result = streamText({
      model: google('gemini-3.5-flash'),
      system: systemPrompt,
      messages: normalizedMessages,
      async onFinish({ text }) {
        if (workspaceId) {
          try {
            await prisma.message.create({
              data: {
                role: 'assistant',
                text,
                workspaceId
              }
            });
          } catch (e) {
            console.error("Failed to save assistant message:", e);
          }
        }
      }
    });

    return result.toUIMessageStreamResponse();

  } catch (error: any) {
    console.error("Query Error:", error);
    if (error.message?.includes("503") || error.message?.includes("high demand") || error.message?.includes("Service Unavailable")) {
      return new Response("The AI servers are currently experiencing high demand. Please try again in a few minutes.", { status: 503 });
    }
    return new Response(error.message || "Failed to generate response", { status: 500 });
  }
}

```

### `app\api\engine\title\route.ts`
```ts
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt." }, { status: 400 });
    }

    const modelConfig: any = { 
      model: "gemini-3.5-flash",
      systemInstruction: "Generate a short, 3-to-4 word title summarizing the user's prompt. Do not use quotes, punctuation, or special formatting."
    };
    
    const chatModel = genAI.getGenerativeModel(modelConfig);
    const chatResult = await chatModel.generateContent(prompt);
    let title = chatResult.response.text().trim();
    
    // Remove wrapping quotes if Gemini adds them
    if (title.startsWith('"') && title.endsWith('"')) {
      title = title.slice(1, -1);
    }

    return NextResponse.json({ title });

  } catch (error: any) {
    console.error("Title Generation Error:", error);
    // Fallback title on error
    return NextResponse.json({ title: "New Chat" }, { status: 500 });
  }
}

```

### `app\api\metrics\route.ts`
```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import { ensurePrismaUser } from '@/lib/auth-sync';

function getMidnightDate(date: Date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensurePrismaUser(user);

    const today = getMidnightDate(new Date());
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);

    let metrics: any[] = [];
    try {
      metrics = await prisma.dailyMetric.findMany({
        where: {
          userId: user.id,
          date: {
            gte: sevenDaysAgo,
            lte: today,
          }
        },
        orderBy: {
          date: 'asc'
        }
      });
    } catch (e) {
      console.warn("Database error in metrics GET, returning empty metrics:", e);
      // Proceed with empty metrics array
    }

    const todayMetric = metrics.find(m => m.date.getTime() === today.getTime()) || {
      focusMinutes: 0,
      tasksCompleted: 0,
      averageAccuracy: 0,
    };

    // Build the 7-day array
    const weekDays = [];
    const streakData = [];
    const historicalFocusMinutes = [];
    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    
    let currentStreak = 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(sevenDaysAgo.getDate() + i);
      weekDays.push(dayNames[d.getDay()]);
      
      const metricForDay = metrics.find(m => m.date.getTime() === d.getTime());
      const isActive = metricForDay ? metricForDay.focusMinutes > 0 : false;
      streakData.push(isActive);
      historicalFocusMinutes.push(metricForDay ? metricForDay.focusMinutes : 0);
    }
    
    // Reverse count from today for streak
    for (let i = 6; i >= 0; i--) {
      if (streakData[i]) {
        currentStreak++;
      } else {
        break; // Streak broken
      }
    }

    return NextResponse.json({
      today: todayMetric,
      weekDays,
      streakData,
      historicalFocusMinutes,
      currentStreak
    });
  } catch (error: any) {
    console.error("Metrics GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensurePrismaUser(user);

    const body = await req.json();
    const { action } = body;

    const today = getMidnightDate(new Date());

    let updateData: any = {};
    let createData: any = {
      date: today,
      userId: user.id,
      focusMinutes: 0,
      tasksCompleted: 0,
      averageAccuracy: 0,
    };

    if (action === 'generate_guide') {
      updateData.focusMinutes = { increment: 15 };
      updateData.tasksCompleted = { increment: 1 };
      createData.focusMinutes = 15;
      createData.tasksCompleted = 1;
    } else if (action === 'upload_document') {
      updateData.focusMinutes = { increment: 5 };
      updateData.tasksCompleted = { increment: 1 };
      createData.focusMinutes = 5;
      createData.tasksCompleted = 1;
    } else if (action === 'flashcard_review') {
      updateData.focusMinutes = { increment: 10 };
      updateData.tasksCompleted = { increment: 1 };
      createData.focusMinutes = 10;
      createData.tasksCompleted = 1;
    } else if (action === 'chat_message') {
      updateData.focusMinutes = { increment: 1 };
      createData.focusMinutes = 1;
    } else if (action === 'generate_asset') {
      updateData.focusMinutes = { increment: 10 };
      updateData.tasksCompleted = { increment: 1 };
      createData.focusMinutes = 10;
      createData.tasksCompleted = 1;
    } else if (action === 'read_document') {
      updateData.focusMinutes = { increment: 20 };
      updateData.tasksCompleted = { increment: 1 };
      createData.focusMinutes = 20;
      createData.tasksCompleted = 1;
    } else if (action === 'complete_phase') {
      updateData.focusMinutes = { increment: 25 };
      updateData.tasksCompleted = { increment: 1 };
      createData.focusMinutes = 25;
      createData.tasksCompleted = 1;
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const metric = await prisma.dailyMetric.upsert({
      where: {
        date_userId: {
          date: today,
          userId: user.id
        }
      },
      update: updateData,
      create: createData,
    });

    return NextResponse.json({ success: true, metric });
  } catch (error: any) {
    console.error("Metrics POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

```

### `app\api\settings\route.ts`
```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import { ensurePrismaUser } from '@/lib/auth-sync';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await ensurePrismaUser(user);

    let dbUser;
    try {
      dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: { preferences: true }
      });

      // Return a default object if userPreferences is null so the UI can render
      if (!dbUser.preferences) {
        (dbUser as any).preferences = {
          theme: 'system',
          sidebarMode: 'expanded',
          dailyFocusGoal: 120,
          guideComplexity: 'standard'
        };
      }
    } catch (e) {
      console.warn("Database error in settings GET, falling back:", e);
      return NextResponse.json({
        id: user.id,
        email: user.email || '',
        username: user.email?.split('@')[0] || 'Student',
        preferences: {
          theme: 'system',
          sidebarMode: 'expanded',
          dailyFocusGoal: 120,
          guideComplexity: 'standard'
        }
      });
    }

    return NextResponse.json(dbUser);
  } catch (error) {
    console.error("Settings GET Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await ensurePrismaUser(user);

    const data = await req.json();
    const { username, school, department, preferences } = data;

    // Robust upsert for User profile
    const updatedUser = await prisma.user.upsert({
      where: { id: user.id },
      update: {
        username: username !== undefined ? username : undefined,
        school: school !== undefined ? school : undefined,
        department: department !== undefined ? department : undefined,
      },
      create: {
        id: user.id,
        email: user.email || '',
        username: username,
        school: school,
        department: department,
      }
    });

    // Robust upsert for UserPreferences
    let updatedPreferences = null;
    if (preferences) {
      const { theme, sidebarMode, dailyFocusGoal, guideComplexity } = preferences;
      updatedPreferences = await prisma.userPreferences.upsert({
        where: { userId: user.id },
        update: {
          theme: theme !== undefined ? theme : undefined,
          sidebarMode: sidebarMode !== undefined ? sidebarMode : undefined,
          dailyFocusGoal: dailyFocusGoal !== undefined ? parseInt(dailyFocusGoal) : undefined,
          guideComplexity: guideComplexity !== undefined ? guideComplexity : undefined
        },
        create: {
          userId: user.id,
          theme: theme || "system",
          sidebarMode: sidebarMode || "expanded",
          dailyFocusGoal: dailyFocusGoal ? parseInt(dailyFocusGoal) : 120,
          guideComplexity: guideComplexity || "standard"
        }
      });
    }

    return NextResponse.json({ user: updatedUser, preferences: updatedPreferences });
  } catch (error) {
    console.error("Settings POST Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

```

### `app\api\studio\assets\route.ts`
```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');
    const userId = searchParams.get('userId');

    if (!workspaceId && !userId) {
      return NextResponse.json({ error: "Missing workspaceId or userId" }, { status: 400 });
    }

    const whereClause = workspaceId ? { workspaceId } : { workspace: { userId } };

    const assets = await prisma.studioAsset.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ assets });

  } catch (error: any) {
    console.error("Fetch Studio Assets Error:", error);
    return NextResponse.json({ 
      error: "Failed to fetch studio assets. Please try again later.",
      isCongested: true
    }, { status: 500 });
  }
}

```

### `app\api\studio\flashcards\route.ts`
```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workspaceId, documentText } = body;

    let textToAnalyze = documentText;

    if (!textToAnalyze && workspaceId) {
      // Fetch all document chunks for this workspace
      const documents = await prisma.document.findMany({
        where: { workspaceId: workspaceId },
        include: { chunks: true }
      });

      let combinedContent = '';
      documents.forEach(doc => {
        doc.chunks.forEach(chunk => {
          combinedContent += chunk.content + '\n';
        });
      });
      textToAnalyze = combinedContent;
    }

    if (!textToAnalyze || textToAnalyze.trim() === '') {
      return NextResponse.json({ error: "No text provided or found in the workspace." }, { status: 400 });
    }

    // Limit text to avoid exceeding token limits (rough approximation)
    if (textToAnalyze.length > 50000) {
      textToAnalyze = textToAnalyze.substring(0, 50000);
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const systemPrompt = `You are an expert educational tutor. Analyze the provided text and generate 10 highly effective flashcards. Output strictly as a JSON array of objects with the keys "question" and "answer". Do not include any markdown formatting, conversational text, or backticks outside of the raw JSON array.`;
    
    const finalPrompt = `${systemPrompt}\n\nText to analyze:\n${textToAnalyze}`;

    const result = await model.generateContent(finalPrompt);
    const responseText = result.response.text();
    
    // Parse the JSON array to ensure it's valid before sending it back
    let flashcards;
    try {
      flashcards = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON:", responseText);
      return NextResponse.json({ error: "Failed to parse AI response into flashcards." }, { status: 500 });
    }

    return NextResponse.json(flashcards);

  } catch (error: any) {
    console.error("Flashcards Generation Error:", error);
    
    if (error.message?.includes("503") || error.message?.includes("high demand") || error.message?.includes("Service Unavailable")) {
      return NextResponse.json({ 
        error: "The AI servers are currently experiencing high demand. Please try again in a few minutes.",
        isCongested: true
      }, { status: 503 });
    }

    return NextResponse.json({ error: error.message || "Failed to generate flashcards." }, { status: 500 });
  }
}

```

### `app\api\studio\mindmap\route.ts`
```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workspaceId, documentText } = body;

    let textToAnalyze = documentText;

    if (!textToAnalyze && workspaceId) {
      // Fetch all document chunks for this workspace
      const documents = await prisma.document.findMany({
        where: { workspaceId: workspaceId },
        include: { chunks: true }
      });

      let combinedContent = '';
      documents.forEach(doc => {
        doc.chunks.forEach(chunk => {
          combinedContent += chunk.content + '\n';
        });
      });
      textToAnalyze = combinedContent;
    }

    if (!textToAnalyze || textToAnalyze.trim() === '') {
      return NextResponse.json({ error: "No text provided or found in the workspace." }, { status: 400 });
    }

    // Limit text to avoid exceeding token limits (rough approximation)
    if (textToAnalyze.length > 50000) {
      textToAnalyze = textToAnalyze.substring(0, 50000);
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const systemPrompt = `You are an expert visual educator. Analyze the provided text and map out the core concepts and their relationships using standard Mermaid.js flowchart syntax. You MUST use graph TD. You MUST create a deep, vertical, hierarchical tree with a single root node at the top, branching downwards into sub-topics. Do NOT create a flat horizontal list of disconnected nodes. Keep the node text concise. Output strictly as a JSON object with a single key "mermaidCode" containing the raw Mermaid syntax string. Do not include markdown backticks (like \`\`\`mermaid), HTML, or conversational filler.`;
    
    const finalPrompt = `${systemPrompt}\n\nText to analyze:\n${textToAnalyze}`;

    const result = await model.generateContent(finalPrompt);
    const responseText = result.response.text();
    
    // Parse the JSON object to ensure it's valid before sending it back
    let mindmapData;
    try {
      mindmapData = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON:", responseText);
      return NextResponse.json({ error: "Failed to parse AI response into mindmap data." }, { status: 500 });
    }

    return NextResponse.json(mindmapData);

  } catch (error: any) {
    console.error("Mindmap Generation Error:", error);
    
    if (error.message?.includes("503") || error.message?.includes("high demand") || error.message?.includes("Service Unavailable")) {
      return NextResponse.json({ 
        error: "The AI servers are currently experiencing high demand. Please try again in a few minutes.",
        isCongested: true
      }, { status: 503 });
    }

    return NextResponse.json({ error: error.message || "Failed to generate mindmap." }, { status: 500 });
  }
}

```

### `app\api\studio\presentation\route.ts`
```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workspaceId, documentText } = body;

    let textToAnalyze = documentText;

    if (!textToAnalyze && workspaceId) {
      // Fetch all document chunks for this workspace
      const documents = await prisma.document.findMany({
        where: { workspaceId: workspaceId },
        include: { chunks: true }
      });

      let combinedContent = '';
      documents.forEach(doc => {
        doc.chunks.forEach(chunk => {
          combinedContent += chunk.content + '\n';
        });
      });
      textToAnalyze = combinedContent;
    }

    if (!textToAnalyze || textToAnalyze.trim() === '') {
      return NextResponse.json({ error: "No text provided or found in the workspace." }, { status: 400 });
    }

    // Limit text to avoid exceeding token limits (rough approximation)
    if (textToAnalyze.length > 50000) {
      textToAnalyze = textToAnalyze.substring(0, 50000);
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const systemPrompt = `You are an expert presentation designer. Analyze the text and create a 5-slide presentation outline. Output strictly as a JSON object with a slides array. Each slide object must have a title (string) and bulletPoints (array of strings, max 4 per slide). Do not include markdown formatting.`;
    
    const finalPrompt = `${systemPrompt}\n\nText to analyze:\n${textToAnalyze}`;

    const result = await model.generateContent(finalPrompt);
    const responseText = result.response.text();
    
    // Parse the JSON object to ensure it's valid before sending it back
    let presentationData;
    try {
      presentationData = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON:", responseText);
      return NextResponse.json({ error: "Failed to parse AI response into presentation data." }, { status: 500 });
    }

    return NextResponse.json(presentationData);

  } catch (error: any) {
    console.error("Presentation Generation Error:", error);
    
    // Clean standard message for all downstream errors (including 429, 503, quotas)
    return NextResponse.json({ 
      error: "The AI servers are currently busy or out of quota. Please try again later.",
      isCongested: true
    }, { status: 503 });
  }
}

```

### `app\api\studio\save-asset\route.ts`
```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workspaceId, title, type, content } = body;

    if (!workspaceId || !title || !type || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const newAsset = await prisma.studioAsset.create({
      data: {
        workspaceId,
        title,
        type,
        content
      }
    });

    return NextResponse.json({ success: true, asset: newAsset });

  } catch (error: any) {
    console.error("Save Guide Error:", error);
    return NextResponse.json({ 
      error: "Failed to save the asset. Please try again later."
    }, { status: 500 });
  }
}

```

### `app\api\study-guides\progress\route.ts`
```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import { ensurePrismaUser } from '@/lib/auth-sync';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await ensurePrismaUser(user);

    const { searchParams } = new URL(req.url);
    const guideId = searchParams.get('guideId');
    if (!guideId) return NextResponse.json({ error: "Missing guideId" }, { status: 400 });

    const progress = await prisma.studyGuideProgress.findMany({
      where: {
        userId: user.id,
        guideId: guideId,
        completed: true
      },
      select: {
        phaseId: true
      }
    });

    const completedPhases = progress.map(p => p.phaseId);
    return NextResponse.json({ completedPhases });
  } catch (error: any) {
    console.error("GET Progress Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await ensurePrismaUser(user);

    const data = await req.json();
    const { guideId, phaseId } = data;

    if (!guideId || !phaseId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const newProgress = await prisma.studyGuideProgress.upsert({
      where: {
        userId_guideId_phaseId: {
          userId: user.id,
          guideId: guideId,
          phaseId: phaseId
        }
      },
      update: {
        completed: true
      },
      create: {
        userId: user.id,
        guideId: guideId,
        phaseId: phaseId,
        completed: true
      }
    });

    return NextResponse.json(newProgress);
  } catch (error: any) {
    console.error("POST Progress Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

```

### `app\api\study-guides\route.ts`
```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import { ensurePrismaUser } from '@/lib/auth-sync';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensurePrismaUser(user);

    const studyGuides = await prisma.studyGuide.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(studyGuides);
  } catch (error) {
    console.error("API Crash Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensurePrismaUser(user);

    const { sourceDocumentId, sourceDocumentName, sectionConstraint, markdownContent, strategyData } = await req.json();

    const newGuide = await prisma.studyGuide.create({
      data: {
        userId: user.id,
        sourceDocumentId,
        sourceDocumentName,
        sectionConstraint,
        markdownContent,
        strategyData
      }
    });

    return NextResponse.json(newGuide);
  } catch (error) {
    console.error("API Crash Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

```

### `app\api\study-guides\[id]\route.ts`
```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: "Missing userId for authorization" }, { status: 400 });
    }

    const guide = await prisma.studyGuide.findUnique({ where: { id: params.id } });
    
    if (!guide) {
        return NextResponse.json({ error: "Guide not found" }, { status: 404 });
    }

    // Verify ownership
    if (guide.userId !== userId) {
        return NextResponse.json({ error: "Unauthorized: You do not have permission to delete this guide." }, { status: 403 });
    }

    await prisma.studyGuide.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API Crash Error on Delete:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

```

### `app\api\users\route.ts`
```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    return NextResponse.json(dbUser || {});
  } catch (error) {
    return NextResponse.json({ error: "Unknown server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const data = await req.json();
    const { username, school, department } = data;

    const newUser = await prisma.user.upsert({
      where: { id: user.id },
      update: {
        username,
        school,
        department
      },
      create: {
        id: user.id,
        email: user.email!,
        username,
        school,
        department
      }
    });

    return NextResponse.json(newUser);
  } catch (error) {
    console.error("API Crash Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

```

### `app\api\workspaces\route.ts`
```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const includeEmpty = searchParams.get('includeEmpty') === 'true';

    const whereClause: any = {
      userId: userId ? userId : null,
      id: { not: 'global-vault-001' }
    };

    if (!includeEmpty) {
      whereClause.documents = { some: {} };
    }

    const workspaces = await prisma.workspace.findMany({
      where: whereClause,
      include: {
        documents: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(workspaces);
  } catch (error) {
    console.error("API Crash Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId, userEmail } = await req.json();

    let validUserId = null;
    if (userId) {
      let uEmail = userEmail;
      if (!uEmail || uEmail === 'guest@example.com') {
        uEmail = `guest_${userId}@example.com`;
      }
      try {
        await prisma.user.upsert({
          where: { id: userId },
          update: {},
          create: { id: userId, email: uEmail }
        });
        validUserId = userId;
      } catch (upsertError) {
        console.error("Failed to upsert user with email, trying fallback:", upsertError);
        try {
          // If unique constraint fails, forcefully create with unique email
          await prisma.user.upsert({
            where: { id: userId },
            update: {},
            create: { id: userId, email: `${userId}_${uEmail}` }
          });
          validUserId = userId;
        } catch(fallbackError) {
          console.error("Critical failure upserting user:", fallbackError);
          // Only if absolutely everything fails do we fallback to null
          validUserId = null;
        }
      }
    }

    const newWorkspace = await prisma.workspace.create({
      data: {
        title: 'Untitled workspace',
        userId: validUserId
      }
    });

    return NextResponse.json(newWorkspace);
  } catch (error) {
    console.error("API Crash Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

```

### `app\api\workspaces\[id]\messages\route.ts`
```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const workspaceId = resolvedParams.id;

    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspace id" }, { status: 400 });
    }

    const messages = await prisma.message.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error("API Crash Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

```

### `app\api\workspaces\[id]\rename\route.ts`
```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const workspaceId = resolvedParams.id;
    const { fileName, manualTitle } = await req.json();

    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspace id" }, { status: 400 });
    }

    let cleanTitle = "";
    if (manualTitle) {
      cleanTitle = manualTitle.trim();
    } else {
      const { text } = await generateText({
        model: google('gemini-3.5-flash'),
        prompt: `Generate a highly professional, short academic title (max 4 words) for a study workspace based on this material: ${fileName || 'General academic study notes'}. Respond ONLY with the generated title.`,
      });
      cleanTitle = text.trim().replace(/^["'](.*)["']$/, '$1');
    }

    const updatedWorkspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { title: cleanTitle }
    });

    return NextResponse.json({ title: updatedWorkspace.title });
  } catch (error) {
    console.error("API Crash Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown server error";
    
    if (errorMessage.includes("503") || errorMessage.includes("high demand") || errorMessage.includes("Service Unavailable")) {
      return NextResponse.json({ 
        error: "The AI servers are currently experiencing high demand. Please try renaming later.",
        isCongested: true
      }, { status: 503 });
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

```

### `app\api\workspaces\[id]\route.ts`
```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const workspaceId = resolvedParams.id;

    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspace id" }, { status: 400 });
    }

    // 0. Ensure Global Vault exists
    await prisma.workspace.upsert({
      where: { id: 'global-vault-001' },
      update: {},
      create: {
        id: 'global-vault-001',
        title: 'My Global Vault',
      },
    });

    // 1. Move all documents for this workspace into the Global Vault so they survive the Cascade
    await prisma.document.updateMany({
      where: { workspaceId },
      data: { workspaceId: 'global-vault-001' }
    });

    // 2. Delete the workspace (Cascade will handle Messages, but Documents are safe now)
    try {
      await prisma.workspace.delete({
        where: { id: workspaceId }
      });
    } catch (dbError: any) {
      if (dbError.code === 'P2025') {
        // Record already deleted, safely ignore
      } else {
        throw dbError;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API Crash Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

```

### `app\api\workspaces\[id]\youtube\route.ts`
```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { YoutubeTranscript } from 'youtube-transcript';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: workspaceId } = await params;
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: "Missing or invalid URL" }, { status: 400 });
    }

    let name = "YouTube Video";
    try {
      const oembed = await fetch('https://www.youtube.com/oembed?url=' + url + '&format=json');
      const oembedData = await oembed.json();
      if (oembedData.title) {
        name = oembedData.title;
      }
    } catch (e) {
      console.warn("Failed to fetch YouTube title:", e);
    }

    // Fetch the transcript
    let transcriptItems;
    try {
      transcriptItems = await YoutubeTranscript.fetchTranscript(url);
    } catch (fetchError) {
      return NextResponse.json({ 
        error: "No transcript or captions are available for this video. Possible reasons include: The creator disabled captions, there is no speech in the video, the video is age-restricted or private, or it is an active live stream."
      }, { status: 400 });
    }

    const transcriptText = transcriptItems.map(item => item.text).join(' ');
    console.log("Saved transcript length:", transcriptText.length);

    // Save to the database
    const newDoc = await prisma.document.create({
      data: {
        name,
        url,
        workspaceId,
        sourceType: "youtube",
        textContent: transcriptText
      }
    });

    return NextResponse.json(newDoc);
  } catch (error) {
    console.error("YouTube Transcriber Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to transcribe YouTube video";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

```

### `app\auth\callback\route.ts`
```ts
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )
    
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=AuthFailed`)
}

```

### `app\error.tsx`
```tsx
"use client";

import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global Error Boundary caught an error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-black text-white p-4 text-center">
      <div className="max-w-md bg-[#18181B] border border-[#27272A] rounded-xl p-8 shadow-lg">
        <h2 className="text-2xl font-bold text-[#EA580C] mb-4 font-space-grotesk">
          Oops, this part of CogniBase hit a snag.
        </h2>
        <p className="text-[#A1A1AA] mb-6">
          We encountered an unexpected error while loading this page. Our systems have been notified.
        </p>
        <button
          onClick={() => reset()}
          className="bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-md"
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
}

```

### `app\globals.css`
```css
@import "tailwindcss";
@source "../components";
@source "../app";

@layer base {
  body {
    background-color: #000000;
    background-image: radial-gradient(circle at top, #1f1f1f 0%, #000000 70%);
    color: #ffffff;
    min-height: 100vh;
  }
}

```

### `app\hooks\useThrottle.ts`
```ts
import { useState, useCallback } from 'react';

export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 1500
) {
  const [isThrottled, setIsThrottled] = useState(false);

  const throttledFunction = useCallback(
    (...args: Parameters<T>) => {
      if (isThrottled) {
        return;
      }
      setIsThrottled(true);
      setTimeout(() => {
        setIsThrottled(false);
      }, delay);
      
      return callback(...args);
    },
    [callback, isThrottled, delay]
  );

  return { throttledFunction, isThrottled };
}

```

### `app\layout.tsx`
```tsx
import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const spaceGrotesk = Space_Grotesk({ 
  subsets: ['latin'],
  variable: '--font-space-grotesk',
});

const plusJakartaSans = Plus_Jakarta_Sans({ 
  subsets: ['latin'],
  variable: '--font-plus-jakarta-sans',
});

export const metadata: Metadata = {
  title: 'CogniBase',
  description: 'AI Study & Exam Prep. Your entire semester, synthesized.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  interactiveWidget: 'resizes-content',
};

import { Toaster } from 'sonner';
import { UserProvider } from '@/lib/hooks/useUserContext';
import { ThemeProvider } from '@/components/ThemeProvider';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${plusJakartaSans.className} ${spaceGrotesk.variable} antialiased min-h-dvh`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <UserProvider>
            {children}
            <Toaster position="bottom-right" theme="dark" richColors closeButton />
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

```

### `app\page.tsx`
```tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 w-full max-w-4xl mx-auto text-center" style={{ backgroundColor: "#000000" }}>
      
      {/* Official Logo */}
      <img 
        src="/logo.png" 
        alt="CogniBase Logo" 
        style={{ width: "12rem", height: "auto", margin: "0 auto 3rem auto", display: "block", objectFit: "contain" }} 
      />

      <h1 style={{ fontSize: "clamp(2.1rem, 7vw, 4.5rem)", fontWeight: "bold", letterSpacing: "-0.05em", lineHeight: "1.1", marginBottom: "2rem" }}>
        <span style={{ color: "white" }}>Every lecture,</span>
        <br />
        <span style={{
          background: "linear-gradient(to right, #EA580C, #F59E0B, #EAB308)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          color: "transparent"
        }}>
          perfectly synthesized.
        </span>
      </h1>
      
      <p style={{ color: "#A1A1AA", fontSize: "1.15rem", maxWidth: "36rem", margin: "0 auto 3rem auto", lineHeight: "1.6" }}>
        CogniBase transforms scattered notes and coursework into a high-performance, intelligent study terminal.
      </p>
      
      <Link href="/login" style={{ textDecoration: "none" }}>
        <button style={{
          backgroundColor: "#EA580C",
          color: "white",
          padding: "1rem 2.5rem",
          borderRadius: "0.75rem",
          fontWeight: "bold",
          fontSize: "1.125rem",
          border: "none",
          cursor: "pointer",
          boxShadow: "0 0 40px rgba(234,88,12,0.4)",
          transition: "transform 0.2s"
        }}>
          Get Started
        </button>
      </Link>

    </main>
  );
}

```

### `components\AnalyticsCharts.tsx`
```tsx
"use client";

import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type TimeFrame = 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';

const dummyData = {
  Daily: [
    { name: '6 AM', focus: 20, tasks: 1 },
    { name: '9 AM', focus: 45, tasks: 3 },
    { name: '12 PM', focus: 60, tasks: 4 },
    { name: '3 PM', focus: 30, tasks: 2 },
    { name: '6 PM', focus: 90, tasks: 6 },
    { name: '9 PM', focus: 15, tasks: 1 },
  ],
  Weekly: [
    { name: 'Mon', focus: 120, tasks: 5 },
    { name: 'Tue', focus: 180, tasks: 8 },
    { name: 'Wed', focus: 90, tasks: 3 },
    { name: 'Thu', focus: 210, tasks: 10 },
    { name: 'Fri', focus: 60, tasks: 2 },
    { name: 'Sat', focus: 240, tasks: 12 },
    { name: 'Sun', focus: 150, tasks: 7 },
  ],
  Monthly: [
    { name: 'Week 1', focus: 800, tasks: 35 },
    { name: 'Week 2', focus: 950, tasks: 42 },
    { name: 'Week 3', focus: 700, tasks: 28 },
    { name: 'Week 4', focus: 1100, tasks: 50 },
  ],
  Yearly: [
    { name: 'Jan', focus: 3000, tasks: 120 },
    { name: 'Feb', focus: 3200, tasks: 130 },
    { name: 'Mar', focus: 2800, tasks: 110 },
    { name: 'Apr', focus: 4000, tasks: 160 },
    { name: 'May', focus: 3500, tasks: 140 },
    { name: 'Jun', focus: 3800, tasks: 150 },
  ]
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-800/90 backdrop-blur-md border border-zinc-700/50 p-4 rounded-xl shadow-xl">
        <p className="text-zinc-300 font-semibold mb-3">{label}</p>
        <div className="flex flex-col gap-2">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-sm text-zinc-100 font-medium">
                {entry.name === 'focus' ? 'Focus Minutes' : 'Tasks Completed'}:
              </span>
              <span className="text-sm font-bold text-white ml-auto pl-4">
                {entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function AnalyticsCharts() {
  const [timeframe, setTimeframe] = useState<TimeFrame>('Weekly');

  const data = dummyData[timeframe];

  return (
    <div className="w-full bg-zinc-950 p-6 sm:p-8 rounded-[2.5rem] shadow-2xl border border-zinc-800/50 flex flex-col">
      {/* Segmented Control */}
      <div className="flex bg-zinc-900/80 p-1 rounded-full mb-8 max-w-md mx-auto border border-zinc-800">
        {(['Daily', 'Weekly', 'Monthly', 'Yearly'] as TimeFrame[]).map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`flex-1 py-2 px-4 rounded-full text-sm font-semibold transition-all duration-300 ${
              timeframe === tf
                ? 'bg-zinc-700 text-white shadow-md'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="w-full h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorFocus" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F97316" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#F97316" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#71717A', fontSize: 12 }} 
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#71717A', fontSize: 12 }} 
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#3F3F46', strokeWidth: 1, strokeDasharray: '4 4' }} />
            <Area 
              type="monotone" 
              dataKey="focus" 
              stroke="#3B82F6" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorFocus)" 
              activeDot={{ r: 6, fill: '#3B82F6', stroke: '#18181b', strokeWidth: 2 }}
            />
            <Area 
              type="monotone" 
              dataKey="tasks" 
              stroke="#F97316" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorTasks)" 
              activeDot={{ r: 6, fill: '#F97316', stroke: '#18181b', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

```

### `components\AnalyticsRings.tsx`
```tsx
"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export interface RingMetrics {
  volumeProgress: number; // 0 to 1
  focusProgress: number;  // 0 to 1
  accuracyProgress: number; // 0 to 1
}

export default function AnalyticsRings({ metrics }: { metrics: RingMetrics }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const size = 320;
  const center = size / 2;
  const strokeWidth = 24;
  const gap = 4;

  const rings = [
    {
      label: 'Volume',
      color: '#F97316', // Orange
      progress: metrics.volumeProgress,
      radius: 120,
    },
    {
      label: 'Focus',
      color: '#3B82F6', // Blue
      progress: metrics.focusProgress,
      radius: 120 - strokeWidth - gap,
    },
    {
      label: 'Accuracy',
      color: '#22C55E', // Green
      progress: metrics.accuracyProgress,
      radius: 120 - (strokeWidth + gap) * 2,
    }
  ];

  return (
    <div className="relative flex items-center justify-center bg-zinc-950 p-8 rounded-[2.5rem] shadow-2xl border border-zinc-800/50" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
        {rings.map((ring, index) => {
          const circumference = 2 * Math.PI * ring.radius;
          return (
            <g key={ring.label}>
              {/* Empty Track */}
              <circle
                cx={center}
                cy={center}
                r={ring.radius}
                stroke="#27272a" // stroke-zinc-800 equivalent
                strokeWidth={strokeWidth}
                fill="none"
              />
              {/* Progress Ring */}
              <motion.circle
                cx={center}
                cy={center}
                r={ring.radius}
                stroke={ring.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: mounted ? circumference * (1 - Math.min(ring.progress, 1)) : circumference }}
                transition={{ duration: 1.5, ease: "easeOut", delay: index * 0.15 }}
                style={{
                  filter: mounted ? `drop-shadow(0 0 6px ${ring.color}80)` : 'none',
                }}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

```

### `components\CommandCenterUI.tsx`
```tsx
'use client';

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Pencil, RefreshCcw, ThumbsUp, ThumbsDown, Headphones, Layers, Network, Presentation } from 'lucide-react';
import FlashcardViewer from './FlashcardViewer';
import MermaidViewer from './MermaidViewer';
import PresentationViewer from './PresentationViewer';
import StudioAssetsPanel from './StudioAssetsPanel';

function ProgressText() {
  const [phase, setPhase] = useState(0);
  const phases = ['Searching document...', 'Analyzing context...', 'Synthesizing response...'];
  
  useEffect(() => {
    const interval = setInterval(() => {
      setPhase((p) => (p + 1) % phases.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);
  
  return <span>{phases[phase]}</span>;
}


interface CommandCenterUIProps {
title?: string;
activeSources?: Array<{ id: string; title: string }>;
onRemoveSource?: (id: string) => void;
onAddSource?: () => void;
onExit?: () => void;
chatMessages?: Array<{ role: string; text: string }>;
chatInput?: string;
setChatInput?: (val: string) => void;
onSendMessage?: () => void;
onUpdateTitle?: (newTitle: string) => void;
isChatLoading?: boolean;
isAssimilating?: boolean;
assimilationStatus?: string;
chatError?: any;
onRetry?: () => void;
onYouTubeSubmit?: (url: string) => Promise<void>;
isWorkspaceReady?: boolean;
workspaceId?: string;
}

const getFriendlyErrorMessage = (error: any) => {
  if (!error) return "";
  const msg = error.message || String(error);
  
  if (msg.includes("429") || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("rate limit") || msg.includes("RESOURCE_EXHAUSTED")) {
    return "The AI is currently receiving too many requests or its usage limits have been reached. Please wait a moment and try again.";
  }
  if (msg.includes("401") || msg.includes("403")) {
    return "There is an issue with the AI's authorization. Please check the system configuration.";
  }
  if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch")) {
    return "There was a network issue communicating with the AI. Please check your internet connection.";
  }
  if (msg.includes("500") || msg.includes("502") || msg.includes("503") || msg.includes("504")) {
    return "The AI servers are currently experiencing temporary issues. Please try again later.";
  }
  
  return "Something went wrong while generating a response. Please try again.";
};

export default function CommandCenterUI({
title = "Untitled Workspace",
activeSources = [],
onRemoveSource = () => {},
onAddSource = () => {},
onExit = () => {},
chatMessages = [],
chatInput = "",
setChatInput = () => {},
onSendMessage = () => {},
onUpdateTitle = () => {},
isChatLoading = false,
isAssimilating = false,
assimilationStatus = "",
chatError = null,
onRetry,
onYouTubeSubmit,
isWorkspaceReady = true,
workspaceId = ""
}: CommandCenterUIProps) {
// UI States
const [mobileTab, setMobileTab] = useState<'chat' | 'studio'>('chat');
const [showFlashcards, setShowFlashcards] = useState(false);
const [showMindMap, setShowMindMap] = useState(false);
const [showPresentation, setShowPresentation] = useState(false);
const [isEditingTitle, setIsEditingTitle] = useState(false);
const [tempTitle, setTempTitle] = useState(title);
const [feedback, setFeedback] = useState<Record<number, 'like' | 'dislike' | undefined>>({});
const [isExpanded, setIsExpanded] = useState(false);
const [youtubeUrl, setYoutubeUrl] = useState("");
const [isYoutubeLoading, setIsYoutubeLoading] = useState(false);
const [youtubeLoadingText, setYoutubeLoadingText] = useState(">_ Bypassing mainframe... scraping captions [     ]");
const [youtubeError, setYoutubeError] = useState<string | null>(null);

const handleYouTubeSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!youtubeUrl.trim() || !onYouTubeSubmit) return;
  
  setIsYoutubeLoading(true);
  setYoutubeError(null);
  
  let dots = 0;
  const interval = setInterval(() => {
    dots = (dots + 1) % 6;
    const progress = "=".repeat(dots) + " ".repeat(5 - dots);
    setYoutubeLoadingText(`>_ Bypassing mainframe... scraping captions [${progress}]`);
  }, 200);

  try {
    await onYouTubeSubmit(youtubeUrl.trim());
    setYoutubeUrl("");
  } catch (error: any) {
    console.error("YouTube extract error:", error);
    setYoutubeError(`>_ ERROR: ${error.message}`);
  } finally {
    clearInterval(interval);
    setIsYoutubeLoading(false);
  }
};


// Sync local title state if the prop changes
useEffect(() => {
setTempTitle(title);
}, [title]);

const handleTitleSave = () => {
setIsEditingTitle(false);
if (tempTitle.trim() && tempTitle !== title) {
onUpdateTitle(tempTitle.trim());
} else {
setTempTitle(title); // Revert if empty
}
};

return (
<div className="w-full flex flex-col h-full relative">
  {showFlashcards && (
    <FlashcardViewer 
      workspaceId={workspaceId} 
      onClose={() => setShowFlashcards(false)} 
    />
  )}

  {showMindMap && (
    <MermaidViewer 
      workspaceId={workspaceId} 
      onClose={() => setShowMindMap(false)} 
    />
  )}

  {showPresentation && (
    <PresentationViewer
      workspaceId={workspaceId}
      onClose={() => setShowPresentation(false)}
    />
  )}

  {/* Dynamic Editable Header */}
  <div className="mb-6 w-full">
    {isEditingTitle ? (
      <input 
        autoFocus
        type="text"
        value={tempTitle}
        onChange={(e) => setTempTitle(e.target.value)}
        onBlur={handleTitleSave}
        onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
        className="text-2xl md:text-3xl font-bold mb-2 bg-transparent border-b-2 border-orange-500 focus:outline-none w-full max-w-md text-white"
      />
    ) : (
      <h1 
        onClick={() => setIsEditingTitle(true)}
        className="text-2xl md:text-3xl font-bold mb-2 flex items-center gap-3 cursor-pointer hover:text-gray-300 transition-colors group w-fit"
      >
        {tempTitle} 
        <span className="text-gray-600 text-lg group-hover:text-orange-500 transition-colors">✎</span>
      </h1>
    )}
    <p className="text-gray-400 text-sm mb-4">Active Workspace loaded. Chat with your tutor or generate study tools.</p>
    
    {/* Chips */}
    <div className="flex flex-wrap items-center gap-3">
      {(isExpanded ? activeSources : activeSources.slice(0, 3)).map((source: any, idx) => (
        <div key={source.id || idx} className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-gray-200 text-sm rounded-lg border border-gray-700 shadow-sm">
          <span className="truncate max-w-[200px]">{source.title || source.name || source.url || 'Untitled Document'}</span>
          <button onClick={() => onRemoveSource(source.id)} className="text-gray-500 hover:text-white">✕</button>
        </div>
      ))}
      
      {!isExpanded && activeSources.length > 3 && (
        <button onClick={() => setIsExpanded(true)} className="px-3 py-1.5 bg-gray-800 text-gray-300 text-sm rounded-lg border border-gray-700 shadow-sm hover:bg-gray-700 transition-colors">
          + {activeSources.length - 3} more
        </button>
      )}

      {isExpanded && activeSources.length > 3 && (
        <button onClick={() => setIsExpanded(false)} className="px-3 py-1.5 bg-gray-800 text-gray-300 text-sm rounded-lg border border-gray-700 shadow-sm hover:bg-gray-700 transition-colors">
          Show less
        </button>
      )}

      {activeSources.length < 10 && (
        <button onClick={onAddSource} className="px-4 py-1.5 text-sm font-medium text-orange-500 border border-orange-500 rounded-lg hover:bg-orange-500 hover:text-white transition-colors">
          + Add Source
        </button>
      )}
    </div>

    {/* YouTube CLI Input */}
    {onYouTubeSubmit && (
      <form onSubmit={handleYouTubeSubmit} className="mt-4 flex items-center gap-2 bg-black border border-gray-700 rounded-md p-2 w-full max-w-2xl shadow-inner">
        <span className="text-orange-500 font-mono text-sm pl-2 select-none">&gt;_</span>
        <input
          type="text"
          value={youtubeUrl}
          onChange={(e) => setYoutubeUrl(e.target.value)}
          placeholder={isWorkspaceReady ? "Enter YouTube URL to extract..." : "Initializing workspace..."}
          disabled={isYoutubeLoading || !isWorkspaceReady}
          className="flex-1 bg-transparent border-none outline-none text-gray-200 font-mono text-sm px-2 focus:ring-0 placeholder-gray-600 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isYoutubeLoading || !youtubeUrl.trim() || !isWorkspaceReady}
          className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-orange-500 font-mono text-xs px-4 py-1.5 rounded transition-colors border border-gray-700 font-bold tracking-widest uppercase"
        >
          {isYoutubeLoading ? 'SYNCING...' : 'EXECUTE'}
        </button>
      </form>
    )}
    
    {isYoutubeLoading && (
      <div className="mt-2 text-green-500 font-mono text-xs animate-pulse">
        {youtubeLoadingText}
      </div>
    )}

    {youtubeError && !isYoutubeLoading && (
      <div className="mt-2 text-red-500 font-mono text-xs">
        {youtubeError}
      </div>
    )}

  </div>

  {/* Mobile Tab Toggle (Visible only on mobile) */}
  <div className="flex lg:hidden w-full bg-gray-900 p-1 rounded-lg mb-4 border border-gray-800">
    <button 
      onClick={() => setMobileTab('chat')}
      className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mobileTab === 'chat' ? 'bg-black text-white shadow' : 'text-gray-400'}`}
    >
      &gt;_ console
    </button>
    <button 
      onClick={() => setMobileTab('studio')}
      className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mobileTab === 'studio' ? 'bg-black text-white shadow' : 'text-gray-400'}`}
    >
      The Studio
    </button>
  </div>

  {/* Split Grid */}
  <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 w-full h-full min-h-0">
    
    {/* Chat Pane (Hidden on mobile if Studio is active) */}
    <div className={`lg:col-span-7 flex-col h-full bg-[#0a0a0a] border border-gray-800 rounded-xl overflow-hidden shadow-lg ${mobileTab === 'chat' ? 'flex' : 'hidden'} lg:flex`}>
      <div className="p-3 border-b border-gray-800 flex justify-between items-center bg-black/40">
        <span className="font-mono text-sm font-bold text-orange-500">&gt;_ console</span>
        <button onClick={onExit} className="text-xs text-gray-400 hover:text-white border border-gray-700 rounded px-2 py-1">Exit Workspace</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {chatMessages.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-sm text-gray-300 w-fit max-w-[85%] break-words whitespace-pre-wrap">
            Acknowledged. I am &gt;_console. Ask me anything about your uploaded materials.
          </div>
        ) : (
          chatMessages.map((msg, i) => (
            <div key={i} className={`group flex flex-col ${msg.role === 'user' ? 'items-end ml-auto' : 'items-start'} max-w-[85%] w-fit`}>
              {/* Message Bubble */}
              <div className={`relative rounded-lg p-3 text-sm break-words w-full ${msg.role === 'user' ? 'bg-orange-900/30 border border-orange-800/50 text-white' : 'bg-gray-900 border border-gray-800 text-gray-300'}`}>
                <div className="prose prose-invert max-w-none text-sm leading-relaxed prose-p:leading-relaxed prose-pre:bg-black prose-pre:border prose-pre:border-gray-800">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.text}
                  </ReactMarkdown>
                </div>
              </div>

              {/* Action Bar (underneath) */}
              <div className={`flex gap-2 mt-1 text-sm text-gray-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity`}>
                {msg.role === 'user' ? (
                  <button onClick={() => setChatInput && setChatInput(msg.text)} className="p-1 hover:text-white transition-colors" title="Edit Message">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <>
                    <button onClick={() => setFeedback(prev => ({...prev, [i]: prev[i] === 'like' ? undefined : 'like'}))} className="p-1 hover:text-white transition-colors" title="Helpful">
                      <ThumbsUp className={`w-3.5 h-3.5 ${feedback[i] === 'like' ? 'text-green-500' : ''}`} />
                    </button>
                    <button onClick={() => setFeedback(prev => ({...prev, [i]: prev[i] === 'dislike' ? undefined : 'dislike'}))} className="p-1 hover:text-white transition-colors" title="Not Helpful">
                      <ThumbsDown className={`w-3.5 h-3.5 ${feedback[i] === 'dislike' ? 'text-red-500' : ''}`} />
                    </button>
                    {onRetry && i === chatMessages.length - 1 && (
                      <button onClick={onRetry} className="p-1 hover:text-white transition-colors" title="Retry Generation">
                        <RefreshCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Dynamic Progress Indicator */}
      {isChatLoading && chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === 'user' && (
        <div className="px-4 py-2 flex items-center gap-2 text-xs text-orange-500 font-mono animate-pulse shrink-0">
          <span className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></span>
          <ProgressText />
        </div>
      )}

      {/* Chat Error Banner */}
      {chatError && (
        <div className="mx-4 mb-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-red-400">
            <span className="font-semibold block mb-0.5">AI Error Encountered</span>
            {getFriendlyErrorMessage(chatError)}
          </div>
        </div>
      )}

      <div className="p-3 bg-black border-t border-gray-800 shrink-0">
        {isAssimilating ? (
          <div className="flex items-center justify-center gap-3 w-full bg-gray-900 border border-orange-500/50 rounded-lg px-4 py-3 min-h-[46px]">
            <span className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></span>
            <span className="text-sm font-mono text-orange-400 animate-pulse">{assimilationStatus || 'Assimilating document content...'}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 w-full">
            <textarea
              id="chat-textarea"
              value={chatInput}
              disabled={!isWorkspaceReady || isChatLoading}
              onChange={(e) => {
                setChatInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSendMessage();
                  fetch('/api/metrics', { method: 'POST', body: JSON.stringify({ action: 'chat_message' }) }).catch(console.error);
                  e.currentTarget.style.height = 'auto';
                }
              }}
              placeholder={isWorkspaceReady ? "Ask a question..." : "Initializing workspace..."} 
              rows={1}
              className={`flex-1 min-w-0 bg-gray-900 border ${chatError ? 'border-red-500' : 'border-gray-700'} rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 resize-none overflow-y-auto disabled:opacity-50 disabled:cursor-not-allowed`}
              style={{ minHeight: '46px', maxHeight: '150px' }}
            />
            <button 
              disabled={!isWorkspaceReady || isChatLoading}
              onClick={() => {
                onSendMessage();
                fetch('/api/metrics', { method: 'POST', body: JSON.stringify({ action: 'chat_message' }) }).catch(console.error);
                const el = document.getElementById('chat-textarea');
                if (el) el.style.height = 'auto';
              }} 
              className="shrink-0 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-700 disabled:text-gray-400 text-white rounded-lg px-4 py-3 flex items-center justify-center transition-colors"
            >
              ➔
            </button>
          </div>
        )}
      </div>
    </div>

    {/* Studio Pane (Hidden on mobile if Chat is active) */}
    <div className={`lg:col-span-5 flex-col h-full bg-[#0a0a0a] border border-gray-800 rounded-xl p-5 shadow-lg overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${mobileTab === 'studio' ? 'flex' : 'hidden'} lg:flex`}>
      <h2 className="text-xl font-bold mb-5 text-white">The Studio</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mb-8">
        <button className="w-full flex items-center gap-3 p-4 bg-gray-900 border border-gray-800 hover:bg-gray-800 rounded-xl text-left group">
          <Headphones className="w-5 h-5 text-gray-300 group-hover:scale-110 transition-transform" />
          <span className="text-sm font-medium text-gray-200">Audio Podcast</span>
        </button>
        <button 
          onClick={() => setShowFlashcards(true)}
          className="w-full flex items-center gap-3 p-4 bg-gray-900 border border-gray-800 hover:bg-gray-800 rounded-xl text-left group"
        >
          <Layers className="w-5 h-5 text-gray-300 group-hover:scale-110 transition-transform" />
          <span className="text-sm font-medium text-gray-200">Interactive Flashcards</span>
        </button>
        <button 
          onClick={() => setShowMindMap(true)}
          className="w-full flex items-center gap-3 p-4 bg-gray-900 border border-gray-800 hover:bg-gray-800 rounded-xl text-left group"
        >
          <Network className="w-5 h-5 text-gray-300 group-hover:scale-110 transition-transform" />
          <span className="text-sm font-medium text-gray-200">Mind Maps & Diagrams</span>
        </button>
        <button 
          onClick={() => setShowPresentation(true)}
          className="w-full flex items-center gap-3 p-4 bg-gray-900 border border-gray-800 hover:bg-gray-800 rounded-xl text-left group"
        >
          <Presentation className="w-5 h-5 text-gray-300 group-hover:scale-110 transition-transform" />
          <span className="text-sm font-medium text-gray-200">PowerPoint Generator</span>
        </button>
      </div>

      {/* Studio Assets Section */}
      <h2 className="text-xl font-bold mb-5 text-white">Studio Assets</h2>
      <StudioAssetsPanel workspaceId={workspaceId} />
    </div>
  </div>
</div>
);
}

```

### `components\DocumentReader.tsx`
```tsx
"use client";

import React, { useState, useEffect } from 'react';
import { motion, useScroll, useSpring, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import { ArrowLeft, AlignJustify, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';

export default function DocumentReader({ document }: { document: any }) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  const [pages, setPages] = useState<string[]>([]);
  const [mode, setMode] = useState<'scroll' | 'swipe'>('scroll');
  const [currentPage, setCurrentPage] = useState(0);
  const [isHudVisible, setIsHudVisible] = useState(true);

  // Load persistence and track reading metric
  useEffect(() => {
    fetch('/api/metrics', { method: 'POST', body: JSON.stringify({ action: 'read_document' }) }).catch(console.error);
    const savedMode = localStorage.getItem('zen_reading_mode');
    if (savedMode === 'swipe') {
      setMode('swipe');
    }
  }, []);

  const toggleMode = (m: 'scroll' | 'swipe') => {
    setMode(m);
    localStorage.setItem('zen_reading_mode', m);
    if (m === 'swipe') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (mode === 'swipe') {
      window.document.body.style.overflow = 'hidden';
    } else {
      window.document.body.style.overflow = 'auto';
    }
    return () => { window.document.body.style.overflow = 'auto'; };
  }, [mode]);

  useEffect(() => {
    if (!document?.textContent) return;
    // Split by paragraphs to avoid breaking markdown structures like bold, links, or lists
    const paragraphs = document.textContent.split(/\n\n+/);
    const chunks = [];
    let currentChunk = [];
    let currentWordCount = 0;
    
    for (const p of paragraphs) {
      const pWordCount = p.split(/\s+/).length;
      // Target ~250 words per chunk for safer pagination
      if (currentWordCount + pWordCount > 250 && currentChunk.length > 0) {
        chunks.push(currentChunk.join("\n\n"));
        currentChunk = [p];
        currentWordCount = pWordCount;
      } else {
        currentChunk.push(p);
        currentWordCount += pWordCount;
      }
    }
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join("\n\n"));
    }
    setPages(chunks);
  }, [document?.textContent]);

  // HUD Auto-hide logic
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const handleActivity = () => {
      setIsHudVisible(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setIsHudVisible(false), 2000);
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('scroll', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('keydown', handleActivity);
    
    handleActivity(); // Init
    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      clearTimeout(timeout);
    };
  }, []);

  // Keyboard navigation for swipe mode
  useEffect(() => {
    if (mode !== 'swipe') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        setCurrentPage(p => Math.min(pages.length - 1, p + 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentPage(p => Math.max(0, p - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, pages.length]);

  if (!document) {
    return (
      <div className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-white mb-4">Document Not Found</h1>
        <Link href="/vault" className="text-orange-500 hover:underline">
          Return to Vault
        </Link>
      </div>
    );
  }

  const handleNext = () => setCurrentPage(p => Math.min(pages.length - 1, p + 1));
  const handlePrev = () => setCurrentPage(p => Math.max(0, p - 1));

  const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity;
  };

  return (
    <div className={`w-full h-full text-gray-200 selection:bg-orange-500/30 font-serif ${mode === 'swipe' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto overflow-x-hidden pb-24'}`}>
      {/* Scroll Progress Bar (Only meaningful in scroll mode) */}
      {mode === 'scroll' && (
        <motion.div
          className="fixed top-0 left-0 right-0 h-1 bg-orange-500 origin-left z-50"
          style={{ scaleX }}
        />
      )}

      {/* Swipe Progress Bar */}
      {mode === 'swipe' && pages.length > 0 && (
        <div 
          className="fixed top-0 left-0 h-1 bg-orange-500 z-50 transition-all duration-300 ease-out"
          style={{ width: `${((currentPage + 1) / pages.length) * 100}%` }}
        />
      )}


      {/* Floating HUD */}
      <div 
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-opacity duration-700 ease-in-out ${isHudVisible ? 'opacity-100' : 'opacity-20 hover:opacity-100'}`}
        onMouseEnter={() => setIsHudVisible(true)}
      >
        <div className="flex items-center gap-2 bg-zinc-800/80 backdrop-blur-md border border-zinc-700/50 rounded-full p-1.5 shadow-2xl">
          <button 
            onClick={() => toggleMode('scroll')}
            className={`p-2 rounded-full transition-colors ${mode === 'scroll' ? 'bg-orange-500 text-white shadow-lg' : 'text-zinc-400 hover:text-white hover:bg-zinc-700'}`}
            title="Vertical Scroll"
          >
            <AlignJustify className="w-5 h-5" />
          </button>
          <button 
            onClick={() => toggleMode('swipe')}
            className={`p-2 rounded-full transition-colors ${mode === 'swipe' ? 'bg-orange-500 text-white shadow-lg' : 'text-zinc-400 hover:text-white hover:bg-zinc-700'}`}
            title="Horizontal Swipe"
          >
            <BookOpen className="w-5 h-5" />
          </button>
        </div>
      </div>

      <main className={`max-w-3xl mx-auto py-12 px-4 md:px-6 relative ${mode === 'swipe' ? 'flex-1 w-full h-full max-w-none flex items-center justify-center py-4' : ''}`}>
        {pages.length > 0 ? (
          mode === 'scroll' ? (
            <div className="flex flex-col gap-12">
              {pages.map((pageText, index) => (
                <motion.article 
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="bg-zinc-800/50 backdrop-blur-sm border border-zinc-700/50 rounded-2xl shadow-2xl p-8 md:p-12"
                >
                  <div className="prose prose-invert max-w-none prose-h1:text-3xl prose-h1:font-bold prose-h1:text-white prose-h1:mb-6 prose-h2:text-2xl prose-h2:font-semibold prose-h2:text-slate-100 prose-h2:mt-10 prose-h2:mb-4 prose-h3:text-xl prose-h3:text-slate-200 prose-h3:mt-8 prose-p:text-slate-300 prose-p:leading-relaxed prose-p:mb-4 prose-strong:text-white prose-li:text-slate-300 prose-a:text-orange-500">
                    <ReactMarkdown>
                      {pageText}
                    </ReactMarkdown>
                  </div>
                  <div className="mt-12 pt-6 border-t border-zinc-700/50 text-center font-sans text-sm text-zinc-500">
                    Page {index + 1} of {pages.length}
                  </div>
                </motion.article>
              ))}
            </div>
          ) : (
            <div className="relative w-full max-w-4xl h-full flex items-center justify-center">
              {/* Swipe Controls Desktop */}
              <button 
                onClick={handlePrev}
                disabled={currentPage === 0}
                className="hidden md:flex absolute left-[-4rem] top-1/2 -translate-y-1/2 p-3 text-zinc-500 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors z-10"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button 
                onClick={handleNext}
                disabled={currentPage === pages.length - 1}
                className="hidden md:flex absolute right-[-4rem] top-1/2 -translate-y-1/2 p-3 text-zinc-500 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors z-10"
              >
                <ChevronRight className="w-8 h-8" />
              </button>

              <div className="w-full h-full relative overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.article 
                    key={currentPage}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={1}
                    onDragEnd={(e, { offset, velocity }) => {
                      const swipe = swipePower(offset.x, velocity.x);
                      if (swipe < -10000) handleNext();
                      else if (swipe > 10000) handlePrev();
                    }}
                    className="absolute inset-0 w-full h-full bg-zinc-800/50 backdrop-blur-sm border border-zinc-700/50 rounded-2xl shadow-2xl p-8 md:p-12 cursor-grab active:cursor-grabbing flex flex-col overflow-hidden"
                  >
                    <div className="flex-1 overflow-hidden pr-4">
                      <div className="prose prose-invert max-w-none prose-h1:text-3xl prose-h1:font-bold prose-h1:text-white prose-h1:mb-6 prose-h2:text-2xl prose-h2:font-semibold prose-h2:text-slate-100 prose-h2:mt-10 prose-h2:mb-4 prose-h3:text-xl prose-h3:text-slate-200 prose-h3:mt-8 prose-p:text-slate-300 prose-p:leading-relaxed prose-p:mb-4 prose-strong:text-white prose-li:text-slate-300 prose-a:text-orange-500">
                        <ReactMarkdown>
                          {pages[currentPage]}
                        </ReactMarkdown>
                      </div>
                    </div>
                    <div className="mt-6 pt-6 border-t border-zinc-700/50 text-center font-sans text-sm text-zinc-500 flex justify-between items-center shrink-0">
                      <span className="md:hidden cursor-pointer p-2 -ml-2" onClick={handlePrev}>
                        {currentPage > 0 ? <ChevronLeft className="w-5 h-5" /> : <span className="w-5 h-5 block" />}
                      </span>
                      <span>Page {currentPage + 1} of {pages.length}</span>
                      <span className="md:hidden cursor-pointer p-2 -mr-2" onClick={handleNext}>
                        {currentPage < pages.length - 1 ? <ChevronRight className="w-5 h-5" /> : <span className="w-5 h-5 block" />}
                      </span>
                    </div>
                  </motion.article>
                </AnimatePresence>
              </div>
            </div>
          )
        ) : (
          <div className="text-center py-20 text-zinc-500 font-sans">
            No readable text content could be extracted from this document.
          </div>
        )}
      </main>
    </div>
  );
}

```

### `components\FlashcardViewer.tsx`
```tsx
'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { X, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

interface Flashcard {
  question: string;
  answer: string;
}

interface FlashcardViewerProps {
  workspaceId: string;
  onClose: () => void;
}

export default function FlashcardViewer({ workspaceId, onClose }: FlashcardViewerProps) {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    if (workspaceId) {
      fetchFlashcards();
    } else {
      setLoading(false);
      toast.error("No active workspace found.");
    }
  }, [workspaceId]);

  const fetchFlashcards = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/studio/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        if (res.status === 503 || errData.isCongested) {
          toast.error("High traffic detected. The AI servers are currently busy. Please try again in a few moments.");
        } else {
          toast.error(errData.error || "Failed to generate flashcards.");
        }
        setLoading(false);
        return;
      }
      
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setFlashcards(data);
      } else {
        toast.error("The AI returned an invalid flashcard format.");
      }
    } catch (e) {
      console.error(e);
      toast.error("An error occurred while communicating with the AI.");
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < flashcards.length - 1) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(prev => prev + 1), 150);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(prev => prev - 1), 150);
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm rounded-xl">
      <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-white transition">
        <X className="w-8 h-8" />
      </button>

      {loading ? (
        <div className="flex flex-col items-center">
          <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mb-4" />
          <h2 className="text-xl text-white font-medium animate-pulse">Generating your flashcards...</h2>
          <p className="text-gray-400 mt-2">The AI is analyzing your workspace materials.</p>
        </div>
      ) : flashcards.length > 0 ? (
        <div className="w-full max-w-2xl flex flex-col items-center">
          <div className="text-gray-400 mb-6 font-medium">Card {currentIndex + 1} of {flashcards.length}</div>
          
          <div 
            className="w-full h-80 sm:h-96 cursor-pointer group" 
            style={{ perspective: '1000px' }}
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <div 
              className="relative w-full h-full transition-all duration-500"
              style={{ 
                transformStyle: 'preserve-3d', 
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
              }}
            >
              {/* Front - Question */}
              <div 
                className="absolute inset-0 w-full h-full bg-gray-900 border border-gray-700 rounded-2xl p-8 flex flex-col items-center justify-center shadow-2xl"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <div className="text-blue-400 text-sm font-bold uppercase tracking-wider mb-4">Question</div>
                <h3 className="text-2xl sm:text-3xl text-white text-center font-semibold">{flashcards[currentIndex].question}</h3>
                <div className="absolute bottom-6 text-gray-500 text-sm flex items-center gap-2">
                  <span>Click to flip</span>
                </div>
              </div>

              {/* Back - Answer */}
              <div 
                className="absolute inset-0 w-full h-full bg-blue-900/40 border border-blue-500/50 rounded-2xl p-8 flex flex-col items-center justify-center shadow-2xl"
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
              >
                <div className="text-blue-300 text-sm font-bold uppercase tracking-wider mb-4">Answer</div>
                <p className="text-xl sm:text-2xl text-white text-center">{flashcards[currentIndex].answer}</p>
                <div className="absolute bottom-6 text-gray-500 text-sm flex items-center gap-2">
                  <span>Click to flip back</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-6 mt-8">
            <button 
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="p-3 rounded-full bg-gray-800 text-white disabled:opacity-50 hover:bg-gray-700 transition"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button 
              onClick={handleNext}
              disabled={currentIndex === flashcards.length - 1}
              className="p-3 rounded-full bg-gray-800 text-white disabled:opacity-50 hover:bg-gray-700 transition"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center text-white">
          <p>No flashcards could be generated.</p>
        </div>
      )}
    </div>
  );
}

```

### `components\MermaidViewer.tsx`
```tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { toast } from 'sonner';
import { X, RefreshCw, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';

const Controls = () => {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div className="absolute bottom-4 right-4 flex gap-2 z-10 bg-gray-900/80 p-2 rounded-lg backdrop-blur-sm border border-gray-700 shadow-xl">
      <button onClick={() => zoomIn()} className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-white transition" title="Zoom In"><ZoomIn className="w-5 h-5" /></button>
      <button onClick={() => zoomOut()} className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-white transition" title="Zoom Out"><ZoomOut className="w-5 h-5" /></button>
      <button onClick={() => resetTransform()} className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-white transition" title="Reset View"><Maximize className="w-5 h-5" /></button>
    </div>
  );
};

interface MermaidViewerProps {
  workspaceId: string;
  onClose: () => void;
}

export default function MermaidViewer({ workspaceId, onClose }: MermaidViewerProps) {
  const [loading, setLoading] = useState(true);
  const [svgContent, setSvgContent] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: 'dark', useMaxWidth: false } as any);
    
    if (workspaceId) {
      generateMindMap();
    } else {
      setLoading(false);
      toast.error("No active workspace found.");
    }
  }, [workspaceId]);

  const generateMindMap = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/studio/mindmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        if (res.status === 503 || errData.isCongested) {
          toast.error("High traffic detected. The AI servers are currently busy. Please try again in a few moments.");
        } else {
          toast.error(errData.error || "Failed to generate mind map.");
        }
        setLoading(false);
        return;
      }
      
      const data = await res.json();
      
      if (data && data.mermaidCode) {
        await renderMermaidDiagram(data.mermaidCode);
      } else {
        toast.error("The AI returned an invalid diagram format.");
        setLoading(false);
      }
    } catch (e) {
      console.error(e);
      toast.error("An error occurred while communicating with the AI.");
      setLoading(false);
    }
  };

  const renderMermaidDiagram = async (code: string) => {
    try {
      // In mermaid v10+, render is async and returns { svg }
      const { svg } = await mermaid.render('mermaid-diagram', code);
      setSvgContent(svg);
    } catch (error) {
      console.error("Mermaid rendering error:", error);
      toast.error("Failed to render the diagram visually.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center m-0 p-0 max-w-none w-screen h-screen border-none rounded-none">
      <div className="w-full h-full relative flex flex-col bg-gray-950 overflow-hidden">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition z-10 bg-gray-900 p-2 rounded-full border border-gray-700 shadow-lg"
        >
          <X className="w-6 h-6" />
        </button>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mb-4" />
          <h2 className="text-xl text-white font-medium animate-pulse">Mapping concepts...</h2>
          <p className="text-gray-400 mt-2">The AI is visualizing your study materials.</p>
        </div>
      ) : svgContent ? (
        <div className="flex-1 w-full h-full flex flex-col bg-gray-900/30 p-2 pt-6">
          <div className="text-center text-gray-400 mb-2 text-sm font-medium">Mind Maps & Diagrams</div>
          
          <div 
            ref={containerRef}
            className="flex-1 w-full h-full overflow-hidden bg-gray-950 flex items-center justify-center relative cursor-move"
          >
            <TransformWrapper
              initialScale={2}
              minScale={0.1}
              limitToBounds={false}
              centerOnInit={true}
            >
              <Controls />
              <TransformComponent wrapperClass="w-full h-full flex-1" contentClass="w-full h-full flex items-center justify-center">
                <div 
                  className="w-full h-full flex items-center justify-center [&>svg]:max-w-none [&>svg]:h-auto [&>svg]:origin-center"
                  dangerouslySetInnerHTML={{ __html: svgContent }}
                />
              </TransformComponent>
            </TransformWrapper>
          </div>
          
          <div className="text-center text-gray-500 text-xs mt-3 mb-2">
            Scroll or pan to explore the full diagram.
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-white">
          <p>No diagram could be generated.</p>
        </div>
      )}
      </div>
    </div>
  );
}

```

### `components\PresentationViewer.tsx`
```tsx
"use client";

import React, { useState, useEffect } from 'react';
import pptxgen from 'pptxgenjs';
import { toast } from 'sonner';
import { X, RefreshCw, Download, FileAudio, FileText } from 'lucide-react';

interface Slide {
  title: string;
  bulletPoints: string[];
}

interface PresentationViewerProps {
  workspaceId: string;
  onClose: () => void;
}

export default function PresentationViewer({ workspaceId, onClose }: PresentationViewerProps) {
  const [loading, setLoading] = useState(true);
  const [slides, setSlides] = useState<Slide[]>([]);

  useEffect(() => {
    if (workspaceId) {
      generatePresentation();
    } else {
      setLoading(false);
      toast.error("No active workspace found.");
    }
  }, [workspaceId]);

  const generatePresentation = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/studio/presentation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId })
      });
      
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to generate presentation.");
        setLoading(false);
        return;
      }
      
      if (data && Array.isArray(data.slides)) {
        setSlides(data.slides);
      } else {
        toast.error("The AI returned an invalid presentation format.");
      }
    } catch (e) {
      console.error(e);
      toast.error("An error occurred while communicating with the AI.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    try {
      const pres = new pptxgen();
      
      slides.forEach((slideData) => {
        const slide = pres.addSlide();
        
        // Add Title
        slide.addText(slideData.title, {
          x: 0.5,
          y: 0.5,
          w: "90%",
          h: 1,
          fontSize: 24,
          bold: true,
          color: "363636",
        });

        // Add Bullet Points
        const formattedBullets = slideData.bulletPoints.map(point => ({ text: point, options: { bullet: true } }));
        slide.addText(formattedBullets, {
          x: 0.5,
          y: 1.5,
          w: "90%",
          h: 4,
          fontSize: 18,
          color: "666666",
        });
      });

      pres.writeFile({ fileName: 'Study_Deck.pptx' });
      toast.success("Presentation downloaded successfully!");
    } catch (error) {
      console.error("PPTX Generation Error:", error);
      toast.error("Failed to generate the PowerPoint file.");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-md">
      <div className="w-full max-w-4xl max-h-[90vh] relative flex flex-col bg-gray-950 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <FileText className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">PowerPoint Generator</h2>
              <p className="text-sm text-gray-400">AI-powered slide deck creation</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white transition bg-gray-900 p-2 rounded-full border border-gray-700 shadow-lg"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center w-full min-h-[400px]">
              <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mb-4" />
              <h2 className="text-xl text-white font-medium animate-pulse">Designing slides...</h2>
              <p className="text-gray-400 mt-2">The AI is structuring your presentation.</p>
              
              {/* Skeleton Cards */}
              <div className="w-full max-w-2xl mt-12 space-y-6 opacity-50">
                {[1, 2].map(i => (
                  <div key={i} className="w-full h-48 bg-gray-900 rounded-xl border border-gray-800 p-6 flex flex-col gap-4 animate-pulse">
                    <div className="w-3/4 h-6 bg-gray-800 rounded"></div>
                    <div className="w-full h-4 bg-gray-800 rounded mt-4"></div>
                    <div className="w-5/6 h-4 bg-gray-800 rounded"></div>
                    <div className="w-4/6 h-4 bg-gray-800 rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : slides.length > 0 ? (
            <div className="w-full max-w-2xl flex flex-col gap-8 pb-10">
              
              <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl">
                <span className="text-blue-200 font-medium">{slides.length} slides generated successfully.</span>
                <button 
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition shadow-lg shadow-blue-500/20"
                >
                  <Download className="w-4 h-4" />
                  Download .pptx
                </button>
              </div>

              <div className="space-y-6">
                {slides.map((slide, idx) => (
                  <div key={idx} className="bg-gray-900 border border-gray-800 rounded-xl p-8 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50"></div>
                    <div className="text-xs font-bold text-gray-500 tracking-wider mb-2 uppercase">Slide {idx + 1}</div>
                    <h3 className="text-2xl font-bold text-white mb-6 leading-tight">{slide.title}</h3>
                    <ul className="space-y-3">
                      {slide.bulletPoints.map((point, pIdx) => (
                        <li key={pIdx} className="flex items-start gap-3 text-gray-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                          <span className="text-lg leading-snug">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-white min-h-[300px]">
              <p className="text-gray-400">No slides could be generated.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

```

### `components\PullToRefresh.tsx`
```tsx
'use client';

import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { usePullToRefresh } from '../lib/hooks/usePullToRefresh';

export default function PullToRefresh({
  children,
  onRefresh,
}: {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Set the threshold for pull (e.g., 100px)
  const { pullDistance, isRefreshing, threshold } = usePullToRefresh(containerRef, onRefresh, 100);

  const isThresholdReached = pullDistance >= threshold;
  
  // Calculate progress bar for terminal UI: [=====     ]
  const progressPercent = Math.min((pullDistance / threshold) * 100, 100);
  const barsCount = Math.floor(progressPercent / 10);
  const progressBar = `[${'='.repeat(barsCount)}${' '.repeat(10 - barsCount)}]`;

  return (
    <div 
      ref={containerRef} 
      className="relative h-full w-full overflow-y-auto overflow-x-hidden hide-scrollbar overscroll-y-none"
    >
      <motion.div
        animate={{ y: isRefreshing ? threshold : pullDistance }}
        transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 1 }}
        className="min-h-full relative w-full"
      >
        {/* Terminal UI Wrapper - Placed visually above the content */}
        <div 
          className="absolute left-0 w-full flex flex-col items-center justify-center bg-[#0A1128] border-b border-gray-800 pointer-events-none overflow-hidden"
          style={{ top: -threshold, height: threshold }}
        >
          <div className="w-full h-full p-4 font-mono text-sm shadow-xl flex flex-col items-center justify-center">
            {isRefreshing ? (
              <div className="text-orange-500 font-bold flex items-center">
                <span>&gt;_ EXECUTING DATA SYNC...</span>
                <span className="animate-pulse ml-1">_</span>
              </div>
            ) : isThresholdReached ? (
              <div className="text-green-500 font-bold">
                &gt;_ Connection secure. Release to sync.
              </div>
            ) : (
              <div className="text-orange-500">
                &gt;_ Establishing uplink... {progressBar}
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        {children}
      </motion.div>
    </div>
  );
}

```

### `components\Sidebar.tsx`
```tsx
'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Sidebar({
  isSidebarOpen,
  setIsSidebarOpen,
  userData
}: {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  userData: { name: string; email: string; [key: string]: any } | null;
}) {
  const pathname = usePathname();
  const [tapCount, setTapCount] = useState(0);
  const [lastTap, setLastTap] = useState(0);
  const [showManifesto, setShowManifesto] = useState(false);

  const handleProfileTap = () => {
    const now = Date.now();
    if (now - lastTap < 2000) {
      const newCount = tapCount + 1;
      setTapCount(newCount);
      if (newCount >= 5) {
        setShowManifesto(true);
        setTapCount(0);
      }
    } else {
      setTapCount(1);
    }
    setLastTap(now);
  };

  return (
    <>
      <aside className={`fixed md:relative top-0 left-0 h-[100dvh] w-[260px] bg-[#111111] border-r border-zinc-800 p-6 flex flex-col z-50 transform transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} shrink-0`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <img src="/logo.png" alt="CogniBase" className="w-32 mb-0" />
          <button className="md:hidden p-2 text-zinc-400 hover:text-white" onClick={() => setIsSidebarOpen(false)}>✕</button>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, marginTop: '3rem' }}>
          <a href="/dashboard" style={{ color: pathname === '/dashboard' ? '#EA580C' : '#A1A1AA', fontWeight: pathname === '/dashboard' ? 'bold' : 'normal', textDecoration: 'none', transition: 'color 0.2s' }}>Command Center</a>
          <a href="/vault" style={{ color: pathname === '/vault' ? '#EA580C' : '#A1A1AA', fontWeight: pathname === '/vault' ? 'bold' : 'normal', textDecoration: 'none', transition: 'color 0.2s' }}>My Vault</a>
          <a href="/study-guides" style={{ color: pathname === '/study-guides' ? '#EA580C' : '#A1A1AA', fontWeight: pathname === '/study-guides' ? 'bold' : 'normal', textDecoration: 'none', transition: 'color 0.2s' }}>Study Guides</a>
          <a href="/studio-assets" style={{ color: pathname === '/studio-assets' ? '#EA580C' : '#A1A1AA', fontWeight: pathname === '/studio-assets' ? 'bold' : 'normal', textDecoration: 'none', transition: 'color 0.2s' }}>Studio Assets</a>
          <a href="/analytics" style={{ color: pathname === '/analytics' ? '#EA580C' : '#A1A1AA', fontWeight: pathname === '/analytics' ? 'bold' : 'normal', textDecoration: 'none', transition: 'color 0.2s' }}>Analytics</a>
          <a href="/settings" style={{ color: pathname === '/settings' ? '#EA580C' : '#A1A1AA', fontWeight: pathname === '/settings' ? 'bold' : 'normal', textDecoration: 'none', transition: 'color 0.2s' }}>Settings</a>
        </nav>
        
        <div 
          onClick={handleProfileTap}
          style={{ 
            borderTop: '1px solid #27272A', 
            paddingTop: '1.5rem', 
            marginTop: 'auto', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1rem',
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          {userData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ color: 'white', fontWeight: 'bold', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userData.name}</span>
              <span style={{ color: '#A1A1AA', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userData.email}</span>
            </div>
          )}
          <div style={{ color: '#71717A', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: '6px', height: '6px', backgroundColor: '#22C55E', borderRadius: '50%', display: 'inline-block' }}></span>
            <span>System Online</span>
          </div>
        </div>
      </aside>

      <AnimatePresence>
        {showManifesto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowManifesto(false)}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xl flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-zinc-950 border border-white/10 shadow-2xl rounded-2xl p-8 relative overflow-hidden cursor-pointer"
            >
              <h2 className="text-2xl font-bold text-zinc-100 mb-6 tracking-tight">
                A Note from the Architect
              </h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                For the past year, I relied on a combination of Gemini Pro and Notebook LM to synthesize my academic work for quick exam prep and deep study while simultaneously running multiple businesses. I am not a first-class student, but that combination bought my time back. It allowed me to focus on multiple tasks at once without academic burnout.
              </p>
              <p className="text-zinc-400 leading-relaxed mb-4">
                I built CogniBase to handle that entire workflow smoothly, all in one place. Every detail here, every interaction, was built with deep consideration for how different minds actually learn.
              </p>
              <hr className="border-white/5 my-6" />
              <p className="text-lg font-semibold bg-gradient-to-r from-blue-400 to-cyan-500 bg-clip-text text-transparent">
                Ginger-Eke Chienyegom
              </p>
              <p className="text-sm text-zinc-500 mt-1">
                Veritas University | Educational Management
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

```

### `components\StudioAssetsPanel.tsx`
```tsx
"use client";

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Layers, Network, Presentation, Headphones, Download, Eye, Loader2, Lock } from 'lucide-react';

interface StudioAsset {
  id: string;
  workspaceId: string;
  title: string;
  type: string;
  content: any;
  createdAt: string;
}

export default function StudioAssetsPanel({ workspaceId, userId }: { workspaceId?: string, userId?: string }) {
  const [assets, setAssets] = useState<StudioAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (workspaceId || userId) {
      fetchAssets();
    } else {
      setLoading(false);
    }
  }, [workspaceId, userId]);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const url = workspaceId 
        ? `/api/studio/assets?workspaceId=${workspaceId}` 
        : `/api/studio/assets?userId=${userId}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (!res.ok) {
        toast.error(data.error || "Failed to fetch studio assets.");
        return;
      }
      
      setAssets(data.assets || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to communicate with the server.");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (asset: StudioAsset) => {
    if (asset.type === 'PRESENTATION') {
      const toastId = toast.loading(`Generating slides for ${asset.title}...`);
      try {
        const res = await fetch('/api/engine/generate-ppt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentText: typeof asset.content === 'string' ? asset.content : JSON.stringify(asset.content) })
        });
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || 'Failed to generate presentation');
        }

        const pptxgen = (await import('pptxgenjs')).default;
        const pptx = new pptxgen();

        if (data.slides && Array.isArray(data.slides)) {
          data.slides.forEach((slideData: any) => {
            let slide = pptx.addSlide();
            slide.addText(slideData.title, { x: 0.5, y: 0.5, w: '90%', fontSize: 24, bold: true, color: '363636' });
            
            if (slideData.bullets && slideData.bullets.length > 0) {
              slide.addText(
                slideData.bullets.map((b: string) => ({ text: b })), 
                { x: 0.5, y: 1.5, w: '90%', fontSize: 18, bullet: true, color: '666666' }
              );
            }
            if (slideData.speakerNotes) {
              slide.addNotes(slideData.speakerNotes);
            }
          });
        }

        await pptx.writeFile({ fileName: `${asset.title.replace(/\s+/g, '_')}.pptx` });
        toast.success('Presentation exported successfully!', { id: toastId });
        fetch('/api/metrics', { method: 'POST', body: JSON.stringify({ action: 'generate_asset' }) }).catch(console.error);
      } catch (err: any) {
        console.error(err);
        toast.error(`Export failed: ${err.message}`, { id: toastId });
      }
    } else {
      toast.info(`Export for ${asset.type} is not yet implemented.`);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'FLASHCARD': return <Layers className="w-5 h-5 text-purple-400" />;
      case 'MINDMAP': return <Network className="w-5 h-5 text-emerald-400" />;
      case 'PRESENTATION': return <Presentation className="w-5 h-5 text-blue-400" />;
      case 'AUDIO': return <Headphones className="w-5 h-5 text-orange-400" />;
      default: return <Layers className="w-5 h-5 text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div className="w-full space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="w-full h-20 bg-gray-900 rounded-xl border border-gray-800 animate-pulse flex items-center p-4">
            <div className="w-10 h-10 bg-gray-800 rounded-lg mr-4"></div>
            <div className="flex-1 space-y-2">
              <div className="w-1/3 h-4 bg-gray-800 rounded"></div>
              <div className="w-1/4 h-3 bg-gray-800 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="w-full p-8 bg-gray-900/50 rounded-xl border border-gray-800 flex flex-col items-center justify-center text-center">
        <p className="text-gray-400">No assets generated yet.</p>
        <p className="text-xs text-gray-500 mt-2">Generate flashcards, mind maps, or presentations in The Studio to see them here.</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {/* Audio Overview Under Construction UI */}
      <div className="w-full bg-zinc-900/50 rounded-xl border border-zinc-800 opacity-80 cursor-not-allowed overflow-hidden flex flex-col mb-4 relative">
        <div className="h-1.5 w-full bg-[repeating-linear-gradient(45deg,#eab308,#eab308_10px,#000_10px,#000_20px)]"></div>
        <div className="p-4 flex items-center gap-4">
          <div className="p-2.5 bg-zinc-950/50 rounded-lg text-yellow-500">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-200">Audio Overviews (Coming Soon)</h3>
            <p className="text-xs text-gray-400 mt-1">We are currently training our conversational audio models. Premium podcast synthesis will unlock in a future update.</p>
          </div>
        </div>
      </div>

      {assets.map((asset) => (
        <div key={asset.id} className="w-full bg-gray-900 border border-gray-800 hover:border-gray-700 transition-colors rounded-xl p-4 flex items-center justify-between group">
          
          <div className="flex items-center gap-4 overflow-hidden">
            <div className="p-2.5 bg-gray-950 rounded-lg shadow-inner">
              {getIcon(asset.type)}
            </div>
            <div className="flex flex-col truncate">
              <span className="text-sm font-semibold text-gray-200 truncate">{asset.title}</span>
              <span className="text-xs text-gray-500">
                {asset.type} • {new Date(asset.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors tooltip-trigger"
              title="View Asset"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button 
              onClick={() => handleExport(asset)}
              className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded-lg transition-colors tooltip-trigger"
              title="Export"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>

        </div>
      ))}
    </div>
  );
}

```

### `components\StudyAnalyticsDashboard.tsx`
```tsx
"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Flame, Clock, CheckCircle2, Target, Loader2 } from 'lucide-react';
import { useUserContext } from '@/lib/hooks/useUserContext';

interface RingData {
  label: string;
  color: string;
  progress: number; // 0 to 1
  radius: number;
  strokeWidth: number;
  icon: React.ReactNode;
  value: string;
}

const ActivityRings = ({ rings }: { rings: RingData[] }) => {
  const center = 150;

  return (
    <div className="relative w-[300px] h-[300px] flex items-center justify-center">
      <svg width="300" height="300" viewBox="0 0 300 300" className="transform -rotate-90">
        {rings.map((ring, index) => {
          const circumference = 2 * Math.PI * ring.radius;
          return (
            <g key={ring.label}>
              {/* Background Track */}
              <circle
                cx={center}
                cy={center}
                r={ring.radius}
                stroke={ring.color}
                strokeWidth={ring.strokeWidth}
                fill="none"
                opacity={0.2}
              />
              {/* Animated Progress Ring */}
              <motion.circle
                cx={center}
                cy={center}
                r={ring.radius}
                stroke={ring.color}
                strokeWidth={ring.strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: circumference * (1 - Math.min(ring.progress, 1)) }}
                transition={{ duration: 1.5, ease: "easeOut", delay: index * 0.2 }}
                style={{
                  filter: `drop-shadow(0 0 8px ${ring.color}80)`,
                }}
              />
            </g>
          );
        })}
      </svg>
      
      <div className="absolute flex flex-col items-center justify-center pointer-events-none">
        <Target className="w-8 h-8 text-zinc-600 opacity-50" />
      </div>
    </div>
  );
};

export default function StudyAnalyticsDashboard() {
  const { context } = useUserContext();
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    today: { focusMinutes: 0, tasksCompleted: 0, averageAccuracy: 0 },
    weekDays: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    streakData: [false, false, false, false, false, false, false],
    historicalFocusMinutes: [0, 0, 0, 0, 0, 0, 0],
    currentStreak: 0
  });

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch('/api/metrics');
        if (res.ok) {
          const data = await res.json();
          setMetrics(data);
        }
      } catch (err) {
        console.error("Failed to fetch metrics", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMetrics();
  }, []);

  const DAILY_GOAL_MINUTES = 120;
  const DAILY_GOAL_TASKS = 5;

  const ringsData: RingData[] = [
    {
      label: 'Tasks Completed',
      color: '#F97316', // Orange
      progress: metrics.today.tasksCompleted / DAILY_GOAL_TASKS,
      radius: 110,
      strokeWidth: 20,
      icon: <CheckCircle2 className="w-5 h-5 text-orange-500" />,
      value: `${metrics.today.tasksCompleted}/${DAILY_GOAL_TASKS}`
    },
    {
      label: 'Deep Work Minutes',
      color: '#3B82F6', // Blue
      progress: metrics.today.focusMinutes / DAILY_GOAL_MINUTES,
      radius: 80,
      strokeWidth: 20,
      icon: <Clock className="w-5 h-5 text-blue-500" />,
      value: `${metrics.today.focusMinutes} min`
    },
    {
      label: 'Knowledge Retention',
      color: '#22C55E', // Green
      progress: (metrics.today.averageAccuracy || 0) / 100,
      radius: 50,
      strokeWidth: 20,
      icon: <Target className="w-5 h-5 text-green-500" />,
      value: `${Math.round(metrics.today.averageAccuracy || 0)}%`
    }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        <p className="text-zinc-500 mt-4 animate-pulse">Syncing Deep Work metrics...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-slate-100 flex flex-col items-center py-12 px-4 sm:px-6 font-sans">
      
      {/* Header */}
      <div className="w-full max-w-lg mb-10 text-center sm:text-left">
        <motion.h1 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold text-white tracking-tight"
        >
          Hello {context?.name || 'Student'}.
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-zinc-400 mt-2 text-sm sm:text-base"
        >
          Your daily deep work metrics.
        </motion.p>
      </div>

      {/* Rings Container */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 rounded-[2.5rem] p-8 shadow-2xl w-full max-w-lg flex flex-col items-center mb-8 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-zinc-800/20 to-transparent pointer-events-none" />
        
        <ActivityRings rings={ringsData} />

        {/* Legend / Metrics breakdown */}
        <div className="w-full mt-10 grid grid-cols-3 gap-2">
          {ringsData.map((ring, idx) => (
            <motion.div 
              key={ring.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + (idx * 0.1) }}
              className="flex flex-col items-center text-center p-3 rounded-2xl bg-zinc-800/30 border border-zinc-700/30"
            >
              <div className="mb-2">{ring.icon}</div>
              <span className="text-xl font-bold text-white tracking-tight">{ring.value}</span>
              <span className="text-[0.65rem] uppercase tracking-wider font-semibold text-zinc-500 mt-1">{ring.label}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Streak Engine */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="w-full max-w-lg bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 w-32 h-32 bg-orange-500/10 rounded-full blur-[50px] pointer-events-none" />
        
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Consistency <Flame className="w-5 h-5 text-orange-500" />
            </h2>
            <p className="text-sm text-zinc-400">Keep the fire burning.</p>
          </div>
          <div className="text-right">
            <span className="text-3xl font-black text-white">{metrics.currentStreak}</span>
            <span className="text-zinc-500 font-semibold ml-1 uppercase text-xs">Days</span>
          </div>
        </div>

        <div className="flex justify-between items-center px-2">
          {metrics.weekDays.map((day, idx) => {
            const isActive = metrics.streakData[idx];
            return (
              <div key={idx} className="flex flex-col items-center gap-3">
                <span className="text-xs font-semibold text-zinc-500">{day}</span>
                <div className="relative">
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.8 + (idx * 0.05), type: "spring" }}
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                      isActive 
                        ? 'bg-orange-500/20 border-orange-500/50 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.3)]' 
                        : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-600'
                    }`}
                  >
                    {isActive ? (
                      <Flame className="w-5 h-5 fill-orange-500/20" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-zinc-700" />
                    )}
                  </motion.div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Historical Data (Bar Chart) */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="w-full max-w-lg bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden mt-8 mb-12"
      >
        <div className="absolute right-0 top-0 w-32 h-32 bg-[#3B82F6]/10 rounded-full blur-[50px] pointer-events-none" />
        
        <div className="mb-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            Historical Data
          </h2>
          <p className="text-sm text-zinc-400">Deep Work Minutes (Last 7 Days)</p>
        </div>

        <div className="flex justify-between items-end h-40 mt-4 px-2">
          {metrics.weekDays.map((day, idx) => {
            const minutes = metrics.historicalFocusMinutes[idx] || 0;
            const maxMinutes = Math.max(...metrics.historicalFocusMinutes, 60); // min 60 to avoid /0
            const heightPercentage = Math.min((minutes / maxMinutes) * 100, 100);
            
            return (
              <div key={idx} className="flex flex-col items-center gap-3 w-8">
                <div className="relative w-full h-full flex items-end justify-center group cursor-pointer">
                  {/* Tooltip on hover */}
                  <div className="absolute -top-8 bg-zinc-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-lg">
                    {minutes} min
                  </div>
                  {/* Bar */}
                  <div className="w-full bg-zinc-800/50 rounded-t-md overflow-hidden relative" style={{ height: '100%' }}>
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${heightPercentage}%` }}
                      transition={{ duration: 1, delay: 0.5 + (idx * 0.1), ease: "easeOut" }}
                      className="absolute bottom-0 w-full bg-[#3B82F6] rounded-t-md"
                    />
                  </div>
                </div>
                <span className="text-xs font-semibold text-zinc-500">{day}</span>
              </div>
            );
          })}
        </div>
      </motion.div>

    </div>
  );
}

```

### `components\StudyEngine.tsx`
```tsx
"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ChevronRight, Layers, BrainCircuit } from 'lucide-react';

interface Flashcard {
  question: string;
  answer: string;
}

interface Phase {
  phaseId: string;
  title: string;
  microBites: string[];
  flashcards: Flashcard[];
}

interface GuideData {
  guideTitle: string;
  phases: Phase[];
}

interface StudyEngineProps {
  guideData: any;
  guideId?: string;
}

export function StudyEngine({ guideData, guideId }: StudyEngineProps) {
  const [viewState, setViewState] = useState<'quest_log' | 'micro_bite' | 'flashcards'>('quest_log');
  const [activePhaseIndex, setActivePhaseIndex] = useState<number>(0);
  const [currentBiteIndex, setCurrentBiteIndex] = useState<number>(0);
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [completedPhases, setCompletedPhases] = useState<Set<string>>(new Set());

  let data: GuideData | null = null;
  try {
    data = typeof guideData === 'string' ? JSON.parse(guideData) : guideData;
  } catch (e) {
    console.error("Invalid guideData", e);
  }

  React.useEffect(() => {
    if (guideId) {
      fetch(`/api/study-guides/progress?guideId=${guideId}`)
        .then(res => res.json())
        .then(resData => {
          if (resData.completedPhases) {
            setCompletedPhases(new Set(resData.completedPhases));
          }
        })
        .catch(err => console.error("Failed to fetch progress", err));
    }
  }, [guideId]);

  const recordPhaseCompletion = async (phaseId: string) => {
    setCompletedPhases(prev => new Set(prev).add(phaseId));
    if (guideId) {
      fetch('/api/study-guides/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guideId, phaseId })
      }).catch(err => console.error(err));
      
      fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete_phase' })
      }).catch(err => console.error(err));
    }
  };

  if (!data || !data.phases) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-400 p-8 text-center bg-[#111111]">
        <BrainCircuit className="w-16 h-16 text-zinc-600 mb-4" />
        <p>This study guide is using an older format or failed to generate correctly.</p>
      </div>
    );
  }

  const activePhase = data.phases[activePhaseIndex];

  const handleStartPhase = (index: number) => {
    setActivePhaseIndex(index);
    setCurrentBiteIndex(0);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    
    const clickedPhase = data?.phases[index];
    if (clickedPhase && !completedPhases.has(clickedPhase.phaseId)) {
        // The Double-Trigger
        recordPhaseCompletion(clickedPhase.phaseId);
    }
    
    if (clickedPhase?.microBites && clickedPhase.microBites.length > 0) {
        setViewState('micro_bite');
    } else if (clickedPhase?.flashcards && clickedPhase.flashcards.length > 0) {
        setViewState('flashcards');
    }
  };

  const advanceMicroBite = () => {
    if (currentBiteIndex < activePhase.microBites.length - 1) {
      setCurrentBiteIndex(prev => prev + 1);
    } else {
      if (activePhase.flashcards && activePhase.flashcards.length > 0) {
          setViewState('flashcards');
      } else {
          recordPhaseCompletion(activePhase.phaseId);
          setViewState('quest_log');
      }
    }
  };

  const advanceFlashcard = () => {
    if (currentCardIndex < activePhase.flashcards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setIsFlipped(false);
    } else {
      recordPhaseCompletion(activePhase.phaseId);
      setViewState('quest_log');
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#111111] overflow-hidden rounded-lg">
      <AnimatePresence mode="wait">
        {viewState === 'quest_log' && (
          <motion.div 
            key="quest_log"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 overflow-y-auto p-4 sm:p-8"
          >
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">{data.guideTitle || 'Study Quest'}</h2>
              <p className="text-zinc-400">Complete all phases to master this material.</p>
            </div>

            <div className="flex flex-col gap-4">
              {data.phases.map((phase, index) => {
                const isCompleted = completedPhases.has(phase.phaseId);
                return (
                  <button
                    key={phase.phaseId}
                    onClick={() => handleStartPhase(index)}
                    className={`flex items-center justify-between p-5 rounded-xl border text-left transition-all ${
                      isCompleted 
                        ? 'bg-green-900/10 border-green-900/50 hover:bg-green-900/20' 
                        : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                        isCompleted ? 'bg-green-500/20 border-green-500 text-green-500' : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                      }`}>
                        {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
                      </div>
                      <div>
                        <h3 className={`font-semibold ${isCompleted ? 'text-green-50' : 'text-zinc-100'}`}>{phase.title}</h3>
                        <p className="text-sm text-zinc-500 mt-1">{phase.microBites?.length || 0} bites • {phase.flashcards?.length || 0} cards</p>
                      </div>
                    </div>
                    <ChevronRight className={`w-5 h-5 ${isCompleted ? 'text-green-600' : 'text-zinc-600'}`} />
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {viewState === 'micro_bite' && activePhase && (
          <motion.div 
            key="micro_bite"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="flex-1 flex flex-col p-4 sm:p-8"
          >
            <div className="flex justify-between items-center mb-8">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{activePhase.title}</span>
              <span className="text-xs font-bold text-[#EA580C] bg-[#EA580C]/10 px-3 py-1 rounded-full uppercase tracking-wider">
                Micro-Bite {currentBiteIndex + 1} of {activePhase.microBites.length}
              </span>
            </div>
            
            <div className="flex-1 flex items-center justify-center">
              <motion.p 
                key={currentBiteIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl sm:text-3xl lg:text-4xl font-medium text-white text-center leading-tight max-w-3xl"
              >
                {activePhase.microBites[currentBiteIndex]}
              </motion.p>
            </div>

            <div className="mt-8">
              <button 
                onClick={advanceMicroBite}
                className="w-full py-5 rounded-2xl bg-[#EA580C] hover:bg-[#c2410c] text-white font-bold text-xl shadow-[0_0_20px_rgba(234,88,12,0.3)] transition-all active:scale-[0.98]"
              >
                Tap to Continue
              </button>
            </div>
          </motion.div>
        )}

        {viewState === 'flashcards' && activePhase && (
          <motion.div 
            key="flashcards"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="flex-1 flex flex-col p-4 sm:p-8 perspective-1000"
          >
            <div className="flex justify-between items-center mb-8">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Knowledge Check</span>
              <span className="text-xs font-bold text-[#3B82F6] bg-[#3B82F6]/10 px-3 py-1 rounded-full uppercase tracking-wider">
                Card {currentCardIndex + 1} of {activePhase.flashcards.length}
              </span>
            </div>

            <div className="flex-1 flex items-center justify-center relative w-full max-w-2xl mx-auto min-h-[300px]" style={{ perspective: '1000px' }}>
              <motion.div 
                className="w-full h-full relative min-h-[300px]"
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
                style={{ transformStyle: 'preserve-3d', cursor: 'pointer' }}
                onClick={() => setIsFlipped(!isFlipped)}
              >
                {/* Front */}
                <div className="absolute inset-0 w-full h-full bg-zinc-900 border border-zinc-800 rounded-3xl p-8 flex flex-col items-center justify-center shadow-2xl" style={{ backfaceVisibility: 'hidden' }}>
                  <span className="absolute top-6 text-zinc-500 text-sm font-semibold uppercase tracking-widest">Question</span>
                  <p className="text-2xl sm:text-3xl font-bold text-white text-center leading-relaxed">
                    {activePhase.flashcards[currentCardIndex].question}
                  </p>
                  <span className="absolute bottom-6 text-[#EA580C] text-sm font-semibold animate-pulse">Tap to flip</span>
                </div>

                {/* Back */}
                <div className="absolute inset-0 w-full h-full bg-[#EA580C] rounded-3xl p-8 flex flex-col items-center justify-center shadow-2xl shadow-[#EA580C]/20" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                  <span className="absolute top-6 text-orange-200 text-sm font-semibold uppercase tracking-widest">Answer</span>
                  <p className="text-2xl sm:text-3xl font-bold text-white text-center leading-relaxed">
                    {activePhase.flashcards[currentCardIndex].answer}
                  </p>
                </div>
              </motion.div>
            </div>

            <AnimatePresence>
              {isFlipped && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8"
                >
                  <button 
                    onClick={advanceFlashcard}
                    className="w-full py-5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xl transition-all active:scale-[0.98]"
                  >
                    Got it. Next!
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

```

### `components\StudyGuideInteractive.tsx`
```tsx
"use client";

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Trophy } from 'lucide-react';

interface KnowledgeCheck {
  question: string;
  options: string[];
  correctAnswer: string;
}

interface Task {
  id: string;
  text: string;
  isCompleted: boolean;
  knowledgeCheck: KnowledgeCheck;
}

interface Phase {
  phaseTitle: string;
  tasks: Task[];
}

interface StrategyData {
  phases: Phase[];
}

interface StudyGuide {
  id: string;
  title: string;
  strategyData: StrategyData;
}

export default function StudyGuideInteractive({ initialGuide }: { initialGuide: StudyGuide }) {
  const [guide, setGuide] = useState<StudyGuide>(initialGuide);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [completedPhases, setCompletedPhases] = useState<string[]>([]);
  const [isCompletingPhase, setIsCompletingPhase] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const res = await fetch(`/api/study-guides/progress?guideId=${guide.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.completedPhases) setCompletedPhases(data.completedPhases);
        }
      } catch (err) {
        console.error("Failed to fetch progress", err);
      }
    };
    if (guide.id) fetchProgress();
  }, [guide.id]);

  const handleCompletePhase = async (phaseTitle: string) => {
    if (completedPhases.includes(phaseTitle)) return;
    
    setIsCompletingPhase(prev => ({ ...prev, [phaseTitle]: true }));
    try {
      const resProgress = await fetch('/api/study-guides/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guideId: guide.id, phaseId: phaseTitle })
      });
      
      if (!resProgress.ok) throw new Error("Failed to record progress");
      
      setCompletedPhases(prev => [...prev, phaseTitle]);
      
      fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'flashcard_review' })
      }).then(res => {
         if (res.ok) toast.success(`Phase "${phaseTitle}" Complete! +10 Focus Minutes`);
      }).catch(err => console.error("Gamification error", err));

    } catch (e) {
      toast.error("Failed to mark phase as complete.");
    } finally {
      setIsCompletingPhase(prev => ({ ...prev, [phaseTitle]: false }));
    }
  };

  // Calculate completion percentage
  let totalTasks = 0;
  let completedTasks = 0;
  
  if (guide?.strategyData?.phases) {
    guide.strategyData.phases.forEach((phase) => {
      phase.tasks.forEach((task) => {
        totalTasks++;
        if (task.isCompleted) completedTasks++;
      });
    });
  }

  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const handleTaskClick = (taskId: string, isCompleted: boolean) => {
    if (isCompleted) return;
    setExpandedTaskId(expandedTaskId === taskId ? null : taskId);
  };

  const handleAnswerSelect = async (phaseIndex: number, taskIndex: number, task: Task, selectedOption: string) => {
    if (selectedOption !== task.knowledgeCheck.correctAnswer) {
      toast.error("Not quite! Try again.");
      return;
    }

    toast.success("Correct! Great job.");
    
    // Update local state
    const newGuide = { ...guide };
    newGuide.strategyData.phases[phaseIndex].tasks[taskIndex].isCompleted = true;
    setGuide(newGuide);
    setExpandedTaskId(null);

    // Save to database
    try {
      const res = await fetch('/api/documents/study-guide', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: guide.id,
          strategyData: newGuide.strategyData
        })
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to save progress.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to save progress. Please try again later.");
    }
  };

  const radius = 40;
  const stroke = 8;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (completionPercentage / 100) * circumference;

  if (!guide?.strategyData?.phases) {
    return <div className="text-gray-400 p-8 text-center">No strategy data available.</div>;
  }

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-8 pb-12">
      {/* Progress Header */}
      <div className="bg-[#111111] border border-gray-800 rounded-2xl p-6 flex items-center justify-between shadow-xl">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">{guide.title || 'Strategic Study Plan'}</h2>
          <p className="text-gray-400">Complete tasks and pass knowledge checks to advance.</p>
        </div>
        
        <div className="relative flex items-center justify-center w-24 h-24">
          <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
            {/* Background Ring */}
            <circle
              stroke="#27272A"
              fill="transparent"
              strokeWidth={stroke}
              r={normalizedRadius}
              cx={radius}
              cy={radius}
            />
            {/* Progress Ring */}
            <circle
              stroke="#EA580C"
              fill="transparent"
              strokeWidth={stroke}
              strokeDasharray={circumference + ' ' + circumference}
              style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.5s ease-in-out' }}
              strokeLinecap="round"
              r={normalizedRadius}
              cx={radius}
              cy={radius}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-white">{completionPercentage}%</span>
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-8">
        {guide.strategyData.phases.map((phase, pIndex) => {
          const isPhaseCompleted = completedPhases.includes(phase.phaseTitle);
          return (
          <div key={pIndex} className="space-y-4 relative">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <h3 className="text-xl font-semibold text-gray-200 flex items-center gap-2">
                {isPhaseCompleted && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                {phase.phaseTitle}
              </h3>
              {!isPhaseCompleted && (
                <button 
                  onClick={() => handleCompletePhase(phase.phaseTitle)}
                  disabled={isCompletingPhase[phase.phaseTitle]}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-orange-600/20 text-orange-500 hover:bg-orange-600/30 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  {isCompletingPhase[phase.phaseTitle] ? 'Saving...' : 'Mark Phase Complete'}
                </button>
              )}
            </div>
            
            <div className="space-y-3">
              {phase.tasks.map((task, tIndex) => {
                const isExpanded = expandedTaskId === task.id;
                
                return (
                  <div 
                    key={task.id} 
                    className={`bg-gray-900 border rounded-xl overflow-hidden transition-all duration-300 ${
                      task.isCompleted 
                        ? 'border-gray-800 opacity-60' 
                        : isExpanded 
                          ? 'border-[#EA580C] shadow-[0_0_15px_rgba(234,88,12,0.15)]' 
                          : 'border-gray-700 hover:border-gray-600 cursor-pointer'
                    }`}
                  >
                    {/* Task Row */}
                    <div 
                      onClick={() => handleTaskClick(task.id, task.isCompleted)}
                      className="p-4 flex items-center gap-4"
                    >
                      <div className="flex-shrink-0">
                        {task.isCompleted ? (
                          <CheckCircle2 className="w-6 h-6 text-[#EA580C]" />
                        ) : (
                          <Circle className="w-6 h-6 text-gray-500" />
                        )}
                      </div>
                      <div className={`flex-1 font-medium transition-colors duration-300 ${task.isCompleted ? 'text-slate-500 line-through' : 'text-gray-200'}`}>
                        {task.text}
                      </div>
                      {!task.isCompleted && (
                        <div className="text-gray-500">
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                      )}
                    </div>

                    {/* Knowledge Check Expansion */}
                    {!task.isCompleted && isExpanded && (
                      <div className="p-4 pt-0 bg-gray-900 border-t border-gray-800/50">
                        <div className="mt-4 mb-4">
                          <p className="text-sm font-semibold text-blue-400 mb-3 uppercase tracking-wider">Knowledge Check</p>
                          <p className="text-gray-200">{task.knowledgeCheck.question}</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {task.knowledgeCheck.options.map((option, oIndex) => (
                            <button
                              key={oIndex}
                              onClick={() => handleAnswerSelect(pIndex, tIndex, task, option)}
                              className="text-left p-3 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 hover:border-gray-500 text-gray-300 text-sm transition-all"
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )})}
      </div>
    </div>
  );
}

```

### `components\ThemeProvider.tsx`
```tsx
'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ThemeProviderProps } from 'next-themes';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

```

### `components\ui\CustomSelect.tsx`
```tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  id?: string;
  options: Option[];
  value: string;
  onChange: (val: string) => void;
  className?: string;
}

export default function CustomSelect({ id, options, value, onChange, className = '' }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative min-w-[220px] ${className}`}>
      <input type="hidden" id={id} value={value} />
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-[#18181B] border border-[#27272A] text-white text-sm rounded-lg px-4 py-2.5 outline-none hover:border-zinc-600 transition-colors"
      >
        <span>{selectedOption.label}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} className="text-zinc-400" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-2 bg-[#18181B] border border-[#27272A] rounded-lg shadow-xl overflow-hidden"
          >
            <div className="py-1">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors ${
                    value === option.value ? 'bg-orange-600/10 text-orange-500' : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <span>{option.label}</span>
                  {value === option.value && <Check size={14} />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

```

### `lib\ai\model-router.ts`
```ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export const getAIModel = (taskType: 'simple' | 'complex') => {
  if (taskType === 'simple') {
    return genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
  } else if (taskType === 'complex') {
    return genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
  }
  
  // Fallback
  return genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
};

```

### `lib\auth-sync.ts`
```ts
import { prisma } from '@/lib/prisma';
import type { User } from '@supabase/supabase-js';

export async function ensurePrismaUser(authUser: User) {
  try {
    return await prisma.user.upsert({
      where: { id: authUser.id },
      update: {},
      create: {
        id: authUser.id,
        email: authUser.email || '',
      }
    });
  } catch (error) {
    console.error("Error in ensurePrismaUser:", error);
    throw error;
  }
}

```

### `lib\firebase.ts`
```ts
// Dummy Firebase mock to allow legacy code to compile without Firebase SDKs
export const db = {};
export const auth = {};
export const collection = (...args: any[]) => ({});
export const doc = (...args: any[]) => ({});
export const getDoc = async (...args: any[]) => ({ exists: () => false, data: () => ({}) });
export const getDocs = async (...args: any[]) => ({ docs: [], empty: true });
export const query = (...args: any[]) => ({});
export const where = (...args: any[]) => ({});
export const addDoc = async (...args: any[]) => ({ id: 'mock-id' });
export const updateDoc = async (...args: any[]) => {};
export const deleteDoc = async (...args: any[]) => {};
export const setDoc = async (...args: any[]) => {};
export const serverTimestamp = (...args: any[]) => new Date();
export const arrayUnion = (...args: any[]) => [args[0]];
export const onAuthStateChanged = (...args: any[]) => () => {};

```

### `lib\hooks\usePullToRefresh.ts`
```ts
import { useState, useEffect, RefObject } from 'react';

export function usePullToRefresh(
  containerRef: RefObject<HTMLElement | null>,
  onRefresh: () => Promise<void>,
  threshold: number = 100
) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let startY = 0;
    let currentY = 0;
    let isPulling = false;

    const handleTouchStart = (e: TouchEvent) => {
      // Only allow pull if we are at the absolute top of the container
      if (container.scrollTop <= 0) {
        startY = e.touches[0].clientY;
        isPulling = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling || isRefreshing) return;
      
      currentY = e.touches[0].clientY;
      const distance = currentY - startY;

      // Only track if pulling downwards and we are at the top
      if (distance > 0 && container.scrollTop <= 0) {
        // Prevent default native overscroll on browsers that support it
        if (e.cancelable) {
          e.preventDefault();
        }
        
        // Apply friction to the pull distance for a natural feel
        const visualDistance = Math.min(distance * 0.4, threshold + 50);
        setPullDistance(visualDistance);
      } else {
        setPullDistance(0);
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling) return;
      isPulling = false;
      
      if (pullDistance >= threshold && !isRefreshing) {
        setIsRefreshing(true);
        setPullDistance(threshold); // Lock at threshold while refreshing
        
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        // Did not reach threshold, snap back
        setPullDistance(0);
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    // Must be passive: false to allow e.preventDefault()
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [containerRef, onRefresh, isRefreshing, pullDistance, threshold]);

  return { pullDistance, isRefreshing, threshold };
}

```

### `lib\hooks\useUserContext.tsx`
```tsx
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useTheme } from 'next-themes';

export interface UserContext {
  uid: string; // Supabase UID
  name: string;
  email: string;
  school?: string;
  department?: string;
  profile: any;
  preferences: {
    theme: string;
    sidebarMode: string;
    dailyFocusGoal: number;
    guideComplexity: string;
  };
}

interface UserContextValue {
  context: UserContext | null;
  isLoading: boolean;
  mutate: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<UserContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { setTheme } = useTheme();

  async function fetchUser() {
    setIsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const profileData = await res.json();
          setContext({
            uid: session.user.id,
            name: profileData.username || session.user.email?.split('@')[0] || 'Student',
            email: session.user.email || '',
            school: profileData.school || '',
            department: profileData.department || '',
            profile: profileData,
            preferences: profileData.preferences || {
              theme: 'system',
              sidebarMode: 'expanded',
              dailyFocusGoal: 120,
              guideComplexity: 'standard'
            }
          });
          // Sync Theme
          if (profileData.preferences?.theme) {
            setTheme(profileData.preferences.theme);
          }
        } else if (res.status === 401) {
          setContext(null);
        } else {
           setContext({
             uid: session.user.id,
             name: session.user.email?.split('@')[0] || 'Student',
             email: session.user.email || '',
             profile: {},
             preferences: {
               theme: 'system',
               sidebarMode: 'expanded',
               dailyFocusGoal: 120,
               guideComplexity: 'standard'
             }
           });
        }
      } catch(e) {
        setContext(null);
      }
    } else {
      setContext(null);
    }
    setIsLoading(false);
  }

  useEffect(() => {
    let mounted = true;
    fetchUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
       if (event === 'SIGNED_OUT') {
         if (mounted) setContext(null);
       } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
         fetchUser();
       }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <UserContext.Provider value={{ context, isLoading, mutate: fetchUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserContext() {
  const context = useContext(UserContext);
  if (context === undefined) {
    // Fallback if not wrapped in provider (shouldn't happen)
    return { context: null, isLoading: false, mutate: async () => {} };
  }
  return context;
}

```

### `lib\prisma.ts`
```ts
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

export const prisma =
globalForPrisma.prisma ||
new PrismaClient({
adapter,
log: ['query'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

```

### `lib\utils\time.ts`
```ts
export function formatSmartTime(dateInput: any): string {
  if (!dateInput) return 'Just now';

  let date: Date;
  if (dateInput.seconds) {
    date = new Date(dateInput.seconds * 1000);
  } else {
    date = new Date(dateInput);
  }

  if (isNaN(date.getTime())) return 'Just now';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.max(0, diffMs / 1000);
  const diffMins = diffSecs / 60;
  const diffHours = diffMins / 60;

  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${Math.floor(diffMins)}m ago`;
  } else if (diffHours < 4) {
    return `${Math.floor(diffHours)}h ago`;
  } else {
    const options: Intl.DateTimeFormatOptions = { 
      month: 'long', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    };
    return new Intl.DateTimeFormat('en-US', options).format(date);
  }
}

```

### `lib\utils\timetable.ts`
```ts
export interface ScheduledClass {
  courseCode: string;
  day: string;
  startTime: string; // e.g., "09:00"
  endTime: string;   // e.g., "10:30"
  location?: string;
}

export function checkClash(
  newClass: ScheduledClass,
  existingClasses: ScheduledClass[]
): { hasClash: boolean; clashingCourse?: string } {
  // Convert HH:MM to minutes
  const toMinutes = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + (minutes || 0);
  };

  const newStart = toMinutes(newClass.startTime);
  const newEnd = toMinutes(newClass.endTime);

  for (const existing of existingClasses) {
    if (existing.day.toLowerCase() === newClass.day.toLowerCase()) {
      const existingStart = toMinutes(existing.startTime);
      const existingEnd = toMinutes(existing.endTime);

      // Overlap logic: StartA < EndB && EndA > StartB
      if (newStart < existingEnd && newEnd > existingStart) {
        return { hasClash: true, clashingCourse: existing.courseCode };
      }
    }
  }

  return { hasClash: false };
}

```

### `prisma\schema.prisma`
```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
  engineType      = "library"
}

datasource db {
  provider   = "postgresql"
  extensions = [vector]
}

model Workspace {
  id           String        @id @default(cuid())
  title        String
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  messages     Message[]
  documents    Document[]
  userId       String?
  user         User?         @relation(fields: [userId], references: [id], onDelete: Cascade)
  studioAssets StudioAsset[]
}

model Message {
  id          String    @id @default(cuid())
  role        String
  text        String
  createdAt   DateTime  @default(now())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
}

model Document {
  id          String          @id @default(cuid())
  name        String // The original file name (e.g., 'ForexCoachings.docx')
  url         String // The Supabase public storage URL or YouTube URL
  sourceType  String          @default("file") // e.g., "file" or "youtube"
  textContent String? // Raw text content
  fileSize    Int? // Size in bytes
  createdAt   DateTime        @default(now())
  workspaceId String
  workspace   Workspace       @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  chunks      DocumentChunk[]
  studyGuides StudyGuide[]
}

model DocumentChunk {
  id         String                      @id @default(cuid())
  documentId String
  content    String
  embedding  Unsupported("vector(768)")?
  pageNumber Int?
  document   Document                    @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([embedding], map: "embeddingIndex")
}

model User {
  id               String        @id @default(cuid()) // Will store Supabase Auth UUID
  email            String        @unique
  username         String?
  school           String?
  department       String?
  stripeCustomerId String?       @unique
  planTier         String        @default("FREE")
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  workspaces       Workspace[]
  timetables       Timetable[]
  studyGuides      StudyGuide[]
  studyGoals       StudyGoal[]
  dailyMetrics     DailyMetric[]
  auditLogs        AuditLog[]
  studyGuideProgress StudyGuideProgress[]
  preferences      UserPreferences?
}

model Timetable {
  id     String @id @default(cuid())
  userId String
  data   Json // Store the timetable object here
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model StudyGuide {
  id                 String   @id @default(cuid())
  userId             String
  sourceDocumentId   String
  sourceDocumentName String?
  sectionConstraint  String?
  markdownContent    String?
  title              String?
  strategyData       Json?
  createdAt          DateTime @default(now())
  user               User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  document           Document @relation(fields: [sourceDocumentId], references: [id], onDelete: Cascade)
  progress           StudyGuideProgress[]
}

model ExtractedFormCache {
  hash      String   @id
  courses   Json
  createdAt DateTime @default(now())
}

model StudioAsset {
  id          String    @id @default(uuid())
  workspaceId String
  title       String
  type        String // 'FLASHCARD', 'MINDMAP', 'PRESENTATION', 'AUDIO'
  content     Json
  createdAt   DateTime  @default(now())
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
}

model StudyGoal {
  id          String   @id @default(cuid())
  title       String // e.g., "Master EDM 205"
  targetDate  DateTime
  targetHours Int // Goal for focus hours
  createdAt   DateTime @default(now())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model DailyMetric {
  id              String   @id @default(cuid())
  date            DateTime @default(now()) // Stored as midnight for easy querying
  focusMinutes    Int      @default(0)
  tasksCompleted  Int      @default(0)
  averageAccuracy Float    @default(0.0) // From knowledge checks
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([date, userId]) // One record per user per day
}

model AuditLog {
  id        String   @id @default(cuid())
  action    String
  userId    String
  details   String   @db.Text
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model StudyGuideProgress {
  id          String   @id @default(cuid())
  userId      String
  guideId     String
  phaseId     String
  completed   Boolean  @default(true)
  createdAt   DateTime @default(now())
  
  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  guide       StudyGuide @relation(fields: [guideId], references: [id], onDelete: Cascade)

  @@unique([userId, guideId, phaseId])
}

model UserPreferences {
  id              String   @id @default(cuid())
  userId          String   @unique
  theme           String   @default("system")
  sidebarMode     String   @default("expanded")
  dailyFocusGoal  Int      @default(120)
  guideComplexity String   @default("standard")

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}


```

### `utils\supabase\client.ts`
```ts
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

```

### `utils\supabase\middleware.ts`
```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isProtectedRoute = request.nextUrl.pathname.startsWith('/dashboard') || 
                           request.nextUrl.pathname.startsWith('/vault') || 
                           request.nextUrl.pathname.startsWith('/command-center')
                           
  const isAuthRoute = request.nextUrl.pathname === '/login' || 
                      request.nextUrl.pathname === '/'

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

```

### `utils\supabase\server.ts`
```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

```

### `scripts\check.ts`
```ts
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function check() {
  console.log("Users:", await prisma.user.count());
  console.log("Timetables:", await prisma.timetable.count());
  console.log("Workspaces (Chats):", await prisma.workspace.count());
  console.log("Messages:", await prisma.message.count());
  process.exit(0);
}
check();

```

### `scripts\list-models.ts`
```ts
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  const models = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`).then(r => r.json());
  console.log(models.models.map((m: any) => m.name));
}

run();

```

### `scripts\migrate-data.ts`
```ts
// @ts-nocheck
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Ensure you have a serviceAccountKey.json in the scripts folder or root
// Or initialize using default credentials if running in an environment with GOOGLE_APPLICATION_CREDENTIALS
let db: FirebaseFirestore.Firestore;

try {
  const serviceAccountPath = path.resolve(process.cwd(), 'cognibase-4fd12-firebase-adminsdk-fbsvc-c7c13ee143.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    if (!getApps().length) {
      initializeApp({ credential: cert(serviceAccount) });
    }
  } else {
    console.error("Could not find service-account.json file at", serviceAccountPath);
    process.exit(1);
  }
  db = getFirestore();
} catch (error) {
  console.error("Firebase Admin Initialization Error. Please ensure you provide a valid FIREBASE_SERVICE_ACCOUNT environment variable.");
  process.exit(1);
}

async function migrateData() {
  console.log("🚀 Starting Data Migration: Firebase -> Supabase/Prisma");

  try {
    // 1. Migrate Users
    console.log("Migrating Users...");
    const usersSnap = await db.collection('users').get();
    const usersToInsert = usersSnap.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        email: data.email || `${doc.id}@placeholder.com`,
        username: data.username || data.name || null,
        school: data.school || null,
        department: data.department || null,
        createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
      };
    });

    for (const user of usersToInsert) {
      try {
        await prisma.user.upsert({
          where: { id: user.id },
          update: user,
          create: user,
        });
      } catch (e: any) {
        if (e.code === 'P2002') {
          // Unique constraint failed, likely a duplicate email in Firebase.
          console.warn(`⚠️ Skipping user ${user.id} due to duplicate email: ${user.email}`);
        } else {
          throw e;
        }
      }
    }
    console.log(`✅ Migrated ${usersToInsert.length} Users`);

    // 2. Migrate Timetables
    console.log("Migrating Timetables...");
    const timetablesSnap = await db.collection('timetables').get();
    const timetablesToInsert = timetablesSnap.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id, // Or generate new cuid if needed, but we can reuse the Firebase document ID
        userId: doc.id, // Assuming doc.id is the userId based on context
        data: data,
      };
    });

    for (const timetable of timetablesToInsert) {
      // Ensure the user exists before inserting the timetable to avoid foreign key constraints
      const userExists = await prisma.user.findUnique({ where: { id: timetable.userId } });
      if (userExists) {
        await prisma.timetable.upsert({
          where: { id: timetable.id },
          update: { data: timetable.data },
          create: timetable,
        });
      }
    }
    console.log(`✅ Migrated Timetables`);

    // 3. Migrate Chats (to Workspaces) and Messages
    console.log("Migrating Chats & Messages...");
    const chatsSnap = await db.collection('chats').get();
    
    for (const chatDoc of chatsSnap.docs) {
      const chatData = chatDoc.data();
      const workspaceId = chatDoc.id;
      const userId = chatData.userId;

      // Ensure user exists
      const userExists = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
      
      // Create Workspace
      await prisma.workspace.upsert({
        where: { id: workspaceId },
        update: {
          title: chatData.title || 'Untitled Chat',
          updatedAt: chatData.updatedAt ? chatData.updatedAt.toDate() : new Date(),
        },
        create: {
          id: workspaceId,
          title: chatData.title || 'Untitled Chat',
          userId: userExists ? userId : null,
          createdAt: chatData.createdAt ? chatData.createdAt.toDate() : new Date(),
          updatedAt: chatData.updatedAt ? chatData.updatedAt.toDate() : new Date(),
        }
      });

      // Migrate Subcollection Messages
      const messagesSnap = await chatDoc.ref.collection('messages').get();
      const messagesToInsert = messagesSnap.docs.map((msgDoc: any) => {
        const msgData = msgDoc.data();
        return {
          id: msgDoc.id,
          role: msgData.role || 'user',
          text: msgData.text || '',
          createdAt: msgData.createdAt ? msgData.createdAt.toDate() : new Date(),
          workspaceId: workspaceId,
        };
      });

      for (const msg of messagesToInsert) {
        await prisma.message.upsert({
          where: { id: msg.id },
          update: msg,
          create: msg,
        });
      }
    }
    console.log(`✅ Migrated ${chatsSnap.docs.length} Chats and their Messages`);

    console.log("🎉 Migration Complete!");
  } catch (error) {
    console.error("❌ Migration Failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateData();

```

### `scripts\purge-firebase.ts`
```ts
import fs from 'fs';
import path from 'path';

function replaceInFile(filePath: string, replacements: Array<{search: RegExp | string, replace: string}>) {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) return;
    let content = fs.readFileSync(fullPath, 'utf8');
    for (const r of replacements) {
        content = content.replace(r.search, r.replace);
    }
    fs.writeFileSync(fullPath, content);
    console.log(`Updated ${filePath}`);
}

// 2. VAULT
replaceInFile('app/(app)/vault/page.tsx', [
    { search: /import { auth, db } from '\.\.\/\.\.\/\.\.\/lib\/firebase';\n/g, replace: '' },
    { search: /import { onAuthStateChanged } from 'firebase\/auth';\n/g, replace: '' },
    { search: /import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, deleteDoc } from 'firebase\/firestore';\n/g, replace: '' },
    { 
      search: /const vq = query\(collection\(db, 'vault_files'\), where\('userId', '==', context\.uid\)\);\n\s+const vaultSnap = await getDocs\(vq\);\n\s+const vFiles = vaultSnap\.docs\.map\(d => \(\{\ id: d\.id, \.\.\.d\.data\(\) \}\)\);/g, 
      replace: `const res = await fetch('/api/documents');\n        const vFiles = await res.json();` 
    },
    { 
      search: /const sq = query\(collection\(db, 'study_guides'\), where\('userId', '==', context\.uid\)\);\n\s+const studyGuideSnap = await getDocs\(sq\);\n\s+const sGuides = studyGuideSnap\.docs\.map\(d => \(\{\ id: d\.id, \.\.\.d\.data\(\) \}\)\);/g, 
      replace: `const resSq = await fetch('/api/study-guides?userId=' + context.uid);\n        const sGuides = await resSq.json();` 
    },
    {
      search: /const q = query\(collection\(db, 'vault_files'\), where\('userId', '==', userData\.uid\)\);\n\s+const querySnapshot = await getDocs\(q\);\n\s+const existingFiles = querySnapshot\.docs\.map\(doc => doc\.data\(\)\);/g,
      replace: `const res = await fetch('/api/documents');\n      const existingFiles = await res.json();`
    },
    {
      search: /await addDoc\(collection\(db, 'vault_files'\), \{\n\s+userId: userData\.uid,\n\s+fileName: fileRes\.name,\n\s+fileSize: fileRes\.size,\n\s+downloadURL: fileRes\.url,\n\s+uploadedAt: serverTimestamp\(\),\n\s+status: 'raw'\n\s+\}\);/g,
      replace: `await fetch('/api/documents', {\n              method: 'POST',\n              headers: { 'Content-Type': 'application/json' },\n              body: JSON.stringify({\n                name: fileRes.name,\n                url: fileRes.url\n              })\n            });`
    },
    {
      search: /const deletePromises = selectedMaterials\.map\(id => deleteDoc\(doc\(db, 'vault_files', id\)\)\);/g,
      replace: `const deletePromises = selectedMaterials.map(id => fetch('/api/documents?id=' + id, { method: 'DELETE' }));`
    },
    {
      search: /await deleteDoc\(doc\(db, 'vault_files', id\)\);/g,
      replace: `await fetch('/api/documents?id=' + id, { method: 'DELETE' });`
    },
    {
      search: /const docRef = await addDoc\(collection\(db, 'study_guides'\), newGuide\);\n\n\s+const fullGuide = \{\ id: docRef\.id, \.\.\.newGuide, createdAt: \{\ seconds: Math\.floor\(Date\.now\(\) \/ 1000\) \}\ \};/g,
      replace: `const docRef = await fetch('/api/study-guides', {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify(newGuide)\n      });\n      const fullGuide = await docRef.json();`
    }
]);

// 3. STUDY GUIDES
replaceInFile('app/(app)/study-guides/page.tsx', [
    { search: /import { auth, db } from '\.\.\/\.\.\/\.\.\/lib\/firebase';\n/g, replace: '' },
    { search: /import { onAuthStateChanged } from 'firebase\/auth';\n/g, replace: '' },
    { search: /import { collection, getDocs, query, where } from 'firebase\/firestore';\n/g, replace: '' },
    {
      search: /const unsubscribe = onAuthStateChanged\(auth, async \(user\) => \{\n\s+if \(user\) \{\n\s+setUserData\(\{ name: user\.displayName \|\| 'Student', email: user\.email \|\| '', uid: user\.uid \}\);\n\s+try \{\n\s+const sq = query\(collection\(db, 'study_guides'\), where\('userId', '==', user\.uid\)\);\n\s+const studyGuideSnap = await getDocs\(sq\);\n\s+const sGuides = studyGuideSnap\.docs\.map\(d => \(\{\ id: d\.id, \.\.\.d\.data\(\) \}\)\);\n\s+sGuides\.sort\(\(a: any, b: any\) => \(b\.createdAt\?\.seconds \|\| 0\) - \(a\.createdAt\?\.seconds \|\| 0\)\);\n\s+setStudyGuides\(sGuides\);\n\s+\} catch\(e\) \{ console\.error\(e\) \}\n\s+\} else \{\n\s+setUserData\(\{ name: 'Guest Student', email: 'Not signed in', uid: '', profile: null \}\);\n\s+\}\n\s+\}\);\n\s+return \(\) => unsubscribe\(\);/g,
      replace: `const fetchGuides = async () => {\n      const { data: { session } } = await import('@/utils/supabase/client').then(m => m.supabase.auth.getSession());\n      if (session?.user) {\n        setUserData({ name: session.user.email?.split('@')[0] || 'Student', email: session.user.email || '', uid: session.user.id });\n        try {\n          const res = await fetch('/api/study-guides?userId=' + session.user.id);\n          const sGuides = await res.json();\n          setStudyGuides(sGuides);\n        } catch(e) { console.error(e) }\n      }\n    };\n    fetchGuides();`
    }
]);

console.log("Done purging Firebase.");

```

### `scripts\rls-setup.ts`
```ts
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log("Connected to DB via pg!");

    // 1. Enable RLS
    await client.query(`ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;`);
    await client.query(`ALTER TABLE "Workspace" ENABLE ROW LEVEL SECURITY;`);
    await client.query(`ALTER TABLE "Timetable" ENABLE ROW LEVEL SECURITY;`);
    await client.query(`ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;`);
    await client.query(`ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;`);
    console.log("✅ RLS Enabled on all core tables.");

    // Helper to safely drop existing policies before creating new ones
    const dropPolicy = async (table: string, policyName: string) => {
        try {
            await client.query(`DROP POLICY IF EXISTS "${policyName}" ON "${table}";`);
        } catch (e) {}
    };

    // 2. User Policies
    await dropPolicy('User', 'Users can manage their own profile');
    await client.query(`
        CREATE POLICY "Users can manage their own profile" ON "User"
        FOR ALL USING (id = auth.uid()::text) WITH CHECK (id = auth.uid()::text);
    `);

    // 3. Workspace Policies
    await dropPolicy('Workspace', 'Users can manage their own workspaces');
    await client.query(`
        CREATE POLICY "Users can manage their own workspaces" ON "Workspace"
        FOR ALL USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);
    `);

    // 4. Timetable Policies
    await dropPolicy('Timetable', 'Users can manage their own timetables');
    await client.query(`
        CREATE POLICY "Users can manage their own timetables" ON "Timetable"
        FOR ALL USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);
    `);

    // 5. Document Policies
    await dropPolicy('Document', 'Users can manage documents in their workspaces');
    await client.query(`
        CREATE POLICY "Users can manage documents in their workspaces" ON "Document"
        FOR ALL USING (
          EXISTS (SELECT 1 FROM "Workspace" WHERE "Workspace".id = "Document"."workspaceId" AND "Workspace"."userId" = auth.uid()::text)
        ) WITH CHECK (
          EXISTS (SELECT 1 FROM "Workspace" WHERE "Workspace".id = "Document"."workspaceId" AND "Workspace"."userId" = auth.uid()::text)
        );
    `);

    // 6. Message Policies
    await dropPolicy('Message', 'Users can manage messages in their workspaces');
    await client.query(`
        CREATE POLICY "Users can manage messages in their workspaces" ON "Message"
        FOR ALL USING (
          EXISTS (SELECT 1 FROM "Workspace" WHERE "Workspace".id = "Message"."workspaceId" AND "Workspace"."userId" = auth.uid()::text)
        ) WITH CHECK (
          EXISTS (SELECT 1 FROM "Workspace" WHERE "Workspace".id = "Message"."workspaceId" AND "Workspace"."userId" = auth.uid()::text)
        );
    `);

    console.log("✅ RLS Policies Created successfully!");
  } catch (err) {
    console.error("❌ SQL Error:", err);
  } finally {
    await client.end();
  }
}

run();

```

### `scripts\schema-create.ts`
```ts
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log("Connected to DB via pg!");

    await client.query(`
      CREATE TABLE IF NOT EXISTS "User" (
          "id" TEXT NOT NULL,
          "email" TEXT NOT NULL,
          "username" TEXT,
          "school" TEXT,
          "department" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "User_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log("Created User table.");

    try {
      await client.query(`CREATE UNIQUE INDEX "User_email_key" ON "User"("email");`);
    } catch(e:any) {}

    await client.query(`
      CREATE TABLE IF NOT EXISTS "Workspace" (
          "id" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          "userId" TEXT,
          CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log("Created Workspace table.");

    await client.query(`
      CREATE TABLE IF NOT EXISTS "Message" (
          "id" TEXT NOT NULL,
          "role" TEXT NOT NULL,
          "text" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "workspaceId" TEXT NOT NULL,
          CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log("Created Message table.");

    await client.query(`
      CREATE TABLE IF NOT EXISTS "Document" (
          "id" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "url" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "workspaceId" TEXT NOT NULL,
          CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log("Created Document table.");

    await client.query(`
      CREATE TABLE IF NOT EXISTS "Timetable" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "data" JSONB NOT NULL,
          CONSTRAINT "Timetable_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log("Created Timetable table.");

    // Add foreign keys
    try { await client.query(`ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;`); } catch(e:any) {}
    try { await client.query(`ALTER TABLE "Message" ADD CONSTRAINT "Message_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;`); } catch(e:any) {}
    try { await client.query(`ALTER TABLE "Document" ADD CONSTRAINT "Document_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;`); } catch(e:any) {}
    try { await client.query(`ALTER TABLE "Timetable" ADD CONSTRAINT "Timetable_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;`); } catch(e:any) {}

    console.log("Schema updated successfully via SQL!");
  } catch (err) {
    console.error("SQL Error:", err);
  } finally {
    await client.end();
  }
}

run();

```

### `scripts\schema-index.ts`
```ts
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function run() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log("Connected to DB via pg!");

    // Alter the column to 768 dimensions as requested
    await client.query(`
      ALTER TABLE "DocumentChunk" ALTER COLUMN embedding TYPE vector(768);
    `);

    // Create HNSW index for L2 distance (which maps to <-> operator)
    await client.query(`
      CREATE INDEX IF NOT EXISTS "embeddingIndex" 
      ON "DocumentChunk" 
      USING hnsw (embedding vector_l2_ops);
    `);
    
    console.log("✅ Vector Index 'embeddingIndex' created successfully!");

  } catch (err) {
    console.error("❌ SQL Error:", err);
  } finally {
    await client.end();
  }
}

run();

```

### `scripts\schema-vector.ts`
```ts
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function run() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log("Connected to DB via pg!");

    await client.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log("Vector extension enabled!");

    await client.query(`
      CREATE TABLE IF NOT EXISTS "DocumentChunk" (
        "id" TEXT NOT NULL,
        "documentId" TEXT NOT NULL,
        "content" TEXT NOT NULL,
        "embedding" vector(768),
        "pageNumber" INTEGER,

        CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
      );
    `);

    // Add foreign key constraint if it doesn't exist
    try {
      await client.query(`
        ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `);
      console.log("Foreign key constraint added!");
    } catch(e: any) {
      console.log("Constraint might already exist:", e.message);
    }

    // Enable RLS and add policies
    await client.query(`ALTER TABLE "DocumentChunk" ENABLE ROW LEVEL SECURITY;`);
    
    // Policy for DocumentChunk: Same as Document (user owns the Workspace)
    await client.query(`DROP POLICY IF EXISTS "Users can manage chunks in their workspaces" ON "DocumentChunk";`);
    await client.query(`
        CREATE POLICY "Users can manage chunks in their workspaces" ON "DocumentChunk"
        FOR ALL USING (
          EXISTS (
            SELECT 1 FROM "Document" d
            JOIN "Workspace" w ON w.id = d."workspaceId"
            WHERE d.id = "DocumentChunk"."documentId" AND w."userId" = auth.uid()::text
          )
        ) WITH CHECK (
          EXISTS (
            SELECT 1 FROM "Document" d
            JOIN "Workspace" w ON w.id = d."workspaceId"
            WHERE d.id = "DocumentChunk"."documentId" AND w."userId" = auth.uid()::text
          )
        );
    `);

    console.log("✅ DocumentChunk table and RLS created successfully!");

  } catch (err) {
    console.error("❌ SQL Error:", err);
  } finally {
    await client.end();
  }
}

run();

```

### `scripts\sql-push.ts`
```ts
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log("Connected to DB via pg!");

    await client.query(`
      CREATE TABLE IF NOT EXISTS "Timetable" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "data" JSONB NOT NULL,
        CONSTRAINT "Timetable_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log("Created Timetable table.");

    try {
      await client.query(`ALTER TABLE "Timetable" ADD CONSTRAINT "Timetable_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);
      console.log("Added foreign key to Timetable.");
    } catch (e: any) {
      if (!e.message.includes("already exists")) console.error(e.message);
    }

    try {
      await client.query(`ALTER TABLE "Workspace" ADD COLUMN "userId" TEXT;`);
      console.log("Added userId to Workspace.");
    } catch (e: any) {
      if (!e.message.includes("already exists") && !e.message.includes("column \"userId\" of relation \"Workspace\" already exists")) console.error(e.message);
    }

    try {
      await client.query(`ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);
      console.log("Added foreign key to Workspace.");
    } catch (e: any) {
      if (!e.message.includes("already exists")) console.error(e.message);
    }

    console.log("Schema updated successfully via SQL!");
  } catch (err) {
    console.error("SQL Error:", err);
  } finally {
    await client.end();
  }
}

run();

```

### `scripts\test-upload.ts`
```ts
import { prisma } from '../lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

async function run() {
  try {
    const text = "This is a quick test document to verify 768-dimensional vector insertion into Supabase pgvector.";
    
    // 1. Generate Embedding
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
    const result = await model.embedContent(text);
    let embedding = result.embedding.values;

    if (embedding.length > 768) {
       console.log(`Model generated ${embedding.length} dims. Slicing to 768...`);
       embedding = embedding.slice(0, 768);
    }
    
    console.log(`Final embedding length to insert: ${embedding.length}`);

    // 2. Create Dummy Document
    const doc = await prisma.document.create({
      data: {
        name: "Test Doc",
        url: "https://test.com",
        workspaceId: "global-vault-001"
      }
    });

    // 3. Insert Chunk
    await prisma.$executeRawUnsafe(
      `INSERT INTO "DocumentChunk" ("id", "documentId", "content", "embedding") 
       VALUES ($1, $2, $3, $4::vector)`,
      `test-chunk-1`,
      doc.id,
      text,
      `[${embedding.join(',')}]`
    );

    console.log("✅ Successfully inserted DocumentChunk with vector embedding!");
    
    // Cleanup
    await prisma.document.delete({ where: { id: doc.id } });
    
  } catch (error) {
    console.error("❌ Test Failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

run();

```

### `package.json`
```json
{
  "name": "cognibase",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "postinstall": "prisma generate"
  },
  "dependencies": {
    "@ai-sdk/google": "^3.0.83",
    "@ai-sdk/react": "^3.0.211",
    "@google/generative-ai": "^0.24.1",
    "@prisma/adapter-pg": "^7.8.0",
    "@prisma/client": "^7.8.0",
    "@supabase/ssr": "^0.12.0",
    "@supabase/supabase-js": "^2.108.2",
    "@tailwindcss/typography": "^0.5.20",
    "@types/turndown": "^5.0.6",
    "ai": "^6.0.209",
    "cheerio": "^1.2.0",
    "dotenv": "^17.4.2",
    "framer-motion": "^12.41.0",
    "lucide-react": "^1.18.0",
    "mammoth": "^1.12.0",
    "mermaid": "^11.16.0",
    "next": "16.2.9",
    "next-themes": "^0.4.6",
    "officeparser": "^7.2.1",
    "pdf2json": "^4.0.3",
    "pdf2md": "^1.0.2",
    "pg": "^8.22.0",
    "pptxgenjs": "^4.0.1",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "react-markdown": "^10.1.0",
    "react-zoom-pan-pinch": "^4.0.3",
    "recharts": "^3.9.1",
    "remark-gfm": "^4.0.1",
    "sonner": "^2.0.7",
    "tsx": "^4.22.4",
    "turndown": "^7.2.4",
    "youtube-transcript": "^1.3.1",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/pg": "^8.20.0",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.9",
    "prisma": "^7.8.0",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}

```

### `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}

```

### `tailwind.config.ts`
```json
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/(app)/vault/**/*.{js,ts,jsx,tsx,mdx}',
    './app/(app)/vault/page.tsx'
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/typography')
  ],
};

export default config;

```



### `middleware.ts`
```ts
import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

```

### `next.config.ts`
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

```

### `prisma.config.ts`
```ts
// This file was generated by Prisma, and assumes you have installed the following:
// npm install --save-dev prisma dotenv
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DIRECT_URL"],
  },
});

```

### `push.sql`
```sql
��- -   C r e a t e S c h e m a  
 C R E A T E   S C H E M A   I F   N O T   E X I S T S   " p u b l i c " ;  
  
 - -   C r e a t e T a b l e  
 C R E A T E   T A B L E   " W o r k s p a c e "   (  
         " i d "   T E X T   N O T   N U L L ,  
         " t i t l e "   T E X T   N O T   N U L L ,  
         " c r e a t e d A t "   T I M E S T A M P ( 3 )   N O T   N U L L   D E F A U L T   C U R R E N T _ T I M E S T A M P ,  
         " u p d a t e d A t "   T I M E S T A M P ( 3 )   N O T   N U L L ,  
         " u s e r I d "   T E X T ,  
  
         C O N S T R A I N T   " W o r k s p a c e _ p k e y "   P R I M A R Y   K E Y   ( " i d " )  
 ) ;  
  
 - -   C r e a t e T a b l e  
 C R E A T E   T A B L E   " M e s s a g e "   (  
         " i d "   T E X T   N O T   N U L L ,  
         " r o l e "   T E X T   N O T   N U L L ,  
         " t e x t "   T E X T   N O T   N U L L ,  
         " c r e a t e d A t "   T I M E S T A M P ( 3 )   N O T   N U L L   D E F A U L T   C U R R E N T _ T I M E S T A M P ,  
         " w o r k s p a c e I d "   T E X T   N O T   N U L L ,  
  
         C O N S T R A I N T   " M e s s a g e _ p k e y "   P R I M A R Y   K E Y   ( " i d " )  
 ) ;  
  
 - -   C r e a t e T a b l e  
 C R E A T E   T A B L E   " D o c u m e n t "   (  
         " i d "   T E X T   N O T   N U L L ,  
         " n a m e "   T E X T   N O T   N U L L ,  
         " u r l "   T E X T   N O T   N U L L ,  
         " c r e a t e d A t "   T I M E S T A M P ( 3 )   N O T   N U L L   D E F A U L T   C U R R E N T _ T I M E S T A M P ,  
         " w o r k s p a c e I d "   T E X T   N O T   N U L L ,  
  
         C O N S T R A I N T   " D o c u m e n t _ p k e y "   P R I M A R Y   K E Y   ( " i d " )  
 ) ;  
  
 - -   C r e a t e T a b l e  
 C R E A T E   T A B L E   " U s e r "   (  
         " i d "   T E X T   N O T   N U L L ,  
         " e m a i l "   T E X T   N O T   N U L L ,  
         " u s e r n a m e "   T E X T ,  
         " s c h o o l "   T E X T ,  
         " d e p a r t m e n t "   T E X T ,  
         " c r e a t e d A t "   T I M E S T A M P ( 3 )   N O T   N U L L   D E F A U L T   C U R R E N T _ T I M E S T A M P ,  
         " u p d a t e d A t "   T I M E S T A M P ( 3 )   N O T   N U L L ,  
  
         C O N S T R A I N T   " U s e r _ p k e y "   P R I M A R Y   K E Y   ( " i d " )  
 ) ;  
  
 - -   C r e a t e T a b l e  
 C R E A T E   T A B L E   " T i m e t a b l e "   (  
         " i d "   T E X T   N O T   N U L L ,  
         " u s e r I d "   T E X T   N O T   N U L L ,  
         " d a t a "   J S O N B   N O T   N U L L ,  
  
         C O N S T R A I N T   " T i m e t a b l e _ p k e y "   P R I M A R Y   K E Y   ( " i d " )  
 ) ;  
  
 - -   C r e a t e I n d e x  
 C R E A T E   U N I Q U E   I N D E X   " U s e r _ e m a i l _ k e y "   O N   " U s e r " ( " e m a i l " ) ;  
  
 - -   A d d F o r e i g n K e y  
 A L T E R   T A B L E   " W o r k s p a c e "   A D D   C O N S T R A I N T   " W o r k s p a c e _ u s e r I d _ f k e y "   F O R E I G N   K E Y   ( " u s e r I d " )   R E F E R E N C E S   " U s e r " ( " i d " )   O N   D E L E T E   C A S C A D E   O N   U P D A T E   C A S C A D E ;  
  
 - -   A d d F o r e i g n K e y  
 A L T E R   T A B L E   " M e s s a g e "   A D D   C O N S T R A I N T   " M e s s a g e _ w o r k s p a c e I d _ f k e y "   F O R E I G N   K E Y   ( " w o r k s p a c e I d " )   R E F E R E N C E S   " W o r k s p a c e " ( " i d " )   O N   D E L E T E   C A S C A D E   O N   U P D A T E   C A S C A D E ;  
  
 - -   A d d F o r e i g n K e y  
 A L T E R   T A B L E   " D o c u m e n t "   A D D   C O N S T R A I N T   " D o c u m e n t _ w o r k s p a c e I d _ f k e y "   F O R E I G N   K E Y   ( " w o r k s p a c e I d " )   R E F E R E N C E S   " W o r k s p a c e " ( " i d " )   O N   D E L E T E   C A S C A D E   O N   U P D A T E   C A S C A D E ;  
  
 - -   A d d F o r e i g n K e y  
 A L T E R   T A B L E   " T i m e t a b l e "   A D D   C O N S T R A I N T   " T i m e t a b l e _ u s e r I d _ f k e y "   F O R E I G N   K E Y   ( " u s e r I d " )   R E F E R E N C E S   " U s e r " ( " i d " )   O N   D E L E T E   C A S C A D E   O N   U P D A T E   C A S C A D E ;  
  
 
```

### `CLAUDE.md`
```markdown
@AGENTS.md

```

### `cognibase-architecture.md`
```markdown
# CogniBase Master Architecture Document

This document serves as the single source of truth for the CogniBase architecture, outlining the active technology stack, feature modules, database schema, and data workflows. 

## 1. Core System Tech Stack

CogniBase is built on a modern, edge-ready, and highly interactive stack designed for speed and AI integration.

- **Framework**: Next.js 16.2.9 (App Router)
- **UI Library**: React 19.2.4
- **Styling**: TailwindCSS v4 with `@tailwindcss/typography`
- **Animations**: Framer Motion (for premium, native-feeling interactions like Activity Rings and 3D Flashcards)
- **Database ORM**: Prisma 7.8.0 with `@prisma/adapter-pg`
- **Database Engine**: PostgreSQL with `pgvector` extension for semantic search and embeddings
- **Backend Storage & Auth**: Supabase (`@supabase/supabase-js`, `@supabase/ssr`)
- **AI Integration**: Google Generative AI SDK (`@google/generative-ai`, `@ai-sdk/google`).
  - **Active Model String**: `gemini-3.5-flash` (Configured centrally in `lib/ai/model-router.ts`)
- **Document Parsing**: 
  - `officeparser`, `mammoth` (Word/Office files)
  - `pdf2md`, `pdf2json` (PDF files)
  - `youtube-transcript` (Video processing)

## 2. Every Active App Feature & Module

The platform is divided into distinct, purpose-built engines and workspaces under the `app/(app)` directory.

### Context Engine (Vault & Data Ingestion)
- **The Vault (`/vault`)**: The centralized command center for all user data. Users upload files here, which are stored and processed.
- **The >_console**: An integrated command-line-style AI chat interface within the Vault that allows users to query their uploaded materials directly.
- **Course & Timetable Extraction**: Specialized API endpoints (`/api/engine/extract-courses`, `/api/engine/extract-timetable`) that use Gemini to autonomously parse messy syllabi/schedules and output structured JSON data for the user's dashboard.

### Transformation Engine (Studio Assets)
- **Gamified Study Execution Engine**: A unified component (`StudyEngine.tsx`) replacing static study guides. It features a vertical **Quest Log**, a full-screen **Micro-Bite Reader** (Duolingo-style tap-through learning), and **Swipeable 3D Flashcards**.
- **Generators**: Dedicated API routes (`/api/engine/...`) for transforming raw documents into high-value assets:
  - `generate-study-guide` (Outputs strict JSON mapped to the Study Engine)
  - `generate-flashcards`
  - *Extensible structure for Podcasts, Mindmaps, and PPTs.*

### Zen Reader (Lecture Materials)
- **Hybrid Reading Architecture**: A dedicated, distraction-free reading zone (`/lecture-materials/[id]`). 
  - It utilizes smart conditional rendering based on file type: `.docx` and `.txt` files are parsed and rendered via an aggressively styled `ReactMarkdown` component (Typographic Scale), while `.pdf` files are embedded directly to preserve native visual layouts, wrapped in a premium dark-mode shell.

### Analytics Dashboard
- **Deep Work Metrics**: A mobile-app inspired dashboard (`components/StudyAnalyticsDashboard.tsx`) featuring Apple Fitness-style concentric SVG Activity Rings (Tasks Completed, Deep Work Minutes, Knowledge Retention) built with Framer Motion. 
- **Streak Engine**: A visual 7-day consistency tracker that highlights active streaks with spring-animated glows.

## 3. Current Prisma Schema Map

The PostgreSQL database is fully modeled via Prisma. Here is how the core entities relate:

- **`User`**: The central entity, linked to Supabase Auth UUIDs. Owns Workspaces, Timetables, and Study Guides.
- **`Workspace`**: A collaborative or isolated environment containing `Messages`, `Documents`, and `StudioAssets`.
- **`Document`**: Represents an uploaded file or imported URL. Stores raw `textContent` and metadata. One-to-many relationship with `DocumentChunk` and `StudyGuide`.
- **`DocumentChunk`**: Stores segmented document text along with a `vector(768)` embedding for RAG (Retrieval-Augmented Generation) and semantic search.
- **`Timetable`**: Stores structured schedule data as JSON.
- **`StudyGuide`**: Links a user to a generated guide based on a `Document`. The generated payload (Micro-bites, phases, flashcards) is stored as strict JSON in the `strategyData` column.
- **`StudioAsset`**: A generalized model for generated assets (Flashcards, Mindmaps, Audio, Presentations) stored as JSON.
- **`StudyGoal` & `DailyMetric`**: Time-series tables tracking user focus hours, task completion, and accuracy for the Analytics Dashboard.

## 4. Current Operational Workflow

Here is the lifecycle of data as it moves through the platform:

1. **Ingestion & Upload**: 
   - User uploads a file in the Vault.
   - The file is pushed to a Supabase public storage bucket.
   - A `Document` record is created in Prisma referencing the public URL.
2. **Extraction Pipeline**:
   - The document is parsed via backend routes (using `officeparser` or `pdf2md` depending on the mime-type) to extract raw `textContent`.
   - *Future/Background task*: Text is chunked, embedded, and saved to `DocumentChunk` for RAG.
3. **Feature Generation (e.g., Gamified Study Guide)**:
   - User triggers a generation via the Vault UI (e.g., Study Brief Configurator).
   - Frontend sends the `Document` URL and configuration payload to `/api/engine/generate-study-guide`.
   - The backend fetches the raw file, extracts the text, and feeds it to `gemini-3.5-flash` with a strict JSON schema prompt and `responseMimeType: "application/json"`.
   - The AI returns structured JSON (Phases, Micro-Bites, Flashcards).
4. **Storage & Execution**:
   - The backend parses the JSON and saves it into the `StudyGuide.strategyData` column in Prisma.
   - The frontend intercepts the new data and mounts the `<StudyEngine>` component, allowing the user to interactively tap through the generated content.

```

### `README.md`
```markdown
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

```
