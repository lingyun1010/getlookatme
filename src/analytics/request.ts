import { authenticateBearer, createServiceRoleServerClient } from '../auth/server.ts'
import { recordFunnelEventSafely, type FunnelEventType } from './events.ts'

const authenticatedEvents = new Set<FunnelEventType>(['cv_uploaded', 'cv_parsed', 'upgrade_clicked'])

export async function handleAnalyticsRequest(
  authorization: string | undefined,
  input: unknown,
): Promise<{ status: number; body: unknown }> {
  const body = input as { eventType?: unknown; profileSlug?: unknown } | null
  const client = createServiceRoleServerClient()
  if (!client) return { status: 503, body: { error: 'Analytics is unavailable.' } }

  if (body?.eventType === 'public_profile_viewed' && typeof body.profileSlug === 'string') {
    const { data } = await client.from('profiles').select('id,user_id').eq('slug', body.profileSlug).eq('is_published', true).maybeSingle()
    if (data) await recordFunnelEventSafely(client, { userId: data.user_id, profileId: data.id, eventType: 'public_profile_viewed' })
    return { status: 202, body: { accepted: true } }
  }

  if (body?.eventType === 'create_profile_clicked') {
    const user = authorization ? await authenticateBearer(authorization) : null
    const { data: profile } = user
      ? await client.from('profiles').select('id').eq('user_id', user.id).order('created_at').limit(1).maybeSingle()
      : { data: null }
    await recordFunnelEventSafely(client, {
      userId: user && profile ? user.id : null,
      profileId: profile?.id ?? null,
      eventType: 'create_profile_clicked',
    })
    return { status: 202, body: { accepted: true } }
  }

  if (!authenticatedEvents.has(body?.eventType as FunnelEventType)) return { status: 400, body: { error: 'Unsupported analytics event.' } }
  const user = await authenticateBearer(authorization)
  if (!user) return { status: 401, body: { error: 'Authentication required.' } }
  const { data: profile } = await client.from('profiles').select('id').eq('user_id', user.id).order('created_at').limit(1).maybeSingle()
  if (profile) await recordFunnelEventSafely(client, { userId: user.id, profileId: profile.id, eventType: body!.eventType as FunnelEventType })
  return { status: 202, body: { accepted: true } }
}
