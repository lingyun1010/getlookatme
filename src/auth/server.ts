import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

function bearerToken(authorization: string | undefined): string | null {
  return authorization?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null
}

function publicServerConfig(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY
  return url && key ? { url, key } : null
}

export async function authenticateBearer(authorization: string | undefined): Promise<User | null> {
  const token = bearerToken(authorization)
  const config = publicServerConfig()
  if (!token || !config) return null
  const client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  const { data: { user }, error } = await client.auth.getUser(token)
  return error ? null : user
}

export function createAuthenticatedServerClient(authorization: string | undefined): SupabaseClient | null {
  const token = bearerToken(authorization)
  const config = publicServerConfig()
  if (!token || !config) return null
  return createClient(config.url, config.key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
