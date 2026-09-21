import { CHAT_LIMITS } from './limits.ts'
import type { ChatHistoryMessage } from './types.ts'

export function parseChatHistory(value: unknown): ChatHistoryMessage[] | null {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > CHAT_LIMITS.maximumHistoryMessages) return null
  const valid = value.every((item) => item && typeof item === 'object'
    && ((item as ChatHistoryMessage).role === 'user' || (item as ChatHistoryMessage).role === 'assistant')
    && typeof (item as ChatHistoryMessage).content === 'string'
    && (item as ChatHistoryMessage).content.trim().length > 0
    && (item as ChatHistoryMessage).content.length <= CHAT_LIMITS.maximumHistoryMessageLength)
  return valid ? value.map((item) => ({ role: item.role, content: item.content.trim() })) as ChatHistoryMessage[] : null
}
