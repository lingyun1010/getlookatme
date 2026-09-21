import { authenticateBearer, createServiceRoleServerClient } from '../src/auth/server.ts'
import { recordFunnelEventSafely, type FunnelEventType } from '../src/analytics/events.ts'

interface ApiRequest { method?: string; body?: unknown; headers?: { authorization?: string } }
interface ApiResponse { status(code: number): ApiResponse; end(): void; json(body: unknown): void; setHeader(name: string, value: string): void }

const authenticatedEvents = new Set<FunnelEventType>(['cv_uploaded', 'cv_parsed', 'upgrade_clicked'])

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Allow', 'POST, OPTIONS')
  response.setHeader('Cache-Control', 'no-store')
  if (request.method === 'OPTIONS') return response.status(204).end()
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })
  const body = request.body as { eventType?: unknown; profileSlug?: unknown } | null
  const client = createServiceRoleServerClient()
  if (!client) return response.status(503).json({ error: 'Analytics is unavailable.' })

  if (body?.eventType === 'public_profile_viewed' && typeof body.profileSlug === 'string') {
    const { data } = await client.from('profiles').select('id,user_id').eq('slug', body.profileSlug).eq('is_published', true).maybeSingle()
    if (data) await recordFunnelEventSafely(client, { userId: data.user_id, profileId: data.id, eventType: 'public_profile_viewed' })
    return response.status(202).json({ accepted: true })
  }

  if (!authenticatedEvents.has(body?.eventType as FunnelEventType)) return response.status(400).json({ error: 'Unsupported analytics event.' })
  const user = await authenticateBearer(request.headers?.authorization)
  if (!user) return response.status(401).json({ error: 'Authentication required.' })
  const { data: profile } = await client.from('profiles').select('id').eq('user_id', user.id).order('created_at').limit(1).maybeSingle()
  if (profile) await recordFunnelEventSafely(client, { userId: user.id, profileId: profile.id, eventType: body!.eventType as FunnelEventType })
  return response.status(202).json({ accepted: true })
}
