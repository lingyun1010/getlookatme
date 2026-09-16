# LookAtMe architecture

## Current architecture

LookAtMe is currently a Vite-built static portfolio plus one Vercel serverless chat function. `index.html` remains the active UI surface to preserve the reference implementation's design and interactions. The old React implementation was not migrated.

Vercel redirects `/` to `/lingyun` and rewrites single-segment profile paths to the application shell. A static registry resolves `/lingyun` and the fixture `/aaron` to separate `ProfileDocument` instances. Unknown slugs render an explicit not-found state.

The chat endpoint uses a committed, Lingyun-only RAG index. Retrieval uses OpenAI embeddings, in-memory cosine similarity, deterministic intent reranking, and a grounded structured answer. Aaron's document disables AI, and the shared renderer never calls the endpoint for that profile.

## ProfileDocument

`ProfileDocument` separates immutable internal identity (`profileId`) from mutable public routing identity (`slug`) and includes a version, nested identity and SEO data, stable-ID content collections, suggested questions, an avatar union, minimal presentation configuration, and explicit AI availability.

Profiles live under `src/profile/profiles/` and are registered in `src/profile/registry.ts`. The resolver depends only on the registry lookup shape so a future persistent repository can replace it without changing the renderer's document contract.

## Boundaries

- **Profile:** a tenant-neutral `ProfileDocument` containing structured professional content and presentation metadata. Seed and fixture data are not product defaults.
- **Renderer:** turns a resolved profile into the current portfolio UI. It must not own authentication or persistence.
- **Avatar:** a profile selects either directional frames or a placeholder. Pointer-direction behavior remains in the renderer for now and must not own chat or profile storage.
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
