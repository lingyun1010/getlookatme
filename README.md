# LookAtMe

Persistent profile knowledge architecture and local commands are documented in [`docs/PERSISTENT_KNOWLEDGE.md`](docs/PERSISTENT_KNOWLEDGE.md).

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
cp .env.example .env.local
pnpm exec supabase start
pnpm dev
```

`pnpm exec supabase status` prints the local URL and credentials. Map its **Publishable key** to `VITE_SUPABASE_PUBLISHABLE_KEY` for the browser and `SUPABASE_PUBLISHABLE_KEY` for authenticated server APIs. Map its **Secret key** to the existing server-only `SUPABASE_SERVICE_ROLE_KEY` variable used by workers and maintenance tooling. Supabase calls the local credential a Secret key, but the repository retains the current variable name to avoid an unrelated runtime rename. Never expose a Secret/service-role key or `OPENAI_API_KEY` through `VITE_*`; Vite includes every `VITE_*` value in browser bundles.

`.env.local` is the recommended ignored local-development file. `.env` and every `.env*.local` file are also ignored. Only placeholder templates such as `.env.example` and `.env.production.example` are tracked.

For local chat and LLM-assisted resume mapping, set server-only `OPENAI_API_KEY`, set `VITE_API_BASE_URL=http://localhost:3001`, and run `pnpm dev:api` separately. Set `ONBOARDING_LLM_ENABLED=false` server-side or `VITE_ONBOARDING_LLM_ENABLED=false` client-side to force deterministic onboarding. `VITE_ONBOARDING_LLM_TIMEOUT_MS` defaults to 60000 so normal structured extraction has time to finish before deterministic fallback.

For local avatar generation, also set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENAI_API_KEY`, apply all migrations, then run `pnpm dev:avatar-worker` alongside the UI/API processes. The dev-only worker polls for queued jobs every five seconds by default, processes one job at a time, and stops cleanly on SIGINT/SIGTERM. `AVATAR_WORKER_POLL_MS` can change the interval. `CRON_SECRET` protects the HTTP worker endpoint and is required for Vercel Cron, but the local loop invokes the shared worker service directly.

When using a split local UI/API, `ALLOWED_ORIGINS` must contain the exact browser origin. The example configuration includes both `http://localhost:5173` and `http://127.0.0.1:5173` (plus port 5174 fallbacks). Development console messages prefixed with `[onboarding]` show the selected mapper, endpoint/status, response validation, fallback reason, and final review mapper without logging resume text.

### Knowledge tooling

The local knowledge commands load `.env` and then `.env.local`:

```bash
pnpm knowledge:sync <profile-id>
pnpm knowledge:inspect <profile-id>
```

Both require `SUPABASE_URL` and server-only `SUPABASE_SERVICE_ROLE_KEY`. Sync additionally requires `OPENAI_API_KEY`; inspect does not call OpenAI. `OPENAI_EMBEDDING_MODEL` is optional and defaults to `text-embedding-3-small`.

### Local database validation

```bash
pnpm exec supabase db reset
pnpm exec supabase test db
```

The current local pgTAP suite passes and covers profile, avatar, and knowledge ownership/RLS, including cross-profile retrieval isolation.

### Production environment

Use `.env.production.example` as a placeholder contract only. Production Supabase URLs and credentials must come from the deployment platform's environment settings, never from local Supabase or a committed env file. `.env.production.local` may be used for ignored machine-local testing, but must never be committed.

Before production smoke testing, follow [the Production Beta configuration checklist](docs/PRODUCTION_BETA_CONFIG.md), including confirming that every repository migration is present in the production migration history.

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

One Generate click creates a persistent queued job. The background worker claims it automatically when capacity is available; no second browser action is required. Queued jobs can be cancelled, generating jobs cannot be interrupted, and each profile may have only one queued or generating job at a time.

The server boundary remains getlookatme-owned. Browser code never calls OpenAI or imports `lookatme-avatar/server`. `POST /api/avatar-jobs` quickly creates a queued row. Vercel Cron invokes `/api/avatar-worker`; the worker atomically claims one queued or stale job, generates through:

```ts
import {
  PhotoAIFrameProducer,
  OpenAIImageGenerationProvider,
} from "lookatme-avatar/server";
```

The app uses its own `OPENAI_API_KEY` runtime environment and does not depend on a separate LookAtMe demo server or `localhost:5180`.

See `PRODUCT.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `STATUS.md`, and `docs/LOOKATME_INTEGRATION.md` for scope and decisions.
