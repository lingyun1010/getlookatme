import { authenticateBearer, createAuthenticatedServerClient } from '../src/auth/server.ts'
import { isAvatarPreset } from '../src/avatar/types.ts'
import { isOwnedAssetPath } from '../src/profile/repository.ts'

interface ApiRequest { method?: string; body?: unknown; headers?: { authorization?: string } }
interface ApiResponse { status(code: number): ApiResponse; end(): void; json(body: unknown): void; setHeader(name: string, value: string): void }

const styles = new Set(['felt@1', 'cartoon@1', 'cinematic-3d@1', 'anime@1'])

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Allow', 'POST, OPTIONS')
  response.setHeader('Cache-Control', 'no-store')
  if (request.method === 'OPTIONS') return response.status(204).end()
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })
  const user = await authenticateBearer(request.headers?.authorization)
  const client = createAuthenticatedServerClient(request.headers?.authorization)
  if (!user || !client) return response.status(401).json({ error: 'Authentication required' })
  const body = request.body as { profileId?: unknown; sourcePhotoPath?: unknown; style?: unknown; preset?: unknown } | null
  if (!body || typeof body.profileId !== 'string' || typeof body.sourcePhotoPath !== 'string' || typeof body.style !== 'string' || !isAvatarPreset(body.preset)) {
    return response.status(400).json({ error: 'profileId, sourcePhotoPath, style, and preset are required.' })
  }
  if (!styles.has(body.style)) return response.status(400).json({ error: 'Unsupported avatar style.' })
  if (!isOwnedAssetPath(body.sourcePhotoPath, user.id, body.profileId) || !body.sourcePhotoPath.includes('/original-photo/')) {
    return response.status(403).json({ error: 'The source photo is not owned by this profile.' })
  }
  const { data: profile } = await client.from('profiles').select('id').eq('id', body.profileId).eq('user_id', user.id).maybeSingle()
  if (!profile) return response.status(404).json({ error: 'Profile not found.' })
  const { data: job, error } = await client.from('avatar_generation_jobs').insert({
    user_id: user.id, profile_id: body.profileId, source_photo_path: body.sourcePhotoPath,
    style: body.style, preset: body.preset, status: 'queued',
  }).select('*').single()
  if (error) return response.status(400).json({ error: 'Could not queue avatar generation.' })
  return response.status(202).json({ job })
}
