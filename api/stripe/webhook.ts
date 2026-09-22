import type { IncomingMessage } from 'node:http'
import { createServiceRoleServerClient } from '../../src/auth/server.ts'
import { handleStripeWebhook } from '../../src/billing/stripeWebhook.ts'

export const config = {
  api: {
    bodyParser: false,
  },
}

interface VercelResponse {
  status(code: number): VercelResponse
  end(): void
  json(body: unknown): void
  setHeader(name: string, value: string): void
}

async function readRawBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

export default async function handler(request: IncomingMessage & { method?: string; headers: IncomingMessage['headers'] }, response: VercelResponse) {
  response.setHeader('Cache-Control', 'no-store')
  if (request.method === 'OPTIONS') return response.status(204).end()
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })

  const client = createServiceRoleServerClient()
  if (!client) return response.status(503).json({ error: 'Billing is unavailable.' })

  const signatureHeader = request.headers['stripe-signature']
  const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader
  const rawBody = await readRawBody(request)
  const result = await handleStripeWebhook(rawBody, signature, client)
  return response.status(result.status).json(result.body)
}
