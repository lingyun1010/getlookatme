import { mapResumeOnServer, ResumeMappingInputError, ResumeMappingOutputError } from '../../src/onboarding/server/service.ts'
import { authenticateBearer } from '../../src/auth/server.ts'

interface ApiRequest { method?: string; body?: unknown; headers?: { origin?: string; authorization?: string } }
interface ApiResponse { status(code: number): ApiResponse; end(): void; json(body: unknown): void; setHeader(name: string, value: string): void }

const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174').split(',').map((value) => value.trim()).filter(Boolean))

export default async function handler(request: ApiRequest, response: ApiResponse) {
  const origin = request.headers?.origin
  if (origin && allowedOrigins.has(origin)) response.setHeader('Access-Control-Allow-Origin', origin)
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('Vary', 'Origin')
  if (request.method === 'OPTIONS') return response.status(204).end()
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })
  if (!await authenticateBearer(request.headers?.authorization)) return response.status(401).json({ error: 'Authentication required' })
  const body = request.body as { text?: unknown; sourceType?: unknown } | null
  if (!body || typeof body !== 'object') return response.status(400).json({ error: 'Invalid request body' })
  try {
    const parsedResume = await mapResumeOnServer({ text: body.text, sourceType: body.sourceType })
    return response.status(200).json({ parsedResume, mapper: 'llm' })
  } catch (error) {
    const inputError = error instanceof ResumeMappingInputError
    const category = inputError ? 'input_validation' : error instanceof ResumeMappingOutputError ? 'output_validation' : 'provider'
    console.error('Onboarding resume mapping failed', { mapper: 'llm', category, fallback: 'client_deterministic' })
    return response.status(inputError ? 400 : 503).json({ error: inputError ? error.message : 'AI-assisted resume mapping is unavailable', category })
  }
}
