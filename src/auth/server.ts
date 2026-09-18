import { createClient, type User } from '@supabase/supabase-js'

export async function authenticateBearer(authorization: string | undefined): Promise<User | null> {
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY
  if (!token || !url || !key) return null
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  const { data: { user }, error } = await client.auth.getUser(token)
  return error ? null : user
}
