# LookAtMe

Private SaaS foundation for an AI-native professional identity platform. The current milestone preserves the working portfolio experience from the public reference implementation while establishing a clean Vercel-hosted codebase.

## Current state

- `/` redirects to `/lingyun` on Vercel.
- `/lingyun` renders the temporary Lingyun seed profile.
- The portfolio renderer remains the proven Vite/static implementation.
- Chat remains single-profile and uses the bundled Lingyun RAG index.
- `/auth` provides Supabase email/password sign-up and sign-in with persistent browser sessions.
- `/dashboard/create`, `/edit`, `/dashboard`, and `/preview` require authentication.
- `/dashboard/create` accepts PDF and DOCX CVs, maps them into a structured `ProfileDocument`, and supports review/save/preview without requiring an avatar. Pasted resume text and LinkedIn scraping are not user-facing inputs; LinkedIn users are guided to export a PDF.
- `/dashboard/avatar` owns original-photo upload, non-blocking generation, job status, avatar history, preview, deletion of inactive assets, and explicit activation.
- Resume mapping prefers a server-side structured-output LLM and falls back to the deterministic local parser.
- `lookatme-avatar` is consumed as an external GitHub SDK: browser/React imports remain client-side, while `lookatme-avatar/server` stays in the getlookatme Node API and uses the app-owned `OPENAI_API_KEY`.
- Generated images are written directly to owner-scoped Supabase Storage by the background worker. Durable records contain paths and metadata, never expiring signed URLs.
- Profile publishing controls, RAG isolation, billing, analytics, and custom domains do not exist yet.

## Development

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Create or link a Supabase project, apply all files under `supabase/migrations/`, then configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Server processes also require `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`; the avatar worker additionally requires `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET`. Never expose either secret through a `VITE_*` variable.

For local chat and LLM-assisted resume mapping, set `OPENAI_API_KEY`, set `VITE_API_BASE_URL=http://localhost:3001`, and run `pnpm dev:api` separately. Set `ONBOARDING_LLM_ENABLED=false` server-side or `VITE_ONBOARDING_LLM_ENABLED=false` client-side to force deterministic onboarding. `VITE_ONBOARDING_LLM_TIMEOUT_MS` defaults to 60000 so normal structured extraction has time to finish before deterministic fallback.

For local avatar generation, also set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENAI_API_KEY`, apply all migrations, then run `pnpm dev:avatar-worker` alongside the UI/API processes. The dev-only worker polls for queued jobs every five seconds by default, processes one job at a time, and stops cleanly on SIGINT/SIGTERM. `AVATAR_WORKER_POLL_MS` can change the interval. `CRON_SECRET` protects the HTTP worker endpoint and is required for Vercel Cron, but the local loop invokes the shared worker service directly.

When using a split local UI/API, `ALLOWED_ORIGINS` must contain the exact browser origin. The example configuration includes both `http://localhost:5173` and `http://127.0.0.1:5173` (plus port 5174 fallbacks). Development console messages prefixed with `[onboarding]` show the selected mapper, endpoint/status, response validation, fallback reason, and final review mapper without logging resume text.

Validation:

```bash
pnpm typecheck
pnpm test
pnpm build
```

## LookAtMe onboarding integration

Profile and avatar are separate product domains:

```text
CV upload → extraction → structured ProfileDocument → review/edit → preview
photo → generation job → background worker → avatar asset → gallery → explicit activation
```

Preview resolves presentation in this order: active generated avatar, original uploaded photo, initials. A ready job never auto-activates and never blocks profile creation or preview.

The server boundary remains getlookatme-owned. Browser code never calls OpenAI or imports `lookatme-avatar/server`. `POST /api/avatar-jobs` quickly creates a queued row. Vercel Cron invokes `/api/avatar-worker`; the worker atomically claims one queued or stale job, generates through:

```ts
import {
  PhotoAIFrameProducer,
  OpenAIImageGenerationProvider,
} from "lookatme-avatar/server";
```

The app uses its own `OPENAI_API_KEY` runtime environment and does not depend on a separate LookAtMe demo server or `localhost:5180`.

See `PRODUCT.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `STATUS.md`, and `docs/LOOKATME_INTEGRATION.md` for scope and decisions.
