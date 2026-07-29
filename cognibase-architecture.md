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
