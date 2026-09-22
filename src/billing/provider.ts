export type BillingProviderName = 'mock' | 'stripe'

export interface BillingSession {
  id: string
  provider: BillingProviderName
  /** Present for hosted Stripe Checkout / Customer Portal redirects. */
  url?: string
}

export interface BillingProvider {
  createCheckoutSession(userId: string): Promise<BillingSession>
  createPortalSession(userId: string): Promise<BillingSession>
}

export interface DevelopmentBillingProvider extends BillingProvider {
  completeCheckoutSession(userId: string, sessionId: string): Promise<void>
  cancelSubscription(userId: string): Promise<void>
  reactivateSubscription(userId: string): Promise<void>
}
