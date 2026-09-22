import type { User } from '@supabase/supabase-js'
import { requireSupabase } from '../auth/supabase.ts'

export type PlanId = 'free' | 'pro' | 'founding'
export type SubscriptionStatus = 'free' | 'active' | 'trialing' | 'past_due' | 'cancelled'
export type BillingProviderId = 'mock' | 'stripe'

export interface Subscription {
  user_id: string
  plan: PlanId
  status: SubscriptionStatus
  provider: BillingProviderId
  provider_customer_id: string | null
  provider_subscription_id: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  created_at: string
  updated_at: string
}

export async function getSubscription(user: User): Promise<Subscription> {
  const { data, error } = await requireSupabase().from('subscriptions').select('*').eq('user_id', user.id).single()
  if (error) throw error
  return data as Subscription
}
