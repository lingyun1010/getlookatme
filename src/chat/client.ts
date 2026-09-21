import { chatAuthorizationHeaders } from '../auth/chatSession.ts'
import { isSupabaseConfigured, requireSupabase } from '../auth/supabase.ts'
import { CHAT_LIMITS } from '../rag/limits.ts'
import type { ChatHistoryMessage, PortfolioAnswer } from '../rag/types.ts'

export async function askProfile(
  profileSlug: string,
  message: string,
  history: ChatHistoryMessage[] = [],
  requireAuthorization = false,
): Promise<PortfolioAnswer> {
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
  const authorizationHeaders = isSupabaseConfigured
    ? await chatAuthorizationHeaders(requireSupabase(), { required: requireAuthorization })
    : {}
  const response = await fetch(`${apiBaseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authorizationHeaders },
    body: JSON.stringify({ message, profileSlug, history: history.slice(-CHAT_LIMITS.maximumHistoryMessages) }),
  })
  const result = await response.json().catch(() => null) as (PortfolioAnswer & { error?: string }) | null
  if (!response.ok) throw new Error(result?.error ?? 'Chat request failed')
  if (!result || typeof result.answer !== 'string' || !Array.isArray(result.evidence) || !Array.isArray(result.sources)) {
    throw new Error('Unexpected chat response')
  }
  return result
}
