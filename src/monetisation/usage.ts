import type { SupabaseClient, User } from '@supabase/supabase-js'
import { requireSupabase } from '../auth/supabase.ts'

export type UsageEventType = 'cv_parse' | 'avatar_generation' | 'rag_query' | 'embedding'
export type UsageTotals = Record<UsageEventType, number>

export interface UsageEventInput {
  userId: string
  profileId: string
  eventType: UsageEventType
  quantity?: number
}

const emptyTotals = (): UsageTotals => ({ cv_parse: 0, avatar_generation: 0, rag_query: 0, embedding: 0 })

export function currentMonthStart(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

export async function recordUsage(client: SupabaseClient, event: UsageEventInput): Promise<void> {
  const { error } = await client.from('usage_events').insert({
    user_id: event.userId,
    profile_id: event.profileId,
    event_type: event.eventType,
    quantity: event.quantity ?? 1,
  })
  if (error) throw error
}

export async function recordUsageSafely(client: SupabaseClient, event: UsageEventInput): Promise<void> {
  try {
    await recordUsage(client, event)
  } catch (error) {
    console.error('Usage event persistence failed', {
      eventType: event.eventType,
      error: error instanceof Error ? error.name : 'UnknownError',
    })
  }
}

export async function getMonthlyUsage(
  client: SupabaseClient,
  userId: string,
  now = new Date(),
): Promise<UsageTotals> {
  const { data, error } = await client.from('usage_events')
    .select('event_type,quantity')
    .eq('user_id', userId)
    .gte('created_at', currentMonthStart(now))
  if (error) throw error
  return (data ?? []).reduce((totals, row) => {
    const eventType = row.event_type as UsageEventType
    totals[eventType] += Number(row.quantity)
    return totals
  }, emptyTotals())
}

export function getCurrentUserMonthlyUsage(user: User, now = new Date()): Promise<UsageTotals> {
  return getMonthlyUsage(requireSupabase(), user.id, now)
}
