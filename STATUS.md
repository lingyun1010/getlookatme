# LookAtMe status

## Current milestone

M2.1 — onboarding photo + dynamic avatar integration — in progress / complete on this branch.

## Completed

- M0 architecture audit.
- M1.0 private SaaS repository bootstrap and reusable foundation migration.
- M1.1 tenant-neutral `ProfileDocument` and static multi-profile registry.
- M1.2 safe DOM construction for all profile-derived lists, project links, and project images.
- Owner-specific services/contact copy moved into each profile document.
- Owner-specific accessibility labels derived from profile identity.
- Explicit highlight anchors and featured experience/education records replace ID and array-position assumptions.
- Lingyun retains the existing directional avatar and RAG behavior.
- Aaron retains the initials avatar fallback and disabled AI state.
- PDF, DOCX, and pasted-text onboarding through `/create`.
- Explicit extraction, parsed resume, draft, validation, and canonical document stages.
- Editable review of identity, summary, links, skills, experience, education, projects, and neutral presentation copy.
- Session-only `/preview` rendered by the shared renderer with initials fallback and AI disabled.
- Deterministic local mapping behind a replaceable `ResumeMappingService`; no live model dependency.
- OpenAI Responses API mapper behind a dedicated server endpoint and replaceable provider interface.
- Strict structured-output schema plus independent server and client runtime validation.
- Explicit mapper provenance, inferred-field warnings, and low-confidence warnings outside `ProfileDocument`.
- Deterministic fallback for disabled, unconfigured, unavailable, timed-out, malformed, or invalid LLM mapping.
- Input sanitization, a 40,000-character mapping limit, and metadata-only failure logging.
- Development-only browser diagnostics for mapper selection, endpoint/status, validation, fallback reason, and final review mapper.
- Local CORS coverage for both `localhost` and `127.0.0.1` Vite origins.
- Browser mapper fetch is bound to the global receiver, and the configurable client timeout defaults to 60 seconds to avoid premature fallback during structured extraction.
- Onboarding now supports CV + portrait upload with `Use original photo` and `Generate dynamic avatar` choices.
- Dynamic avatar generation uses the external `lookatme-avatar` SDK via the getlookatme-owned server route and `smooth` preset.
- The preview uses pointer-following `LookAtMeAvatar` motion for generated avatars while the original-photo preview remains a square image crop.
- The avatar CTA keeps a stable label regardless of whether a frame set was already generated.
- Portfolio hero renders static or dynamic avatar state directly in the same hero slot.
- Generated frame sets are kept in temporary local storage behind the SDK abstraction and clearly marked as dev-only.
- Targeted tests cover avatar mode selection, original-photo state, dynamic-avatar state, and malformed frame-set guardrails.

## Current supported profiles

- Lingyun — complete seed profile, directional avatar, current single-profile RAG.
- Aaron — fictional fixture, initials avatar fallback, AI disabled.

## Known limitations

- Static profile registry.
- RAG remains Lingyun-only and the server endpoint is not profile-aware.
- No persistence, authentication, permanent publishing, or stored user-generated profiles.
- `index.html` remains the active renderer.
- Avatar pointer origin remains based on the viewport center.
- Service/project numbering and project stack order intentionally follow collection order as generic layout behavior.
- LLM mapping requires `OPENAI_API_KEY`; without it, onboarding remains available through deterministic fallback.
- The deterministic fallback remains intentionally conservative and may miss complex or two-column resume sections.
- A complete visual regression pass remains manual because browser automation is unavailable in this environment.

## Deferred

Database-backed profiles, authentication, accounts, permanent profile URLs, profile-aware RAG, production user image storage, analytics, billing, custom domains, employer profiles, job matching, SEEK/LinkedIn integrations, and network features.

## Remaining production work

- Replace the development-only avatar storage with production cloud or object storage.
- Add a production-safe upload/asset lifecycle and cleanup strategy for generated frame sets.
- Add real persisted profile storage and user account ownership for generated avatars.
- Consider a background queue if generation becomes asynchronous or requires rate-limit controls.
- Add full end-to-end tests for the server route and hero rendering in a browser environment.

## Next exact task

M2.2: design and implement profile-aware RAG isolation without allowing temporary or generated profiles to access Lingyun's knowledge index by default.
