# LookAtMe architecture

## Current architecture

LookAtMe is a Vite-built static portfolio with Vercel serverless endpoints and Supabase for authentication, persisted application data, and assets. `index.html` remains the active public-profile UI surface to preserve the reference implementation's design and interactions. The old React implementation was not migrated.

Product UI and published portfolios have separate visual boundaries. Landing and future SaaS surfaces own their product styles; the public renderer loads the named `kinetic` template stylesheet from `src/profile/templates/kinetic/`. The renderer root exposes both `portfolio-page` and a template-specific class. Future templates must receive their own directory, stylesheet, and root class while continuing to consume the same `ProfileDocument`, avatar, and RAG/chat boundaries. Template selection is publication/presentation state outside `ProfileDocument`, so professional data remains portable across designs.

## Authentication and ownership

Supabase Auth email/password identities are the stable account boundary. The browser uses the publishable key only and lets `supabase-js` persist and refresh its session. `/dashboard/create`, `/edit`, `/dashboard`, and `/preview` require an authenticated user. Onboarding API requests carry the access token and the server validates it with Supabase Auth; route guards are convenience, not the security boundary.

The database model has four application tables:

- `profiles`: immutable UUID, owning `user_id`, mutable unique public slug, canonical `ProfileDocument` JSON, and `is_published`.
- `onboarding_states`: one private row per profile containing the profile draft, private CV path, and original-photo path. Legacy generated-frame columns remain temporarily for backwards compatibility but are no longer written by the product flows.
- `avatars`: immutable generated presentation assets. Each row stores owner/profile identity, source-photo path, style/preset, durable frame paths, metadata, and its unique generation job.
- `avatar_generation_jobs`: durable queued/generating/ready/failed lifecycle with attempts and timestamps.
- `profiles.active_avatar_id`: the explicitly selected generated asset. `NULL` means use the original photo when present, otherwise initials.

An Auth trigger creates one profile and onboarding row for every new user. The composite `(profile_id, user_id)` foreign key prevents an onboarding row being attached to a profile owned by someone else. Explicit Data API grants are paired with RLS: anonymous callers can select only published profiles; authenticated callers can mutate only rows whose `user_id` equals `auth.uid()`. This same stable `user_id`/`profile_id` pair is the future RAG tenant key.

Storage uses two buckets. `profile-private-assets` stores CV source files and original photos and is owner-readable; authenticated previews use short-lived signed URLs. `profile-public-assets` accepts only generated avatar frames needed for public portfolio delivery. Writes to either bucket must use `<user_id>/<profile_id>/...`, and Storage RLS verifies that the authenticated user owns the referenced profile. A future publishing flow for original-photo profiles must explicitly create a public derivative rather than exposing the source upload.

Seed profiles remain in the static registry for backward compatibility. A non-seed public slug is loaded from Supabase only when `is_published` is true. `/preview` loads the current user's document through owner RLS even when it is unpublished.

## Profile and Avatar boundaries (PR #3)

Professional profile data and avatar presentation assets are separate domains. Profile onboarding is PDF/DOCX extraction, structured review, save, and preview. It never waits for avatar generation. The renderer still consumes `ProfileDocument`; a repository adapter resolves the selected `avatars` row into the existing runtime `AvatarFrameSet` and otherwise injects a fresh signed original-photo URL for an authenticated preview.

Avatar generation is a persistent job rather than a browser-held request. `POST /api/avatar-jobs` authenticates the owner and inserts `queued`. Vercel Cron calls the protected `/api/avatar-worker` endpoint every minute. The worker calls the atomic `claim_avatar_generation_job` SQL function (`FOR UPDATE SKIP LOCKED`), marks the job `generating`, downloads the private source photo with the service role, generates and uploads deterministic job-keyed frames, upserts one asset per `generation_job_id`, and marks the job `ready`. A stale `generating` job is reclaimable after 15 minutes. Failed jobs expose a safe diagnostic and can be explicitly retried.

A partial unique index permits only one `queued` or `generating` job per profile. Queued jobs can be atomically cancelled through an owner-scoped SQL function; the same row lock/state predicate decides whether cancellation or worker claim wins. Generating jobs cannot be cancelled. Local development runs the same claim/generation service through `pnpm dev:avatar-worker`; this loop is server-side, serial, and independent of browser navigation.

This mechanism matches the deployed Vite + Vercel + Supabase stack without a second queue service. It requires a Vercel plan/runtime that supports the configured 800-second function duration; real generation duration and Cron authentication must be verified after deployment.

Storage records contain paths, IDs, and frame metadata only. Private source photos are signed on read; generated frames use the public asset bucket. Newly completed assets do not alter `profiles.active_avatar_id`.

Legacy `ProfileDocument.avatarFrameSet` data remains a final compatibility fallback so existing profiles render safely while new generation state lives only in `avatars`.

Vercel redirects `/` to `/lingyun` and rewrites single-segment profile paths to the application shell. A static registry resolves `/lingyun` and the fixture `/aaron` to separate `ProfileDocument` instances. Unknown slugs render an explicit not-found state.

The chat endpoint uses a committed, Lingyun-only RAG index. Retrieval uses OpenAI embeddings, in-memory cosine similarity, deterministic intent reranking, and a grounded structured answer. Aaron's document disables AI, and the shared renderer never calls the endpoint for that profile.

