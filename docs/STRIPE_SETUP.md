# Stripe production setup

Internal runbook for enabling real Pro subscriptions on Get Look At Me. Stripe sits behind the existing `BillingProvider` boundary and writes only to the `subscriptions` table. Entitlements and usage enforcement continue to read internal plan state — never Stripe directly.

## Architecture reminder

```text
Stripe Checkout / Customer Portal / webhooks
→ subscriptions row (plan, status, provider ids)
→ effectivePlan / entitlements
→ Avatar + RAG usage enforcement
```

## Stripe Dashboard setup

1. Create (or open) the **Pro** product in Stripe.
2. Add a **recurring monthly** price for Pro. Do not hardcode the amount in application code — the app display price remains the SSOT in `src/monetisation/plans.ts` (`AUD $12 / month` today).
3. Copy the Price ID into `STRIPE_PRO_PRICE_ID`.
4. If the Stripe price amount/currency differs from `plans.ts`, treat that mismatch as a **launch blocker** and align them before going live. Do not silently change one side.
5. Open **Settings → Billing → Customer portal** and enable cancellation and payment-method updates as required.
6. Add a webhook endpoint pointing at:
   - Production: `https://<your-domain>/api/stripe/webhook`
   - Local (Stripe CLI): `stripe listen --forward-to localhost:3001/api/stripe/webhook` (or your `dev:api` port)
7. Subscribe the endpoint to at least:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
8. Copy the webhook **signing secret** into `STRIPE_WEBHOOK_SECRET`.

## Required environment variables

Server-only (never `VITE_*`):

| Variable | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe secret API key |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret |
| `STRIPE_PRO_PRICE_ID` | Recurring Pro price ID |
| `APP_BASE_URL` | Public app origin used to derive success/cancel URLs when explicit URLs are omitted |
| `STRIPE_SUCCESS_URL` | Optional override (default `{APP_BASE_URL}/dashboard/pricing?checkout=success`) |
| `STRIPE_CANCEL_URL` | Optional override (default `{APP_BASE_URL}/dashboard/pricing?checkout=cancelled`) |

Development mock billing (mutually exclusive with production Stripe charges):

| Variable | Purpose |
| --- | --- |
| `APP_ENV=development` | Required for mock billing |
| `MOCK_BILLING_ENABLED=true` | Enables mock `/api/billing` actions |
| `VITE_MOCK_BILLING_ENABLED=true` | Shows the mock upgrade UI in the browser |

Production must keep `MOCK_BILLING_ENABLED=false` (or unset) and must not set `VITE_MOCK_BILLING_ENABLED=true`.

## Test mode flow

1. Use Stripe **test** keys and a test-mode Price ID.
2. Sign in as a Free user.
3. Open **Plan → Upgrade to Pro** (`/dashboard/upgrade`).
4. Continue to Stripe Checkout (test card `4242 4242 4242 4242`).
5. Complete payment.
6. Confirm the webhook is delivered to `/api/stripe/webhook`.
7. Confirm the `subscriptions` row becomes `plan=pro`, `status=active`, `provider=stripe` with customer/subscription IDs.
8. Refresh the dashboard — Pro entitlements apply through the existing entitlement layer.
9. Exercise a Pro-gated action (extra Avatar or RAG usage) to confirm limits moved.

## Cancellation flow

1. From Settings or Upgrade, open **Manage subscription** (Customer Portal).
2. Cancel the subscription in Stripe.
3. While `cancel_at_period_end` is set but the Stripe subscription remains `active`, the app keeps Pro access until the period ends.
4. When Stripe sends `customer.subscription.deleted` (or a terminal status), the app returns the row to Free.
5. Refresh the dashboard and confirm Free entitlements.

## Production activation

- **Test keys** (`sk_test_…`, `price_…` from test mode) are for staging and local webhook forwarding only.
- **Live keys** (`sk_live_…`, live Price ID, live webhook secret) are for production only.
- Never mix test keys with a live webhook endpoint, or live keys with test Checkout.
- Rotate any secret that was pasted into chat, tickets, or screenshots.

## Operator checks

- Webhook signature failures return HTTP 400 — fix the signing secret before retrying.
- Founding plans are preserved: Stripe sync will not downgrade an active/trialing `founding` row.
- Activation analytics (`subscription_activated`) fire from the webhook path when a user newly becomes elevated Pro — not from the browser return URL alone.
