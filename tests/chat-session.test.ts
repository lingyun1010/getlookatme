import assert from 'node:assert/strict'
import test from 'node:test'
import { chatAuthorizationHeaders, type ChatSessionClient } from '../src/auth/chatSession.ts'

function client(options: {
  token?: string
  expiresAt?: number
  sessionError?: unknown
  userId?: string
  userError?: unknown
}): ChatSessionClient {
  return {
    auth: {
      async getSession() {
        return {
          data: { session: options.token ? { access_token: options.token, expires_at: options.expiresAt } : null },
          error: options.sessionError ?? null,
        }
      },
      async getUser(jwt) {
        assert.equal(jwt, options.token)
        return { data: { user: options.userId ? { id: options.userId } : null }, error: options.userError ?? null }
      },
    },
  }
}

test('published profile with no session sends no Authorization header', async () => {
  assert.deepEqual(await chatAuthorizationHeaders(client({})), {})
})

test('a valid owner session attaches its verified bearer token', async () => {
  const headers = await chatAuthorizationHeaders(client({ token: 'owner-token', expiresAt: 2_000, userId: 'owner' }), {
    required: true, nowSeconds: 1_000,
  })
  assert.deepEqual(headers, { Authorization: 'Bearer owner-token' })
})

test('expired, empty, cached-invalid, and unavailable sessions never send malformed authorization', async () => {
  const cases = [
    client({ token: 'expired', expiresAt: 999, userId: 'owner' }),
    client({ token: '   ', expiresAt: 2_000, userId: 'owner' }),
    client({ token: 'stale', expiresAt: 2_000, userError: new Error('invalid JWT') }),
    client({ sessionError: new Error('storage unavailable') }),
  ]
  for (const value of cases) assert.deepEqual(await chatAuthorizationHeaders(value, { nowSeconds: 1_000 }), {})
})

test('owner preview refuses to continue without a verified session', async () => {
  await assert.rejects(chatAuthorizationHeaders(client({ token: 'stale', userError: new Error('invalid JWT') }), { required: true }))
})
