import { requireSupabase } from '../auth/supabase.ts'

export interface MockBillingResult { session?: { id: string; provider: 'mock' }; status?: string; plan?: string }

export async function requestMockBilling(action: 'start' | 'complete' | 'cancel' | 'reactivate', sessionId?: string): Promise<MockBillingResult> {
  const { data: { session } } = await requireSupabase().auth.getSession()
  const response = await fetch('/api/billing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
    body: JSON.stringify({ action, sessionId }),
  })
  const result = await response.json().catch(() => null) as (MockBillingResult & { error?: string }) | null
  if (!response.ok) throw new Error(result?.error ?? 'Mock billing is unavailable.')
  return result ?? {}
}
