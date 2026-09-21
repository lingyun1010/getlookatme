import type { ChatMessage } from '../rag/types.ts'

export interface ChatTransferState { profileSlug: string; messages: ChatMessage[] }

export function transferConversation(profileSlug: string, messages: ChatMessage[]): void {
  history.pushState({ lookAtMeChat: { profileSlug, messages } satisfies ChatTransferState }, '', `/${encodeURIComponent(profileSlug)}/chat`)
  window.location.reload()
}

export function consumeTransferredConversation(profileSlug: string): ChatMessage[] {
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  const transfer = (history.state as { lookAtMeChat?: ChatTransferState } | null)?.lookAtMeChat
  history.replaceState(null, '', window.location.href)
  if (navigation?.type === 'reload' && transfer?.profileSlug === profileSlug) return transfer.messages
  return []
}
