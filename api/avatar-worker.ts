import { processNextAvatarJob } from '../src/avatar/worker.ts'

interface ApiRequest { method?: string; headers?: { authorization?: string } }
interface ApiResponse { status(code: number): ApiResponse; json(body: unknown): void; setHeader(name: string, value: string): void }

export const config = { maxDuration: 800 }

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store')
  if (request.method !== 'GET' && request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers?.authorization !== `Bearer ${secret}`) return response.status(401).json({ error: 'Worker authorization required' })
  return response.status(200).json(await processNextAvatarJob())
}
