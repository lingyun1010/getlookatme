# LookAtMe status

## Current milestone

M1.0 — bootstrap the private Vercel SaaS repository and migrate only the reusable foundation.

## Completed

- M0 architecture audit.
- Clean private repository foundation.
- Active portfolio UI and generic effects migrated without the obsolete React implementation.
- Temporary Lingyun seed profile and runtime avatar assets isolated under profile-specific paths.
- Single-profile RAG core, API, scripts, generated index, and tests migrated.
- Vercel `/` redirect and slug rewrite foundation added.
- GitHub Pages-specific deployment assumptions removed.

## Known issues

- The active renderer remains concentrated in `index.html`.
- Profile-derived markup still uses trusted `innerHTML`; it is not ready for untrusted editor input.
- RAG prompt/index/API remain Lingyun-specific and single-profile.
- Only `/lingyun` resolves to a published profile.
- Avatar pointer origin is still based on the viewport center.

## Deferred

Authentication, persistence, uploads, editor, multi-tenant RAG, analytics, billing, custom domains, employer profiles, matching, and network features.

## Next exact task

M1.1: define the complete `ProfileDocument` contract and extract profile rendering/configuration from `index.html` without changing the visual design.
