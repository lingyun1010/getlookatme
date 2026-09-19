# Persistent profile knowledge (PR4)

PR4 adds the database and service foundation for profile-scoped retrieval. It does not connect persistent retrieval to answer generation or chat UI.

```text
ProfileDocument
      ↓
Knowledge Builder
      ↓
knowledge_sources
      ↓
Deterministic Chunker
      ↓
knowledge_chunks
      ↓
Embedding Client
      ↓
Supabase / pgvector
      ↓
profile-scoped retrieval
```

## Canonical data and sources

`profiles.document` remains the canonical `ProfileDocument`. The builder creates semantic natural-language sources for the profile summary, each experience, project, skill group, education entry, service, and highlight. Stable collection IDs become `source_ref`; the singleton profile source uses `profile`. Project links, technology lists, dates, categories, and section/evidence references are retained in structured metadata. The database accepts future source types such as `publication`, `manual`, `github`, `portfolio`, `linkedin`, and `certification` without a schema change.

`knowledge_sources` stores the source identity, title, SHA-256 content hash, lifecycle status, and version. `(profile_id, source_type, source_ref)` is unique. `knowledge_chunks` stores `profile_id` directly as well as a composite `(profile_id, source_id)` foreign key, semantic section, evidence metadata, content hash, embedding version, and a 1536-dimensional vector. Source deletion cascades to its chunks.

## Chunking and hashing

Small professional entities remain one chunk. Content longer than 1,800 characters is split deterministically at a newline or word boundary with up to 200 characters of overlap. This strategy is independent of the embedding provider and can be unit tested.

Hashes use canonical JSON: object keys are sorted, undefined values are omitted, line endings are normalized, and strings are trimmed. A source hash covers semantic content, title, and evidence metadata. A chunk hash covers content, metadata, and its stable index.

## Embeddings and incremental sync

The default model is `text-embedding-3-small` at 1536 dimensions. Configuration is centralized in `src/knowledge/config.ts`. Stored `embedding_version` combines the model, dimension, and indexing strategy version.

`syncProfileKnowledge(profileId, repository, embeddings)` loads the structured profile, builds sources, and compares them with stored state:

- New source: generate its chunks and embeddings, then insert it.
- Changed source: generate and replace only that source's chunks.
- Unchanged source with the current embedding version: make no embedding request.
- Deleted source: delete the source; database cascade removes its chunks.
- Embedding/indexing version change: treat the source as changed and re-embed it.

The embedding client batches requests and is injected into the sync service, so unit tests use deterministic fakes and never call OpenAI.

## Isolation and retrieval

RLS is enabled on both tables. Only authenticated owners of the referenced `profiles` row can select, insert, update, or delete knowledge. Anonymous callers have no table or function grant. The chunk table's explicit `profile_id` lets vector search filter by tenant before ranking. The `search_profile_knowledge` security-invoker RPC requires `requested_profile_id`; it has no unscoped overload and orders with cosine distance (`<=>`).

PR4 intentionally uses exact pgvector search with no ANN vector index. Current per-profile knowledge bases are small, so predictable profile-scoped correctness is preferred over approximate-search tuning. HNSW can be introduced later only after measuring realistic multi-tenant data volumes and tuning filtered retrieval recall and latency.

Public published-profile chat remains possible in PR5, but it must use a separately reviewed server boundary that resolves the published slug to a trusted profile ID. PR4 deliberately does not weaken private RLS or expose public knowledge.

## Status and local tools

The repository reports source count, chunk count, failed-source count, and the last chunk update. The CLI prints these without printing private source content:

```bash
pnpm knowledge:sync <profile-id>
pnpm knowledge:inspect <profile-id>
```

Both commands load `.env` followed by `.env.local` and require `SUPABASE_URL` plus server-only `SUPABASE_SERVICE_ROLE_KEY`. For local Supabase, map the `pnpm exec supabase status` **Secret key** to that established variable name. Sync also requires server-only `OPENAI_API_KEY`; inspect does not. `OPENAI_EMBEDDING_MODEL` defaults to `text-embedding-3-small`. These credentials are never exposed through `VITE_*`.

## Testing

```bash
pnpm exec supabase start
pnpm typecheck
pnpm test
pnpm build
pnpm exec supabase db reset
pnpm exec supabase test db
```

Local credentials come from `pnpm exec supabase status`: its Publishable key is browser-safe, while its Secret key is server/tooling-only. Database tests currently pass and cover profile, avatar, and knowledge ownership policies plus cross-profile search isolation for Lingyun and Aaron. Unit tests cover source construction, project evidence, canonical hashing, chunking, sync planning, embedding-version invalidation, and incremental sync.

Production knowledge sync must use production Supabase and OpenAI credentials supplied by the deployment platform. Never copy local Supabase credentials into production configuration.

## Known limitations and PR5 handoff

PR4 has no scheduler or profile-save hook; sync is currently invoked explicitly. The existing committed Lingyun-only RAG index and `/api/chat` are legacy paths and are not changed by PR4. PR5 should authenticate or resolve a published profile, embed the query, call only `search_profile_knowledge` with the trusted profile ID, apply grounded answer generation, and add profile-aware API tests. It must never fall back to the legacy global index.
