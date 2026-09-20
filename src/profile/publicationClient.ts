import { chatAuthorizationHeaders } from '../auth/chatSession.ts'
import { requireSupabase } from '../auth/supabase.ts'

export async function requestPublication(action: 'availability' | 'save-slug' | 'publish' | 'unpublish', slug?: string) {
  const authorization = await chatAuthorizationHeaders(requireSupabase(), { required: true })
  const apiBaseUrl = ((import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
  const response = await fetch(`${apiBaseUrl}/api/profile-publication`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authorization }, body: JSON.stringify({ action, slug }),
  })
  const result = await response.json() as { error?: string; profile?: unknown; publicUrl?: string; available?: boolean; slug?: string }
  if (!response.ok) throw new Error(result.error ?? 'Could not update profile publication.')
  return result
}
