# LookAtMe status

## Current milestone

PR5.2 — optional profile AI knowledge lifecycle — implemented and locally verified. Profile publication remains independent, while owner-controlled AI enablement now manages initial and incremental knowledge indexing automatically.

## Completed

- M0 architecture audit.
- M1 SaaS repository bootstrap, tenant-neutral `ProfileDocument`, static multi-profile registry, safe profile-driven renderer, and routing foundation.
- PDF/DOCX profile onboarding through `/dashboard/create`; pasted text remains an internal parser utility only.
- Structured extraction, editable review, validation, canonical `ProfileDocument` persistence, and owner-only `/preview`.
- Server-side structured-output resume mapping with deterministic fallback and mapper provenance.
- Supabase email/password authentication, persistent sessions, initial profile creation, ownership constraints, and RLS.
- Owner-scoped private CV/original-photo storage and public generated-frame storage.
- Applied Supabase migrations for profile ownership, `avatars`, `avatar_generation_jobs`, `profiles.active_avatar_id`, and avatar queue controls.
- Standalone `/dashboard/avatar` workspace for original-photo management, style/preset selection, generation status, gallery/history, preview, deletion of inactive assets, and explicit activation.
- Persistent avatar assets containing storage paths and frame metadata rather than expiring signed URLs.
- Persistent job lifecycle: `queued → generating → ready/failed`, `failed → retry`, and `queued → cancelled`.
- Atomic worker claims, stale-job recovery, idempotent asset upsert, and one active `queued`/`generating` job per profile.
- Owner-scoped queued cancellation; generating jobs intentionally cannot be cancelled.
- Local `pnpm dev:avatar-worker` automatic consumption, independent of browser navigation.
- Production Vercel Cron worker endpoint retained for deployed background execution.
- Stable polling that updates job status without rebuilding the original photo, active mouse-follow avatar, or unchanged gallery.
- Original-photo signed URL reuse while its storage path is unchanged.
- Preview fallback: active generated avatar → original photo → initials.
- Ready avatars do not auto-activate; “Use this avatar” explicitly updates the selected profile avatar.
- Lingyun retains the existing directional avatar and RAG behavior; Aaron retains the initials fallback and disabled AI state.
- Structured `ProfileDocument` knowledge builder, deterministic entity-aware chunking, canonical hashes, and incremental sync planning.
- Supabase `knowledge_sources` and `knowledge_chunks` with 1536-dimensional pgvector embeddings, exact cosine search, owner RLS, and cross-profile foreign-key enforcement. ANN indexing is intentionally deferred until multi-tenant retrieval can be measured and tuned.
- Mandatory-profile `search_profile_knowledge` retrieval RPC and local sync/inspect commands.
- PR5 profile-aware answer API with trusted slug resolution, owner/public authorization, profile-scoped pgvector retrieval, grounded generation, stable no-answer behavior, and structured evidence metadata.
- Anonymous published-profile chat and authenticated owner draft chat; invalid bearer tokens are rejected rather than silently downgraded.
- Persisted owner and published profile loaders enable chat while genuine session-only temporary previews remain AI-disabled.
- PR5.1 owner-controlled slug availability, normalization, reserved-route protection, atomic row/document slug updates, publish, unpublish, and immediate dashboard state updates.
- Publication remains independent from AI, embeddings, knowledge sync, subscriptions, and chat availability.
- Profile action cleanup: published profiles expose “View Published Profile”, drafts show “Unpublished”, the title action is “Working Preview”, and the form action is “Publish Profile” or “Save Changes”.
- Server-authoritative AI lifecycle on `profiles`: `off → indexing → ready`, `ready → stale → indexing → ready`, and recoverable `failed → indexing` transitions.
- Owner-only enable, disable, retry, and refresh API; the server resolves the authenticated owner's profile and never accepts a client profile UUID as indexing authority.
- AI is off by default. Saving, previewing, publishing, changing publication, or making visual-only edits does not create embeddings when AI is disabled.
- Once enabled, profile saves run the PR4 deterministic incremental sync after the primary save; unchanged sources reuse existing chunks, changed/new sources re-embed, and removed sources are deleted.
- Indexing failure preserves the saved profile, records a safe failed state, and permits retry. Disabling AI retains knowledge rows dormant for inexpensive re-enable and does not change publication.
- Chat now requires authoritative `ai_status = ready` in addition to the existing PR5 access rules; off, indexing, stale, and failed profiles cannot reach embedding or retrieval work.

Manual validation has confirmed queued/generating/ready, queued cancellation, failed retry, duplicate active-job protection, automatic local worker consumption, Supabase frame upload, stable polling, gallery updates, non-activation on completion, and explicit activation.

## Current supported profiles

- Lingyun — complete seed profile and directional avatar; static legacy RAG tooling remains for regression only.
- Aaron — fictional fixture, initials avatar fallback, AI disabled.
- Authenticated user profiles — persistent structured data, owner preview, editable unique slug, publish/unpublish lifecycle, profile-scoped RAG, original photo, generated avatar history, and explicit active-avatar selection.

## Known limitations

- Indexing is synchronous in the current request lifecycle; large profiles may eventually require a bounded background job design.
- Legacy Lingyun JSON-index RAG files and scripts remain for regression tooling but are unreachable from the active `/api/chat` path.
- Slug history, old-slug redirects, and custom domains are not implemented.
- Deployed Vercel Cron authentication and the configured long-running function limit still require production-environment verification.
- Cron throughput is intentionally MVP-scale and processes one claimed job per invocation.
- Replaced CV/photo assets and failed Storage cleanup can leave orphaned files; a production garbage-collection lifecycle is not implemented.
- `index.html` remains the active public renderer, and avatar pointer origin remains viewport-centred.
- LLM mapping requires `OPENAI_API_KEY`; deterministic fallback remains conservative for complex or two-column resumes.
- The intermittent CV workspace null-element lifecycle issue is unresolved and tracked separately from Avatar queue behavior.

## Deferred

AI subscription/entitlement controls, password recovery, account deletion, full orphaned-file cleanup, analytics, billing, custom domains, slug redirects/history, employer profiles, job matching, SEEK/LinkedIn integrations, and network features.

## Remaining production work

- Verify Vercel Cron invocation, `CRON_SECRET`, paid generation duration, and the configured serverless runtime limit in the deployed environment.
- Configure deployment secrets without exposing service-role or Cron credentials through `VITE_*` variables.
- Add production-safe cleanup for replaced CV, photo, and generated-frame assets.
- Add browser-level end-to-end coverage for profile rendering and the complete deployed worker lifecycle.
- Move to a dedicated queue only if Cron throughput or generation concurrency outgrows the current worker.

## Next exact task

Manually verify the PR5.2 owner lifecycle in the browser and deployed environment, including enable, incremental refresh, failure/retry, disable, and public/owner chat availability.
