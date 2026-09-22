import { isSupabaseConfigured, requireSupabase } from '../auth/supabase.ts'

export async function trackFunnelEvent(eventType: 'create_profile_clicked' | 'cv_uploaded' | 'cv_parsed' | 'upgrade_clicked' | 'public_profile_viewed', profileSlug?: string): Promise<void> {
  try {
    const session = isSupabaseConfigured ? (await requireSupabase().auth.getSession()).data.session : null
    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
      body: JSON.stringify({ eventType, profileSlug }),
      keepalive: true,
    })
  } catch {
    // Funnel analytics never interrupts the product action being measured.
  }
}
