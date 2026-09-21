import { recordUserFunnelEventSafely } from '../analytics/events.ts'
import { authenticateBearer, createServiceRoleServerClient } from '../auth/server.ts'
import { MockBillingProvider, MockBillingSessionError, mockBillingEnabled } from './mock.ts'

export async function handleBillingRequest(
  authorization: string | undefined,
  input: unknown,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<{ status: number; body: unknown }> {
  if (!mockBillingEnabled(environment)) {
    return { status: 403, body: { code: 'mock_billing_disabled', error: 'Mock billing is disabled in this environment.' } }
  }
  const user = await authenticateBearer(authorization)
  if (!user) return { status: 401, body: { code: 'authentication_required', error: 'Authentication required.' } }
  const client = createServiceRoleServerClient()
  if (!client) return { status: 503, body: { code: 'billing_unavailable', error: 'Billing is unavailable.' } }

  const body = input as { action?: unknown; sessionId?: unknown } | null
  const action = body?.action
  if (action !== 'start' && action !== 'complete' && action !== 'cancel' && action !== 'reactivate') {
    return { status: 400, body: { code: 'invalid_billing_action', error: 'Unsupported billing action.' } }
  }

  const provider = new MockBillingProvider(client)
  try {
    if (action === 'start') {
      const session = await provider.createCheckoutSession(user.id)
      await recordUserFunnelEventSafely(client, user.id, 'checkout_started')
      return { status: 200, body: { session } }
    }
    if (action === 'complete') {
      if (typeof body?.sessionId !== 'string') return { status: 400, body: { code: 'invalid_checkout_session', error: 'A mock checkout session is required.' } }
      await provider.completeCheckoutSession(user.id, body.sessionId)
      await recordUserFunnelEventSafely(client, user.id, 'subscription_activated')
      return { status: 200, body: { status: 'active', plan: 'pro', provider: 'mock' } }
    }
    if (action === 'cancel') {
      await provider.cancelSubscription(user.id)
      return { status: 200, body: { status: 'cancelled', plan: 'pro', provider: 'mock' } }
    }
    await provider.reactivateSubscription(user.id)
    return { status: 200, body: { status: 'active', plan: 'pro', provider: 'mock' } }
  } catch (error) {
    if (error instanceof MockBillingSessionError) {
      return { status: 400, body: { code: 'invalid_checkout_session', error: error.message } }
    }
    console.error('Mock billing subscription update failed', error instanceof Error ? error.name : 'UnknownError')
    return { status: 500, body: { code: 'subscription_update_failed', error: 'The subscription could not be updated.' } }
  }
}
