import type { SupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import type { BillingProvider, BillingSession } from './provider.ts'
import { requireStripeBillingConfig, type StripeBillingConfig } from './stripeConfig.ts'

export class StripeBillingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StripeBillingError'
  }
}

type SubscriptionRow = {
  user_id: string
  plan: string
  status: string
  provider: string
  provider_customer_id: string | null
  provider_subscription_id: string | null
  current_period_end: string | null
  cancel_at_period_end?: boolean
}

export type StripeSubscriptionMutationResult = {
  plan: string
  status: string
  provider: 'stripe'
  cancel_at_period_end: boolean
  current_period_end: string | null
  provider_subscription_id: string
}

export function createStripeClient(config: StripeBillingConfig): Stripe {
  return new Stripe(config.secretKey, {
    apiVersion: '2025-08-27.basil',
    typescript: true,
  })
}

export class StripeBillingProvider implements BillingProvider {
  private readonly client: SupabaseClient
  private readonly stripe: Stripe
  private readonly config: StripeBillingConfig

  constructor(client: SupabaseClient, config: StripeBillingConfig = requireStripeBillingConfig(), stripe = createStripeClient(config)) {
    this.client = client
    this.config = config
    this.stripe = stripe
  }

  async createCheckoutSession(userId: string): Promise<BillingSession> {
    const { subscription, profileId, email } = await this.loadBillingContext(userId)
    if (subscription.plan === 'founding' && (subscription.status === 'active' || subscription.status === 'trialing')) {
      throw new StripeBillingError('Founding access is already active for this account.')
    }
    if (subscription.plan === 'pro' && (subscription.status === 'active' || subscription.status === 'trialing') && subscription.provider === 'stripe') {
      throw new StripeBillingError('A Pro subscription is already active.')
    }

    const customerId = await this.ensureCustomer(userId, email, subscription.provider_customer_id)
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: userId,
      line_items: [{ price: this.config.proPriceId, quantity: 1 }],
      success_url: this.config.successUrl,
      cancel_url: this.config.cancelUrl,
      allow_promotion_codes: false,
      metadata: {
        app_user_id: userId,
        profile_id: profileId,
      },
      subscription_data: {
        metadata: {
          app_user_id: userId,
          profile_id: profileId,
        },
      },
    })
    if (!session.url) throw new StripeBillingError('Stripe Checkout did not return a redirect URL.')
    return { id: session.id, provider: 'stripe', url: session.url }
  }

  async createPortalSession(userId: string): Promise<BillingSession> {
    const { subscription } = await this.loadBillingContext(userId)
    if (subscription.provider !== 'stripe' || !subscription.provider_customer_id) {
      throw new StripeBillingError('No Stripe customer is linked to this account.')
    }
    const portalReturn = this.config.successUrl.includes('/dashboard/pricing')
      ? `${this.config.successUrl.split('?')[0]}?portal=return`
      : this.config.successUrl
    const session = await this.stripe.billingPortal.sessions.create({
      customer: subscription.provider_customer_id,
      return_url: portalReturn,
    })
    return { id: session.id, provider: 'stripe', url: session.url }
  }


  async scheduleCancellation(userId: string): Promise<StripeSubscriptionMutationResult> {
    const { subscription } = await this.loadBillingContext(userId)
    if (subscription.plan === 'founding') throw new StripeBillingError('Founding access is managed manually and cannot be cancelled here.')
    if (subscription.provider !== 'stripe' || !subscription.provider_subscription_id) {
      throw new StripeBillingError('No Stripe subscription is linked to this account.')
    }
    if (!(subscription.status === 'active' || subscription.status === 'trialing')) {
      throw new StripeBillingError('Only an active Stripe Pro subscription can be cancelled.')
    }
    const updated = await this.stripe.subscriptions.update(subscription.provider_subscription_id, {
      cancel_at_period_end: true,
    })
    const currentPeriodEnd = updated.items.data[0]?.current_period_end
      ? new Date(updated.items.data[0].current_period_end * 1000).toISOString()
      : subscription.current_period_end
    const { error } = await this.client.from('subscriptions').update({
      cancel_at_period_end: true,
      current_period_end: currentPeriodEnd,
      provider: 'stripe',
      provider_subscription_id: updated.id,
    }).eq('user_id', userId)
    if (error) throw error
    return {
      plan: subscription.plan,
      status: subscription.status,
      provider: 'stripe',
      cancel_at_period_end: true,
      current_period_end: currentPeriodEnd,
      provider_subscription_id: updated.id,
    }
  }

  async resumeSubscription(userId: string): Promise<StripeSubscriptionMutationResult> {
    const { subscription } = await this.loadBillingContext(userId)
    if (subscription.plan === 'founding') throw new StripeBillingError('Founding access is managed manually.')
    if (subscription.provider !== 'stripe' || !subscription.provider_subscription_id) {
      throw new StripeBillingError('No Stripe subscription is linked to this account.')
    }
    if (!(subscription.status === 'active' || subscription.status === 'trialing')) {
      throw new StripeBillingError('Only an active Stripe Pro subscription can be resumed.')
    }
    const updated = await this.stripe.subscriptions.update(subscription.provider_subscription_id, {
      cancel_at_period_end: false,
    })
    const currentPeriodEnd = updated.items.data[0]?.current_period_end
      ? new Date(updated.items.data[0].current_period_end * 1000).toISOString()
      : subscription.current_period_end
    const { error } = await this.client.from('subscriptions').update({
      cancel_at_period_end: false,
      current_period_end: currentPeriodEnd,
      provider: 'stripe',
      provider_subscription_id: updated.id,
    }).eq('user_id', userId)
    if (error) throw error
    return {
      plan: subscription.plan,
      status: subscription.status,
      provider: 'stripe',
      cancel_at_period_end: false,
      current_period_end: currentPeriodEnd,
      provider_subscription_id: updated.id,
    }
  }

  private async loadBillingContext(userId: string): Promise<{ subscription: SubscriptionRow; profileId: string; email: string | null }> {
    const [{ data: subscription, error: subscriptionError }, { data: profile, error: profileError }, userResult] = await Promise.all([
      this.client.from('subscriptions').select('*').eq('user_id', userId).single(),
      this.client.from('profiles').select('id').eq('user_id', userId).order('created_at').limit(1).maybeSingle(),
      this.client.auth.admin.getUserById(userId),
    ])
    if (subscriptionError || !subscription) throw new StripeBillingError('Subscription could not be loaded for this account.')
    if (profileError || !profile?.id) throw new StripeBillingError('Profile could not be loaded for this account.')
    if (userResult.error || !userResult.data.user) throw new StripeBillingError('User identity could not be loaded for this account.')
    return {
      subscription: subscription as SubscriptionRow,
      profileId: profile.id as string,
      email: userResult.data.user.email ?? null,
    }
  }

  private async ensureCustomer(userId: string, email: string | null, existingCustomerId: string | null): Promise<string> {
    if (existingCustomerId) {
      try {
        const customer = await this.stripe.customers.retrieve(existingCustomerId)
        if (!('deleted' in customer && customer.deleted)) return existingCustomerId
      } catch {
        // Fall through and create a replacement customer.
      }
    }
    const customer = await this.stripe.customers.create({
      email: email ?? undefined,
      metadata: { app_user_id: userId },
    })
    const { error } = await this.client.from('subscriptions').update({
      provider_customer_id: customer.id,
      provider: 'stripe',
    }).eq('user_id', userId)
    if (error) throw error
    return customer.id
  }
}
