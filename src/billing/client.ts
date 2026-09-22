import { requireSupabase } from '../auth/supabase.ts'
import type { BillingProviderName } from './provider.ts'

export interface BillingResult {
  session?: { id: string; provider: BillingProviderName; url?: string }
  status?: string
  plan?: string
  provider?: BillingProviderName
}

export type BillingAction = 'start' | 'complete' | 'cancel' | 'reactivate' | 'checkout'

export async function requestBilling(action: BillingAction, sessionId?: string): Promise<BillingResult> {
  const { data: { session } } = await requireSupabase().auth.getSession()
  const response = await fetch('/api/billing', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ action, sessionId }),
  })
  const result = await response.json().catch(() => null) as (BillingResult & { error?: string }) | null
  if (!response.ok) throw new Error(result?.error ?? 'Billing is unavailable.')
  return result ?? {}
}

/** @deprecated Prefer requestBilling — kept for existing mock upgrade UI imports. */
export async function requestMockBilling(
  action: 'start' | 'complete' | 'cancel' | 'reactivate',
  sessionId?: string,
): Promise<BillingResult> {
  return requestBilling(action, sessionId)
}
