import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { readStripeBillingConfig, requireStripeBillingConfig, StripeConfigError, stripeBillingConfigured } from '../src/billing/stripeConfig.ts'
import { resolveBillingMode } from '../src/billing/mode.ts'
import { mockBillingEnabled } from '../src/billing/mock.ts'

test('stripe config requires secrets and success/cancel URLs', () => {
  assert.equal(stripeBillingConfigured({}), false)
  assert.equal(readStripeBillingConfig({
    STRIPE_SECRET_KEY: 'sk_test_x',
    STRIPE_WEBHOOK_SECRET: 'whsec_x',
    STRIPE_PRO_PRICE_ID: 'price_x',
  }), null)
  const config = requireStripeBillingConfig({
    STRIPE_SECRET_KEY: 'sk_test_x',
    STRIPE_WEBHOOK_SECRET: 'whsec_x',
    STRIPE_PRO_PRICE_ID: 'price_x',
    APP_BASE_URL: 'https://example.com/',
  })
  assert.equal(config.successUrl, 'https://example.com/dashboard/pricing?checkout=success')
  assert.equal(config.cancelUrl, 'https://example.com/dashboard/pricing?checkout=cancelled')
  assert.throws(() => requireStripeBillingConfig({ STRIPE_SECRET_KEY: 'sk_test_x' }), StripeConfigError)
})

test('stripe provider module stays behind the billing boundary', async () => {
  const [provider, stripeModule, packageJson] = await Promise.all([
    readFile(new URL('../src/billing/provider.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/billing/stripe.ts', import.meta.url), 'utf8'),
    readFile(new URL('../package.json', import.meta.url), 'utf8'),
  ])
  assert.match(provider, /provider: BillingProviderName/)
  assert.match(provider, /url\?: string/)
  assert.match(stripeModule, /class StripeBillingProvider implements BillingProvider/)
  assert.match(stripeModule, /checkout\.sessions\.create/)
  assert.match(stripeModule, /billingPortal\.sessions\.create/)
  assert.match(stripeModule, /app_user_id/)
  assert.match(stripeModule, /profile_id/)
  assert.doesNotMatch(stripeModule, /VITE_/)
  assert.match(packageJson, /"stripe"/)
})

test('billing request exposes authenticated stripe checkout without trusting client identity', async () => {
  const request = await readFile(new URL('../src/billing/request.ts', import.meta.url), 'utf8')
  const client = await readFile(new URL('../src/billing/client.ts', import.meta.url), 'utf8')
  assert.match(request, /action === 'checkout'/)
  assert.match(request, /authenticateBearer\(authorization\)/)
  assert.match(request, /createCheckoutSession\(user\.id\)/)
  assert.match(request, /checkout_started/)
  assert.doesNotMatch(request, /body\.userId|body\.user_id|body\.customerId/)
  assert.match(client, /requestBilling/)
  assert.match(client, /'checkout'/)
})

test('stripe webhook verifies signatures and maps subscription lifecycle events', async () => {
  const webhook = await readFile(new URL('../src/billing/stripeWebhook.ts', import.meta.url), 'utf8')
  const route = await readFile(new URL('../api/stripe/webhook.ts', import.meta.url), 'utf8')
  assert.match(webhook, /constructEvent/)
  assert.match(webhook, /checkout\.session\.completed/)
  assert.match(webhook, /customer\.subscription\.updated/)
  assert.match(webhook, /customer\.subscription\.deleted/)
  assert.match(webhook, /invoice\.payment_failed/)
  assert.match(webhook, /subscription_activated/)
  assert.match(webhook, /plan === 'founding'/)
  assert.match(route, /bodyParser: false/)
  assert.match(route, /stripe-signature/)
  assert.doesNotMatch(webhook, /authenticateBearer/)
})

test('customer portal is an authenticated billing action for stripe customers', async () => {
  const request = await readFile(new URL('../src/billing/request.ts', import.meta.url), 'utf8')
  const provider = await readFile(new URL('../src/billing/stripe.ts', import.meta.url), 'utf8')
  const dashboard = await readFile(new URL('../src/dashboard/dashboardApp.ts', import.meta.url), 'utf8')
  assert.match(request, /action === 'portal'/)
  assert.match(request, /createPortalSession\(user\.id\)/)
  assert.match(provider, /billingPortal\.sessions\.create/)
  assert.match(dashboard, /Manage subscription/)
  assert.doesNotMatch(request, /body\.customerId|body\.provider_customer_id/)
})

test('billing mode keeps mock development-only and prefers stripe otherwise', () => {
  assert.equal(mockBillingEnabled({ APP_ENV: 'production', MOCK_BILLING_ENABLED: 'true' }), false)
  assert.equal(resolveBillingMode({ APP_ENV: 'development', MOCK_BILLING_ENABLED: 'true' }), 'mock')
  assert.equal(resolveBillingMode({
    APP_ENV: 'production',
    STRIPE_SECRET_KEY: 'sk_test_x',
    STRIPE_WEBHOOK_SECRET: 'whsec_x',
    STRIPE_PRO_PRICE_ID: 'price_x',
    APP_BASE_URL: 'https://example.com',
  }), 'stripe')
  assert.equal(resolveBillingMode({ APP_ENV: 'production' }), 'unavailable')
})
