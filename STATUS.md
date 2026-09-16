# LookAtMe status

## Current milestone

M1.1 — ProfileDocument contract and static multi-profile registry — complete.

## Completed

- M0 architecture audit.
- M1.0 private SaaS repository bootstrap and reusable foundation migration.
- M1.1 tenant-neutral `ProfileDocument` with distinct `profileId`, slug, and version.
- Static registry and resolver shared by every profile route.
- Lingyun migrated without changing stable portfolio record IDs.
- Aaron fixture added to prove a second document renders through the same application.
- Directional and placeholder avatar modes.
- Explicit profile-level AI availability; Aaron cannot call the Lingyun-only chat flow.
- Profile-not-found, experience, education, and suggested-question rendering moved to safe DOM APIs.

## Current supported profiles

- Lingyun — complete seed profile, directional avatar, current single-profile RAG.
- Aaron — fictional fixture, initials avatar fallback, AI disabled.

## Known limitations

- Profiles are held in a static registry.
- RAG is available only for Lingyun and the server endpoint is not yet profile-aware.
- No persistence, authentication, editor, uploads, or user-created profiles.
- `index.html` remains the active renderer and contains presentation assumptions from the original demo.
- The shared `renderList` helper still inserts profile-derived HTML for highlights, focus-area marquee items, skills, services, and projects. These values remain trusted source fixtures; they are not safe for user-authored content yet.
- Global section copy such as the services introduction and contact heading is not in `ProfileDocument`.
- The renderer emphasizes the first experience record and first education record.
- Avatar pointer origin remains based on the viewport center.

## Deferred

Database-backed profiles, authentication, uploads, editor, multi-tenant RAG, analytics, billing, custom domains, employer profiles, matching, and network features.

## Next exact task

M1.2: remove remaining Lingyun-specific presentation assumptions and replace the shared profile-derived `innerHTML` list rendering with safe DOM construction while preserving the visual design.
