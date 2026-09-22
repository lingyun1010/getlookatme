import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import { recordUserFunnelEventSafely } from '../analytics/events.ts'
import { createStripeClient } from './stripe.ts'
import { requireStripeBillingConfig, type StripeBillingConfig } from './stripeConfig.ts'

type SubscriptionRow = {
  user_id: string
  plan: string
  status: string
  provider: string
  provider_customer_id: string | null
  provider_subscription_id: string | null
}

function periodEndIso(subscription: Stripe.Subscription): string | null {
  const end = subscription.current_period_end
  return typeof end === 'number' ? new Date(end * 1000).toISOString() : null
}

function mapStripeSubscription(subscription: Stripe.Subscription): {
  plan: 'pro' | 'free'
  status: 'active' | 'trialing' | 'past_due' | 'cancelled' | 'free'
  provider_customer_id: string
  provider_subscription_id: string
  current_period_end: string | null
} {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
  const base = {
    provider_customer_id: customerId,
    provider_subscription_id: subscription.id,
    current_period_end: periodEndIso(subscription),
  }
  if (subscription.status === 'active') {
    return { plan: 'pro', status: 'active', ...base }
  }
  if (subscription.status === 'trialing') {
    return { plan: 'pro', status: 'trialing', ...base }
  }
  if (subscription.status === 'past_due') {
    return { plan: 'pro', status: 'past_due', ...base }
  }
  if (subscription.status === 'canceled' || subscription.status === 'unpaid' || subscription.status === 'incomplete_expired') {
    return { plan: 'free', status: 'free', ...base }
  }
  // incomplete / paused / etc. keep non-elevating free behavior
  return { plan: 'free', status: 'free', ...base }
}

async function resolveUserId(
  client: SupabaseClient,
  stripe: Stripe,
  source: {
    metadata?: Stripe.Metadata | null
    customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null
    clientReferenceId?: string | null
    subscriptionId?: string | null
  },
): Promise<string | null> {
  const fromMetadata = source.metadata?.app_user_id?.trim()
  if (fromMetadata) return fromMetadata
  if (source.clientReferenceId?.trim()) return source.clientReferenceId.trim()

  if (source.subscriptionId) {
    const { data } = await client.from('subscriptions').select('user_id').eq('provider_subscription_id', source.subscriptionId).maybeSingle()
    if (data?.user_id) return data.user_id as string
  }

  const customerId = typeof source.customer === 'string' ? source.customer : source.customer && !('deleted' in source.customer && source.customer.deleted) ? source.customer.id : null
  if (customerId) {
    const { data } = await client.from('subscriptions').select('user_id').eq('provider_customer_id', customerId).maybeSingle()
    if (data?.user_id) return data.user_id as string
    try {
      const customer = await stripe.customers.retrieve(customerId)
      if (!('deleted' in customer && customer.deleted)) {
        const metaUser = customer.metadata?.app_user_id?.trim()
        if (metaUser) return metaUser
      }
    } catch {
      return null
    }
  }
  return null
}

async function applySubscriptionState(
  client: SupabaseClient,
  userId: string,
  next: ReturnType<typeof mapStripeSubscription>,
): Promise<{ activated: boolean }> {
  const { data: existing, error: loadError } = await client.from('subscriptions').select('*').eq('user_id', userId).single()
  if (loadError || !existing) throw loadError ?? new Error('missing subscription')
  const row = existing as SubscriptionRow

  if (row.plan === 'founding' && (row.status === 'active' || row.status === 'trialing')) {
    // Preserve manually granted founding access.
    const { error } = await client.from('subscriptions').update({
      provider: 'stripe',
      provider_customer_id: next.provider_customer_id,
      provider_subscription_id: next.provider_subscription_id,
      current_period_end: next.current_period_end,
    }).eq('user_id', userId)
    if (error) throw error
    return { activated: false }
  }

  const wasElevated = row.plan !== 'free' && (row.status === 'active' || row.status === 'trialing')
  const willElevate = next.plan === 'pro' && (next.status === 'active' || next.status === 'trialing')

  const { error } = await client.from('subscriptions').update({
    plan: next.plan,
    status: next.status,
    provider: 'stripe',
    provider_customer_id: next.provider_customer_id,
    provider_subscription_id: next.provider_subscription_id,
    current_period_end: next.current_period_end,
  }).eq('user_id', userId)
  if (error) throw error
  return { activated: willElevate && !wasElevated }
}

