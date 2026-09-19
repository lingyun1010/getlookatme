import { createClient } from '@supabase/supabase-js'

interface ApiRequest { method?: string; query?: { slug?: string | string[] } }
interface ApiResponse { status(code: number): ApiResponse; json(body: unknown): void; setHeader(name: string, value: string): void }

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'private, max-age=0, no-store')
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' })
  const slug = typeof request.query?.slug === 'string' ? request.query.slug : ''
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!slug || !url || !key) return response.status(400).json({ error: 'Avatar resolution is unavailable.' })
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: profile } = await client.from('profiles').select('id,active_avatar_id').eq('slug', slug).eq('is_published', true).maybeSingle()
  if (!profile || profile.active_avatar_id) return response.status(200).json({ originalPhotoUrl: null })
  const { data: state } = await client.from('onboarding_states').select('original_photo_path').eq('profile_id', profile.id).maybeSingle()
  if (!state?.original_photo_path) return response.status(200).json({ originalPhotoUrl: null })
  const { data, error } = await client.storage.from('profile-private-assets').createSignedUrl(state.original_photo_path, 900)
  if (error) return response.status(500).json({ error: 'Could not resolve profile avatar.' })
  return response.status(200).json({ originalPhotoUrl: data.signedUrl })
}
