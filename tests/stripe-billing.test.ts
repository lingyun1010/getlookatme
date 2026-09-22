import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { readStripeBillingConfig, requireStripeBillingConfig, StripeConfigError, stripeBillingConfigured } from '../src/billing/stripeConfig.ts'

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
