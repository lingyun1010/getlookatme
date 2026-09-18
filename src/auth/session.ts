import type { User } from '@supabase/supabase-js'
import { requireSupabase } from './supabase.ts'

export async function currentUser(): Promise<User | null> {
  const client = requireSupabase()
  const { data: { user }, error } = await client.auth.getUser()
  if (error) return null
  return user
}

export async function requireAuthenticatedUser(returnTo = window.location.pathname): Promise<User> {
  const user = await currentUser()
  if (user) return user
  const next = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/create'
  window.location.replace(`/auth?next=${encodeURIComponent(next)}`)
  throw new Error('Authentication required')
}

export async function signOut(): Promise<void> {
  const { error } = await requireSupabase().auth.signOut()
  if (error) throw error
  window.location.assign('/auth')
}
