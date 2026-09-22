# Production Beta configuration

Use this checklist before production smoke testing. Deployment values belong in the hosting platform, not committed env files. `.env.production.example` is the variable contract.

## Runtime contract

- Set `APP_ENV=production` and `MOCK_BILLING_ENABLED=false`.
- Set browser-safe `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the production Supabase project.
- Set server-only `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Never give the service-role/secret key a `VITE_*` prefix.
- Set server-only `OPENAI_API_KEY`, model variables, and `CRON_SECRET`.
- Leave `VITE_API_BASE_URL` empty for the same-origin Vercel deployment. If the API is intentionally split, use its HTTPS production origin and add the exact frontend origin to `ALLOWED_ORIGINS`. Reject localhost or private-network values in production configuration review.
- Confirm the deployment exposes `/api/onboarding/map-resume`, `/api/avatar-jobs`, `/api/avatar-worker`, `/api/profile-ai`, `/api/profile-publication`, `/api/chat`, `/api/analytics`, and `/api/billing` from the same shared handlers used locally where applicable.

Mock billing is development-only. The runtime guard requires the resolved runtime (`VERCEL_ENV`, then `APP_ENV`, then `NODE_ENV`) to equal `development` as well as `MOCK_BILLING_ENABLED=true`; a production runtime cannot enable it through the flag alone.

## Supabase and migrations

Before any smoke test:

1. Link the Supabase CLI to the intended production project and confirm the project reference.
2. Compare local migration files with production migration history using the repository's installed Supabase CLI (`pnpm exec supabase migration list`).
3. Apply every pending migration through the established release workflow (`pnpm exec supabase db push`) and review the reported target before confirming.
4. Run the migration list again and require local/remote history to match. Do not smoke test against a partially migrated database.
5. Confirm Auth creates the initial profile, onboarding state, Free subscription, and signup funnel event for a new test user.

M3.1 adds `beta_public_profile_column_boundary`, which keeps published-row access while removing anonymous access to owner-only profile columns. It must be present before the smoke test.

## Storage boundary

- `profile-private-assets` must remain private. It contains CV files and original photos; only the authenticated owner receives signed preview URLs.
- `profile-public-assets` is intentionally public and contains generated Avatar frames required by published profiles.
- Confirm Storage policies require the `<user_id>/<profile_id>/...` path and profile ownership for writes.
- Confirm a published profile with no active generated Avatar falls back to initials and never returns a signed original-photo URL.

## Production route and service checks

- `/` serves the landing page; `/dashboard/*` requires authentication; `/:slug` and `/:slug/chat` resolve only the requested published profile for anonymous visitors.
- Confirm the Avatar cron sends `Authorization: Bearer <CRON_SECRET>` and the worker can download private sources and write public generated frames.
- Confirm RAG/OpenAI server variables are present and a published, AI-ready profile can answer a question.
- Confirm owner-changing endpoints verify the bearer token and derive `user.id` with Supabase Auth before selecting or mutating owner data.
- Confirm anonymous public-profile responses contain the published profile document only, without onboarding state, CV paths, original-photo paths, account email, or subscription data.
