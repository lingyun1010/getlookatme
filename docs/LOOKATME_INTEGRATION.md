# LookAtMe avatar integration

## Domain separation

Professional profile data and avatar presentation assets are independent product domains.

```text
Profile onboarding
PDF/DOCX
→ text extraction and structured mapping
→ profile review/edit
→ ProfileDocument save
→ preview
```

Profile creation never waits for avatar generation.

```text
Avatar workspace
original photo
→ explicit Generate click
→ queued job
→ background worker
→ lookatme-avatar/server
→ OpenAI image generation
→ Supabase Storage
→ avatars row
→ gallery
→ explicit activation
```

Uploading a photo does not start generation. One Generate click creates a real queued request; the worker processes it automatically when capacity is available. A completed avatar never becomes active automatically.

## Persistent model

`avatar_generation_jobs` owns the generation lifecycle:

- `queued`: accepted and waiting for worker capacity.
- `generating`: atomically claimed by a worker.
- `ready`: frames and the resulting avatar asset were persisted.
- `failed`: generation ended with a safe user-facing diagnostic and can be retried.
- `cancelled`: the owner cancelled the job before worker claim.

A partial unique index allows at most one `queued` or `generating` job per profile. Cancellation is an atomic owner-scoped `queued → cancelled` transition. The worker claim is an atomic `queued → generating` transition. Whichever transition obtains the row first wins; generating jobs cannot be cancelled or interrupted.

`avatars` stores generated presentation assets and retains history. Each asset records its owner/profile, generation job, source-photo path, style, preset, preview and frame paths, frame metadata, and creation time. Activating one asset does not delete prior assets.

`profiles.active_avatar_id` identifies the selected generated avatar. A null value falls back to the original photo and then initials. The composite ownership relationship prevents attaching another user’s asset.

## Server and worker boundary

The browser creates jobs through `POST /api/avatar-jobs` and polls persistent job state. It never calls OpenAI, invokes the worker, or holds the generation HTTP request open.

Both worker entry points reuse `processNextAvatarJob()`:

- Local development: `pnpm dev:avatar-worker` runs a serial polling loop independently of the browser and API server.
- Production: Vercel Cron calls the protected `/api/avatar-worker` endpoint.

The worker atomically claims one eligible job using `FOR UPDATE SKIP LOCKED`, marks it generating, downloads the private source photo, and runs `PhotoAIFrameProducer` with `OpenAIImageGenerationProvider` from `lookatme-avatar/server`. It uploads deterministic job-keyed frames to Supabase Storage, idempotently upserts one asset per generation job, then marks the job ready. Interrupted stale jobs are reclaimable; failures become retryable without changing the active avatar.

## Storage and URL strategy

- Original photos live in the private `profile-private-assets` bucket and are stored as paths. Fresh signed URLs are created when read and reused by the Avatar page while the path remains unchanged.
- Generated frames live in the public `profile-public-assets` bucket under owner/profile/job-scoped paths.
- Database records persist paths, asset IDs, and frame metadata—not temporary signed URLs.
- The renderer adapter converts the active asset into the existing runtime `AvatarFrameSet` contract.

Legacy `ProfileDocument.avatarFrameSet` data remains only as a compatibility fallback for existing profiles. New generation lifecycle and asset history belong to `avatar_generation_jobs` and `avatars`, not onboarding state.

## Avatar workspace behavior

`/dashboard/avatar` provides:

- Original-photo upload/change and preview.
- Explicit original-photo activation.
- Style and preset selection.
- Non-blocking queued generation.
- Queued-only cancellation and failed-job retry.
- Stable polling of job status.
- Generated avatar gallery/history.
- Preview, explicit activation, and safe deletion of inactive assets.

Polling reloads only job state. It refreshes assets and rebuilds the gallery only when a job transitions to ready. Unchanged status polling does not regenerate the original-photo signed URL or recreate the active mouse-follow avatar.

## Local development

Run the UI, API, and worker independently:

```bash
pnpm dev
pnpm dev:api
pnpm dev:avatar-worker
```

The worker requires server-only `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENAI_API_KEY`. `CRON_SECRET` protects the HTTP worker endpoint used by production Cron. No server secret uses a `VITE_` prefix.

## Validation status

The linked Supabase project has migrations `202609190001_avatar_assets_jobs` and `202609190002_avatar_queue_controls` applied. Manual validation covers automatic queued consumption, cancellation races, duplicate active-job protection, retry, Storage upload, ready gallery insertion, stable polling, non-activation on completion, and explicit activation.
