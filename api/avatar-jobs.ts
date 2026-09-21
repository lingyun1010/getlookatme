import { handleAvatarJobRequest } from '../src/avatar/jobRequest.ts'

interface ApiRequest { method?: string; body?: unknown; headers?: { authorization?: string } }
interface ApiResponse { status(code: number): ApiResponse; end(): void; json(body: unknown): void; setHeader(name: string, value: string): void }

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Allow', 'POST, OPTIONS')
  response.setHeader('Cache-Control', 'no-store')
  if (request.method === 'OPTIONS') return response.status(204).end()
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })
  const result = await handleAvatarJobRequest(request.headers?.authorization, request.body)
  return response.status(result.status).json(result.body)
}
