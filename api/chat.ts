import { RAG_CONFIG } from '../src/rag/config.ts'
import { InvalidAuthenticationError, ProfileAccessError, ProfileAiUnavailableError, ProfileChatLimitError } from '../src/rag/chatService.ts'
import { createServerChatService } from '../src/rag/serverChat.ts'
import { parseChatHistory } from '../src/rag/history.ts'

interface ApiRequest { method?: string; body?: unknown; headers?: { origin?: string; authorization?: string } }
interface ApiResponse {
  status(code: number): ApiResponse
  end(): void
  json(body: unknown): void
  setHeader(name: string, value: string): void
}

const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
)

export default async function handler(request: ApiRequest, response: ApiResponse) {
  const origin = request.headers?.origin
  if (origin && allowedOrigins.has(origin)) response.setHeader('Access-Control-Allow-Origin', origin)
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  response.setHeader('Vary', 'Origin')
  response.setHeader('Cache-Control', 'no-store')
  if (request.method === 'OPTIONS') return response.status(204).end()
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })

  const body = request.body as { message?: unknown; profileSlug?: unknown; history?: unknown } | null
  if (!body || typeof body !== 'object' || typeof body.message !== 'string' || typeof body.profileSlug !== 'string') {
    return response.status(400).json({ error: 'Request body must contain message and profileSlug strings' })
  }

  const message = body.message.trim()
  if (!message) return response.status(400).json({ error: 'Message cannot be empty' })
  if (message.length > RAG_CONFIG.maximumQuestionLength) {
    return response.status(400).json({ error: `Message must be ${RAG_CONFIG.maximumQuestionLength} characters or fewer` })
  }
  const profileSlug = body.profileSlug.trim()
  if (!profileSlug) return response.status(400).json({ error: 'Profile slug cannot be empty' })
  const history = parseChatHistory(body.history)
  if (history === null) return response.status(400).json({ error: 'History must contain valid user and assistant messages' })

  try {
    return response.status(200).json(await createServerChatService().ask(message, profileSlug, request.headers?.authorization, history))
  } catch (error) {
    if (error instanceof InvalidAuthenticationError) return response.status(401).json({ error: 'Invalid authentication' })
    if (error instanceof ProfileAccessError) return response.status(404).json({ error: 'Profile not found' })
    if (error instanceof ProfileAiUnavailableError) return response.status(409).json({ error: 'AI profile is not ready' })
    if (error instanceof ProfileChatLimitError) return response.status(402).json({ code: 'rag_limit_reached', error: error.message })
    console.error('Portfolio chat request failed', error instanceof Error ? error.message : 'Unknown error')
    return response.status(500).json({ error: 'Unable to answer the question right now' })
  }
}
