import { mockBillingEnabled } from './mock.ts'
import { stripeBillingConfigured } from './stripeConfig.ts'

export type BillingMode = 'mock' | 'stripe' | 'unavailable'

export function resolveBillingMode(environment: NodeJS.ProcessEnv = process.env): BillingMode {
  if (mockBillingEnabled(environment)) return 'mock'
  if (stripeBillingConfigured(environment)) return 'stripe'
  return 'unavailable'
}
