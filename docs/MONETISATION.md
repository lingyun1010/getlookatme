# Monetisation foundation

Every Auth user has one private `subscriptions` row. New and backfilled users start with `plan = free`, `status = free`, and `provider = mock`. Elevated entitlements apply only while a Pro or Founding row is `active` or `trialing`; cancelled and past-due rows fall back to Free behavior.

`src/monetisation/entitlements.ts` is the product decision boundary. UI and server routes ask it about feature availability and monthly limits rather than branching directly on plan names. `src/monetisation/plans.ts` owns display names, CTA copy, benefits, and the launch-adjustable price placeholder. Publishing is enabled for every plan.

Server boundaries write `cv_parse`, `avatar_generation`, `rag_query`, and `embedding` rows to `usage_events`. Users can read only their own usage, and browsers cannot insert it. Avatar and RAG checks compare current-month totals with the central entitlement limits.

## Mock billing

Set `MOCK_BILLING_ENABLED=true` only in local or non-production development. The API refuses mock billing whenever `VERCEL_ENV` or `NODE_ENV` is production, even if the flag is present. The dashboard mock checkout can activate, cancel, and reactivate the authenticated user's own Pro subscription without collecting payment details.

Future Stripe work should implement the `BillingProvider` interface, keep Stripe session and webhook handling inside the billing boundary, and update the same subscription fields. Entitlements, usage enforcement, and product UI should not need Stripe-specific branches.

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
