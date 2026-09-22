import type { SupabaseClient } from '@supabase/supabase-js'

export type FunnelEventType =
  | 'create_profile_clicked'
  | 'signup_completed'
  | 'cv_uploaded'
  | 'cv_parsed'
  | 'avatar_generated'
  | 'profile_published'
  | 'public_profile_viewed'
  | 'rag_question_asked'
  | 'upgrade_clicked'
  | 'checkout_started'
  | 'subscription_activated'

export interface FunnelEventInput {
  userId?: string | null
  profileId?: string | null
  eventType: FunnelEventType
  metadata?: Record<string, string | number | boolean | null>
}

export async function recordFunnelEvent(client: SupabaseClient, event: FunnelEventInput): Promise<void> {
  const { error } = await client.from('analytics_events').insert({
    user_id: event.userId ?? null,
    profile_id: event.profileId ?? null,
    event_type: event.eventType,
    metadata: event.metadata ?? {},
  })
  if (error) throw error
}

export async function recordFunnelEventSafely(client: SupabaseClient, event: FunnelEventInput): Promise<void> {
  try {
    await recordFunnelEvent(client, event)
  } catch (error) {
    console.error('Funnel event persistence failed', {
      eventType: event.eventType,
      error: error instanceof Error ? error.name : 'UnknownError',
    })
  }
}

export async function recordUserFunnelEventSafely(client: SupabaseClient, userId: string, eventType: FunnelEventType): Promise<void> {
  try {
    const { data, error } = await client.from('profiles').select('id').eq('user_id', userId).order('created_at').limit(1).single()
    if (error) throw error
    await recordFunnelEventSafely(client, { userId, profileId: data.id, eventType })
  } catch (error) {
    console.error('Funnel event attribution failed', { eventType, error: error instanceof Error ? error.name : 'UnknownError' })
  }
}
