export interface StripeBillingConfig {
  secretKey: string
  webhookSecret: string
  proPriceId: string
  successUrl: string
  cancelUrl: string
}

export class StripeConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StripeConfigError'
  }
}

function trim(value: string | undefined): string | undefined {
  const next = value?.trim()
  return next ? next : undefined
}

function resolveAppBaseUrl(environment: NodeJS.ProcessEnv): string | undefined {
  return trim(environment.APP_BASE_URL) ?? trim(environment.SITE_URL) ?? trim(environment.PUBLIC_APP_URL)
}

export function readStripeBillingConfig(environment: NodeJS.ProcessEnv = process.env): StripeBillingConfig | null {
  const secretKey = trim(environment.STRIPE_SECRET_KEY)
  const webhookSecret = trim(environment.STRIPE_WEBHOOK_SECRET)
  const proPriceId = trim(environment.STRIPE_PRO_PRICE_ID)
  if (!secretKey || !webhookSecret || !proPriceId) return null

  const baseUrl = resolveAppBaseUrl(environment)?.replace(/\/$/, '')
  const successUrl = trim(environment.STRIPE_SUCCESS_URL) ?? (baseUrl ? `${baseUrl}/dashboard/pricing?checkout=success` : undefined)
  const cancelUrl = trim(environment.STRIPE_CANCEL_URL) ?? (baseUrl ? `${baseUrl}/dashboard/pricing?checkout=cancelled` : undefined)
  if (!successUrl || !cancelUrl) return null

  return { secretKey, webhookSecret, proPriceId, successUrl, cancelUrl }
}

export function requireStripeBillingConfig(environment: NodeJS.ProcessEnv = process.env): StripeBillingConfig {
  const config = readStripeBillingConfig(environment)
  if (!config) {
    throw new StripeConfigError(
      'Stripe billing requires STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRO_PRICE_ID, and either STRIPE_SUCCESS_URL/STRIPE_CANCEL_URL or APP_BASE_URL.',
    )
  }
  return config
}

export function stripeBillingConfigured(environment: NodeJS.ProcessEnv = process.env): boolean {
  return readStripeBillingConfig(environment) !== null
}
