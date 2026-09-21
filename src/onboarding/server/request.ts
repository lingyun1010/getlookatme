import type { ServerMappingDiagnostic } from './service.ts'
import { mapResumeOnServer, ResumeMappingInputError, ResumeMappingOutputError } from './service.ts'
import { authenticateBearer, createAuthenticatedServerClient, createServiceRoleServerClient } from '../../auth/server.ts'
import { recordUsageSafely } from '../../monetisation/usage.ts'

export async function handleResumeMappingRequest(
  authorization: string | undefined,
  input: unknown,
  diagnostic?: ServerMappingDiagnostic,
): Promise<{ status: number; body: unknown }> {
  const user = await authenticateBearer(authorization)
  const ownerClient = createAuthenticatedServerClient(authorization)
  if (!user || !ownerClient) return { status: 401, body: { error: 'Authentication required' } }
  const body = input as { text?: unknown; sourceType?: unknown } | null
  if (!body || typeof body !== 'object') return { status: 400, body: { error: 'Invalid request body' } }
  try {
    const parsedResume = await mapResumeOnServer({ text: body.text, sourceType: body.sourceType }, { diagnostic })
    const { data: profile } = await ownerClient.from('profiles').select('id').eq('user_id', user.id).order('created_at').limit(1).maybeSingle()
    const usageClient = createServiceRoleServerClient()
    if (profile?.id && usageClient) await recordUsageSafely(usageClient, { userId: user.id, profileId: profile.id, eventType: 'cv_parse' })
    return { status: 200, body: { parsedResume, mapper: 'llm' } }
  } catch (error) {
    const inputError = error instanceof ResumeMappingInputError
    const category = inputError ? 'input_validation' : error instanceof ResumeMappingOutputError ? 'output_validation' : 'provider'
    console.error('Onboarding resume mapping failed', { mapper: 'llm', category, fallback: 'client_deterministic' })
    return { status: inputError ? 400 : 503, body: { error: inputError ? error.message : 'AI-assisted resume mapping is unavailable', category } }
  }
}
