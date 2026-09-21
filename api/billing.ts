import { authenticateBearer, createServiceRoleServerClient } from '../src/auth/server.ts'
import { MockBillingProvider, mockBillingEnabled } from '../src/billing/mock.ts'

interface ApiRequest { method?: string; body?: unknown; headers?: { authorization?: string } }
interface ApiResponse { status(code: number): ApiResponse; end(): void; json(body: unknown): void; setHeader(name: string, value: string): void }

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Allow', 'POST, OPTIONS')
  response.setHeader('Cache-Control', 'no-store')
  if (request.method === 'OPTIONS') return response.status(204).end()
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })
  if (!mockBillingEnabled()) return response.status(404).json({ error: 'Mock billing is available only in explicitly enabled development environments.' })
  const user = await authenticateBearer(request.headers?.authorization)
  const client = createServiceRoleServerClient()
  if (!user || !client) return response.status(401).json({ error: 'Authentication required' })
  const body = request.body as { action?: unknown; sessionId?: unknown } | null
  const provider = new MockBillingProvider(client)
  try {
    if (body?.action === 'start') return response.status(200).json({ session: await provider.createCheckoutSession(user.id) })
    if (body?.action === 'complete' && typeof body.sessionId === 'string') {
      await provider.completeCheckoutSession(user.id, body.sessionId)
      return response.status(200).json({ status: 'active', plan: 'pro' })
    }
    if (body?.action === 'cancel') { await provider.cancelSubscription(user.id); return response.status(200).json({ status: 'cancelled' }) }
    if (body?.action === 'reactivate') { await provider.reactivateSubscription(user.id); return response.status(200).json({ status: 'active', plan: 'pro' }) }
    return response.status(400).json({ error: 'Unsupported billing action.' })
  } catch (error) {
    console.error('Mock billing request failed', error instanceof Error ? error.name : 'UnknownError')
    return response.status(400).json({ error: error instanceof Error ? error.message : 'Mock billing failed.' })
  }
}
