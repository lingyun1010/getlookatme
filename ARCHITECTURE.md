# LookAtMe architecture

## Current architecture

LookAtMe is currently a Vite-built static portfolio plus one Vercel serverless chat function. `index.html` remains the active UI surface to preserve the reference implementation's design and interactions. Lingyun is a temporary seed profile under `src/profile/lingyun.ts`; the old React implementation was not migrated.

Vercel redirects `/` to `/lingyun` and rewrites single-segment profile paths to the application shell. The small resolver currently recognizes only `lingyun`.

The chat endpoint uses a committed, single-profile RAG index. Retrieval uses OpenAI embeddings, in-memory cosine similarity, deterministic intent reranking, and a grounded structured answer.

## Boundaries

- **Profile:** structured professional content and presentation metadata. Seed data must not become a product default.
- **Renderer:** turns a resolved profile into the current portfolio UI. It must not own authentication or persistence.
- **Avatar:** profile-specific frame manifest/assets plus reusable pointer-direction behavior. It must not own chat or profile storage.
- **RAG:** chunking, indexing, retrieval, and grounded answering. It must remain independent from portfolio rendering.
- **API/deployment:** Vercel hosts the static build and serverless endpoints. Configuration is environment-driven.

## Migration principles

- Reuse proven UI and interaction code before redesigning.
- Keep infrastructure proportional to the current milestone.
- Do not migrate dead implementations.
- Prefer explicit interfaces that can later be backed by persistent services.
- Treat editable profile strings as untrusted before user editing is introduced.

## Future tenant-isolation requirements

Every published profile, asset, knowledge document, index, chat request, and usage record must carry an immutable profile/tenant identity. Profile resolution must be server-verified from the requested slug or host. Retrieval must never search a global unfiltered index, and browser-supplied tenant identifiers must not be trusted without resolution and authorization.