async function syncStripeSubscription(
  client: SupabaseClient,
  stripe: Stripe,
  subscription: Stripe.Subscription,
): Promise<void> {
  const userId = await resolveUserId(client, stripe, {
    metadata: subscription.metadata,
    customer: subscription.customer,
    subscriptionId: subscription.id,
  })
  if (!userId) {
    console.error('Stripe webhook could not resolve application user', { subscriptionId: subscription.id })
    return
  }
  const mapped = mapStripeSubscription(subscription)
  const { activated } = await applySubscriptionState(client, userId, mapped)
  if (activated) await recordUserFunnelEventSafely(client, userId, 'subscription_activated')
}

export async function handleStripeWebhook(
  rawBody: string | Buffer,
  signature: string | undefined,
  client: SupabaseClient,
  environment: NodeJS.ProcessEnv = process.env,
  config: StripeBillingConfig = requireStripeBillingConfig(environment),
  stripe = createStripeClient(config),
): Promise<{ status: number; body: unknown }> {
  if (!signature) return { status: 400, body: { error: 'Missing Stripe-Signature header.' } }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, config.webhookSecret)
  } catch (error) {
    console.error('Stripe webhook signature verification failed', error instanceof Error ? error.name : 'UnknownError')
    return { status: 400, body: { error: 'Invalid Stripe webhook signature.' } }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
        if (!subscriptionId) break
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        // Ensure metadata from the checkout session is available on first sync.
        if (!subscription.metadata?.app_user_id && session.metadata?.app_user_id) {
          await stripe.subscriptions.update(subscriptionId, {
            metadata: {
              ...subscription.metadata,
              app_user_id: session.metadata.app_user_id,
              ...(session.metadata.profile_id ? { profile_id: session.metadata.profile_id } : {}),
            },
          })
          subscription.metadata = {
            ...subscription.metadata,
            app_user_id: session.metadata.app_user_id,
            ...(session.metadata.profile_id ? { profile_id: session.metadata.profile_id } : {}),
          }
        }
        const userId = await resolveUserId(client, stripe, {
          metadata: session.metadata,
          customer: session.customer,
          clientReferenceId: session.client_reference_id,
          subscriptionId,
        })
        if (!userId) {
          console.error('Stripe checkout.session.completed missing app user', { sessionId: session.id })
          break
        }
        // Stash customer id early for portal access even before subscription retrieve mapping.
        if (typeof session.customer === 'string') {
          await client.from('subscriptions').update({
            provider: 'stripe',
            provider_customer_id: session.customer,
            provider_subscription_id: subscriptionId,
          }).eq('user_id', userId)
        }
        await syncStripeSubscription(client, stripe, subscription)
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await syncStripeSubscription(client, stripe, event.data.object as Stripe.Subscription)
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const parentSubscription = invoice.parent?.subscription_details?.subscription
        const subscriptionId = typeof parentSubscription === 'string'
          ? parentSubscription
          : parentSubscription && typeof parentSubscription === 'object'
            ? parentSubscription.id
            : undefined
        if (!subscriptionId) break
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        await syncStripeSubscription(client, stripe, subscription)
        break
      }
      default:
        break
    }
  } catch (error) {
    console.error('Stripe webhook handling failed', { type: event.type, error: error instanceof Error ? error.name : 'UnknownError' })
    return { status: 500, body: { error: 'Webhook handling failed.' } }
  }

  return { status: 200, body: { received: true } }
}
