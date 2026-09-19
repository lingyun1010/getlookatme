# LookAtMe status

## Current milestone

PR4 — persistent, profile-scoped knowledge base — implemented. Persistent RAG answer generation and chat integration remain deferred to PR5.

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

Manual validation has confirmed queued/generating/ready, queued cancellation, failed retry, duplicate active-job protection, automatic local worker consumption, Supabase frame upload, stable polling, gallery updates, non-activation on completion, and explicit activation.

## Current supported profiles

- Lingyun — complete seed profile, directional avatar, current single-profile RAG.
- Aaron — fictional fixture, initials avatar fallback, AI disabled.
- Authenticated user profiles — persistent structured profile data, original photo, generated avatar history, and explicit active-avatar selection.

## Known limitations

- RAG remains Lingyun-only and is not yet profile-scoped.
- No end-user publishing control exists; new profiles remain private by default.
- Deployed Vercel Cron authentication and the configured long-running function limit still require production-environment verification.
- Cron throughput is intentionally MVP-scale and processes one claimed job per invocation.
- Replaced CV/photo assets and failed Storage cleanup can leave orphaned files; a production garbage-collection lifecycle is not implemented.
- `index.html` remains the active public renderer, and avatar pointer origin remains viewport-centred.
- LLM mapping requires `OPENAI_API_KEY`; deterministic fallback remains conservative for complex or two-column resumes.
- The intermittent CV workspace null-element lifecycle issue is unresolved and tracked separately from Avatar queue behavior.

## Deferred

Profile-scoped RAG/pgvector, publishing UI, password recovery, account deletion, full orphaned-file cleanup, analytics, billing, custom domains, employer profiles, job matching, SEEK/LinkedIn integrations, and network features.

## Remaining production work

- Verify Vercel Cron invocation, `CRON_SECRET`, paid generation duration, and the configured serverless runtime limit in the deployed environment.
- Configure deployment secrets without exposing service-role or Cron credentials through `VITE_*` variables.
- Add production-safe cleanup for replaced CV, photo, and generated-frame assets.
- Add browser-level end-to-end coverage for profile rendering and the complete deployed worker lifecycle.
- Move to a dedicated queue only if Cron throughput or generation concurrency outgrows the current worker.

## Next exact task

PR5: replace the legacy Lingyun-only retrieval path with authenticated/published-profile resolution, query embedding, persistent profile-scoped retrieval, and grounded answer generation without a global fallback.
