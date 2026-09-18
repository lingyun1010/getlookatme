# LookAtMe architecture

## Current architecture

LookAtMe is currently a Vite-built static portfolio plus one Vercel serverless chat function. `index.html` remains the active UI surface to preserve the reference implementation's design and interactions. The old React implementation was not migrated.

## LookAtMe avatar integration architecture

The avatar feature is integrated directly into the existing onboarding and portfolio flow without creating a standalone demo page or a separate LookAtMe service. The onboarding form keeps the existing resume/CV pipeline and adds a portrait upload with two product states:

- `avatarMode: "original"` for a static uploaded photo
- `avatarMode: "dynamic"` for a generated avatar using the external `lookatme-avatar` SDK

The semantic profile state sits alongside the existing canonical `ProfileDocument` contract rather than replacing it. The app stores optional fields like `avatarMode`, `avatarPreset`, `avatarImageUrl`, and `avatarFrameSet` and preserves the existing rendering contract with a compatibility mapping layer.

The dynamic generation path is intentionally narrow and server-owned. Browser code only uploads the portrait and requests generation; the backend route runs the server-side SDK and uses the app-owned `OPENAI_API_KEY`:

```text
uploaded portrait
  ↓
GET/POST API route in getlookatme
  ↓
PhotoAIFrameProducer
  ↓
OpenAIImageGenerationProvider
  ↓
smooth preset
  ↓
AvatarFrameSet
  ↓
profile state + hero rendering
```

The local API route sits behind the current SDK abstraction and uses temporary local storage for generated frame sets, clearly marked as development-only. The generated frames are rendered into the same hero avatar position with `LookAtMeAvatar` from `lookatme-avatar/react`, while the original-photo path keeps the normal static image behavior.

Vercel redirects `/` to `/lingyun` and rewrites single-segment profile paths to the application shell. A static registry resolves `/lingyun` and the fixture `/aaron` to separate `ProfileDocument` instances. Unknown slugs render an explicit not-found state.

The chat endpoint uses a committed, Lingyun-only RAG index. Retrieval uses OpenAI embeddings, in-memory cosine similarity, deterministic intent reranking, and a grounded structured answer. Aaron's document disables AI, and the shared renderer never calls the endpoint for that profile.

M2.0 adds an onboarding surface at `/create`. PDF files are semantically extracted with `pdfjs-dist`, DOCX files with Mammoth's raw-text API, and pasted text enters the same pipeline after normalization. M2.0.1 keeps extraction browser-side and adds a secure server-side semantic mapper. The effective boundary is:

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

Validation returns classified blocking errors, non-blocking missing information, and mapping warnings. Only a valid draft can become a canonical document. The result is serialized to `sessionStorage`, resolved only at `/preview`, and consumed by the same renderer as registered profiles. It is not registered, persisted, published, or assigned a permanent slug. Temporary documents always have AI disabled.

## ProfileDocument

`ProfileDocument` separates immutable internal identity (`profileId`) from mutable public routing identity (`slug`) and includes a version, nested identity and SEO data, stable-ID content collections, suggested questions, an avatar union, minimal presentation configuration, and explicit AI availability.

Profile-derived content is rendered with DOM construction and `textContent`; the shared renderer does not interpolate profile fields through `innerHTML`. Optional project links and images accept only HTTP(S) URLs. Small presentation hints hold owner-specific section copy, explicit highlight anchors, and featured experience/education intent without turning the document into a page-builder schema.

Profiles live under `src/profile/profiles/` and are registered in `src/profile/registry.ts`. The resolver depends only on the registry lookup shape so a future persistent repository can replace it without changing the renderer's document contract.

## Boundaries

- **Profile:** a tenant-neutral `ProfileDocument` containing structured professional content and presentation metadata. Seed and fixture data are not product defaults.
- **Renderer:** safely turns a resolved profile into the current portfolio UI. It consumes explicit featured records and presentation hints, and must not own authentication or persistence.
- **Avatar:** a profile selects either directional frames, a placeholder, or an original/dynamic avatar state. Pointer-direction behavior remains in the renderer for now and must not own chat or profile storage. Dynamic avatars are generated through the external SDK, rendered in the same hero slot, and previewed with mouse-following interaction rather than autoplaying frame swaps. Original-photo mode remains a square static crop in the onboarding preview.
- **RAG:** chunking, indexing, retrieval, and grounded answering. It must remain independent from portfolio rendering.
- **Onboarding:** local extraction, server-isolated LLM mapping with deterministic fallback, draft review, classified validation, and session-only preview. It cannot register a profile or enable RAG. The onboarding flow also captures the portrait photo and avatar mode selections for the portfolio hero.
- **API/deployment:** Vercel hosts the static build and serverless endpoints. Configuration is environment-driven. The LookAtMe generation route remains inside getlookatme rather than depending on an external demo server.

## Migration principles

- Reuse proven UI and interaction code before redesigning.
- Keep infrastructure proportional to the current milestone.
- Do not migrate dead implementations.
- Prefer explicit interfaces that can later be backed by persistent services.
- Treat editable profile strings as untrusted before user editing is introduced.

## Future tenant-isolation requirements

Every published profile, asset, knowledge document, index, chat request, and usage record must carry an immutable profile/tenant identity. Profile resolution must be server-verified from the requested slug or host. Retrieval must never search a global unfiltered index, and browser-supplied tenant identifiers must not be trusted without resolution and authorization.

## Deliberately deferred after M2.0

Authentication, user accounts, database persistence, permanent profile URLs, profile-aware RAG, avatar generation, user image storage, job matching, SEEK/LinkedIn integrations, and billing remain outside this architecture.
