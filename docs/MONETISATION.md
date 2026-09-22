# Monetisation foundation

Every Auth user has one private `subscriptions` row. New and backfilled users start with `plan = free`, `status = free`, and `provider = mock`. Elevated entitlements apply only while a Pro or Founding row is `active` or `trialing`; cancelled and past-due rows fall back to Free behavior.

`src/monetisation/entitlements.ts` is the product decision boundary. UI and server routes ask it about feature availability and monthly limits rather than branching directly on plan names. `src/monetisation/plans.ts` owns display names, CTA copy, benefits, and the launch-adjustable price placeholder. Publishing is enabled for every plan.

Server boundaries write `cv_parse`, `avatar_generation`, `rag_query`, and `embedding` rows to `usage_events`. Users can read only their own usage, and browsers cannot insert it. Avatar and RAG checks compare current-month totals with the central entitlement limits.

Avatar usage is counted atomically when a new generation job is accepted; retrying that job does not add usage. RAG query and query-embedding usage is counted only after the request passes its limit check and reaches the RAG execution path. CV parsing is counted after successful server mapping. Knowledge indexing records the number of new embeddings produced by one sync, without recounting unchanged chunks.

## Mock billing

Set `APP_ENV=development` and `MOCK_BILLING_ENABLED=true` only for local development. The API enables mock billing only when the resolved runtime (`VERCEL_ENV`, then `APP_ENV`, then `NODE_ENV`) is exactly `development`; the flag cannot enable it in production. The dashboard mock checkout can activate, cancel, and reactivate the authenticated user's own Pro subscription without collecting payment details.

Locally, the browser sends authenticated `POST /api/billing` requests through Vite's API proxy. Actions are JSON body values: `start`, `complete`, `cancel`, and `reactivate`. The local API and deployed handler share the same request boundary and `MockBillingProvider`; neither accepts a browser-supplied user ID.

Future Stripe work should implement the `BillingProvider` interface, keep Stripe session and webhook handling inside the billing boundary, and update the same subscription fields. Entitlements, usage enforcement, and product UI should not need Stripe-specific branches.

## Beta funnel

`analytics_events` stores only the event name, owner/profile identifiers, timestamps, and optional small metadata. The shared analytics boundary records signup, CV upload/parse, Avatar completion, publication, public views, RAG questions, upgrade clicks, checkout starts, and subscription activation. Public views are resolved from a published slug on the server; CV content and chat text are never analytics metadata. Analytics failures are logged but do not fail the product action.

## Manual plan testing

Use the Supabase SQL editor or another trusted service-role context; subscription rows are intentionally not browser-writable.

```sql
-- Free
update public.subscriptions set plan = 'free', status = 'free', provider = 'mock'
where user_id = '<auth-user-uuid>';

-- Pro
update public.subscriptions set plan = 'pro', status = 'active', provider = 'mock'
where user_id = '<auth-user-uuid>';

-- Founding
update public.subscriptions set plan = 'founding', status = 'active', provider = 'mock'
where user_id = '<auth-user-uuid>';
```