M2.0 adds an onboarding surface at `/dashboard/create`. PDF files are semantically extracted with `pdfjs-dist` and DOCX files with Mammoth's raw-text API. Deterministic text utilities remain internal, but pasted text is not a user-facing input. M2.0.1 keeps extraction browser-side and adds a secure server-side semantic mapper. The effective boundary is:

```text
Document
   ↓
Text Extraction
   ↓
ResumeMappingService
   ↙                     ↘
LLM Mapper       Deterministic Fallback
   ↓
ParsedResume
   ↓
ProfileDocumentDraft
   ↓
Validation / Review
   ↓
ProfileDocument
   ↓
Temporary Preview
```

Extraction adapters hide format-specific libraries. `ParsedResume` represents only detected resume facts and carries mapper provenance, inferred-field names, low-confidence-field names, and warnings. `ProfileDocumentDraft` adds review metadata, explicit featured selections, centralized neutral presentation defaults, missing fields, and warnings without changing the canonical `ProfileDocument` contract.

Production onboarding prefers `LLMResumeMappingService`. The browser sends normalized plain text—not the source file—to the dedicated `/api/onboarding/map-resume` endpoint. API credentials and the OpenAI Responses API call remain server-side. The provider uses strict JSON Schema Structured Outputs and an anti-hallucination prompt; the server then runtime-validates all returned fields and HTTP(S) URLs before responding. The client validates the endpoint response again before mapping it into a draft.

`PreferredResumeMappingService` activates `DeterministicResumeMappingService` when LLM mapping is disabled, unconfigured, unavailable, timed out, malformed, or schema-invalid. Fallback adds a visible review warning rather than failing onboarding silently. `OPENAI_ONBOARDING_MODEL` centralizes the server model and `ONBOARDING_LLM_ENABLED=false` disables the server mapper. `VITE_ONBOARDING_LLM_ENABLED=false` selects deterministic mapping directly in the browser.

In development, non-sensitive console diagnostics trace mapper selection, endpoint URL, source type, text length, HTTP status, response validation, fallback reason, and the mapper that populated review. Mapper provenance also survives on `ProfileDocumentDraft` and is exposed as the review step's `data-mapper`; it is never copied into `ProfileDocument`. Local CORS accepts the documented `localhost` and `127.0.0.1` Vite origins and echoes only an allowed request origin.

The mapper prompt permits normalization but prohibits invented identity, links, dates, locations, employers, qualifications, projects, achievements, services, images, or suggested questions. Resume content is delimited and explicitly treated as untrusted data. Inputs are stripped of HTML/script markup, rejected when empty, and capped at 40,000 characters without silent truncation. Server failure logs contain only mapper/category/fallback metadata—not resume text, raw model output, or secrets.

Validation returns classified blocking errors, non-blocking missing information, and mapping warnings. Only a valid draft can become a canonical document. The reviewed draft and canonical document are persisted to the authenticated user's profile and private onboarding row. `/preview` consumes the same renderer as registered profiles and is owner-only. New profiles remain unpublished by default and AI-disabled.

## ProfileDocument

`ProfileDocument` separates immutable internal identity (`profileId`) from mutable public routing identity (`slug`) and includes a version, nested identity and SEO data, stable-ID content collections, suggested questions, an avatar union, minimal presentation configuration, and explicit AI availability.

Profile-derived content is rendered with DOM construction and `textContent`; the shared renderer does not interpolate profile fields through `innerHTML`. Optional project links and images accept only HTTP(S) URLs. Small presentation hints hold owner-specific section copy, explicit highlight anchors, and featured experience/education intent without turning the document into a page-builder schema.

Profiles live under `src/profile/profiles/` and are registered in `src/profile/registry.ts`. The resolver depends only on the registry lookup shape so a future persistent repository can replace it without changing the renderer's document contract.

## Boundaries

- **Profile:** a tenant-neutral `ProfileDocument` containing structured professional content and presentation metadata. Seed and fixture data are not product defaults.
- **Renderer:** safely turns a resolved profile into the current portfolio UI. It consumes explicit featured records and presentation hints, and must not own authentication or persistence.
- **Avatar:** owns original photos, generated assets, job lifecycle, gallery, and explicit activation. Pointer-direction behavior remains in the renderer and does not own persistence.
- **RAG:** chunking, indexing, retrieval, and grounded answering. It must remain independent from portfolio rendering.
- **Onboarding:** PDF/DOCX extraction, authenticated server-isolated LLM mapping with deterministic fallback, persisted draft review, classified validation, and owner-only preview. It updates the user's existing profile but does not own avatar state and cannot enable RAG.
- **API/deployment:** Vercel hosts the static build, job-creation endpoint, and Cron worker. Configuration is environment-driven. Generation remains inside getlookatme rather than depending on an external demo server.

## Migration principles

- Reuse proven UI and interaction code before redesigning.
- Keep infrastructure proportional to the current milestone.
- Do not migrate dead implementations.
- Prefer explicit interfaces that can later be backed by persistent services.
- Treat editable profile strings as untrusted before user editing is introduced.

## Future tenant-isolation requirements

Every published profile, asset, knowledge document, index, chat request, and usage record must carry an immutable profile/tenant identity. Profile resolution must be server-verified from the requested slug or host. Retrieval must never search a global unfiltered index, and browser-supplied tenant identifiers must not be trusted without resolution and authorization.

## Deliberately deferred after M2

Profile-aware RAG/pgvector, embeddings, document chunking, profile publishing controls, password reset, account deletion, asset garbage collection, generation queues, teams, roles, billing, analytics, custom domains, job matching, and network integrations remain outside this milestone.
