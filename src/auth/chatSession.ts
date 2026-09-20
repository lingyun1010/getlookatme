export interface ChatSessionClient {
  auth: {
    getSession(): Promise<{
      data: { session: { access_token?: string; expires_at?: number } | null }
      error: unknown
    }>
    getUser(jwt?: string): Promise<{
      data: { user: { id: string } | null }
      error: unknown
    }>
  }
}

export async function chatAuthorizationHeaders(
  client: ChatSessionClient,
  options: { required?: boolean; nowSeconds?: number } = {},
): Promise<Record<string, string>> {
  const { data, error } = await client.auth.getSession()
  const session = error ? null : data.session
  const token = session?.access_token?.trim()
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000)
  const unexpired = Boolean(token && (!session?.expires_at || session.expires_at > now))
  if (unexpired) {
    const verified = await client.auth.getUser(token)
    if (!verified.error && verified.data.user) return { Authorization: `Bearer ${token}` }
  }
  if (options.required) throw new Error('A valid authenticated session is required for profile preview chat.')
  return {}
}
