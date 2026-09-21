import { handleResumeMappingRequest } from '../../src/onboarding/server/request.ts'

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
  const result = await handleResumeMappingRequest(request.headers?.authorization, request.body)
  return response.status(result.status).json(result.body)
}
