import type { SupabaseClient } from '@supabase/supabase-js'
import type { BillingSession, DevelopmentBillingProvider } from './provider.ts'

const sessionFor = (userId: string): BillingSession => ({ id: `mock:${userId}:${crypto.randomUUID()}`, provider: 'mock' })

export class MockBillingSessionError extends Error {}

export class MockBillingProvider implements DevelopmentBillingProvider {
  private readonly client: SupabaseClient
  constructor(client: SupabaseClient) { this.client = client }

  async createCheckoutSession(userId: string): Promise<BillingSession> {
    return sessionFor(userId)
  }

  async createPortalSession(userId: string): Promise<BillingSession> {
    return sessionFor(userId)
  }

  async completeCheckoutSession(userId: string, sessionId: string): Promise<void> {
    if (!sessionId.startsWith(`mock:${userId}:`)) throw new MockBillingSessionError('Invalid mock checkout session.')
    const periodEnd = new Date(); periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1)
    const { error } = await this.client.from('subscriptions').update({
      plan: 'pro', status: 'active', provider: 'mock',
      provider_customer_id: `mock-customer:${userId}`,
      provider_subscription_id: sessionId,
      current_period_end: periodEnd.toISOString(),
    }).eq('user_id', userId)
    if (error) throw error
  }

  async cancelSubscription(userId: string): Promise<void> {
    const { error } = await this.client.from('subscriptions').update({ status: 'cancelled' }).eq('user_id', userId).eq('provider', 'mock')
    if (error) throw error
  }

  async reactivateSubscription(userId: string): Promise<void> {
    const { error } = await this.client.from('subscriptions').update({ status: 'active' }).eq('user_id', userId).eq('provider', 'mock').eq('plan', 'pro')
    if (error) throw error
  }
}

export function mockBillingEnabled(environment: NodeJS.ProcessEnv = process.env): boolean {
  const production = environment.VERCEL_ENV === 'production' || environment.NODE_ENV === 'production'
  return !production && environment.MOCK_BILLING_ENABLED === 'true'
}
