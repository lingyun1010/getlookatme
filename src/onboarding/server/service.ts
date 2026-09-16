import { ONBOARDING_MAPPING_CONFIG, llmMappingEnabled } from '../config.ts'
import { parseLlmResumeOutput } from '../llmSchema.ts'
import type { ParsedResume, ResumeSourceType } from '../types.ts'
import { OpenAIResumeLlmProvider, type ResumeLlmProvider } from './provider.ts'

export class ResumeMappingInputError extends Error {}
export class ResumeMappingOutputError extends Error {}

export interface ServerMappingDiagnostic {
  (event: 'provider_request_success' | 'provider_request_failure', details: {
    category: 'success' | 'provider'
    providerStatus?: number
    providerCode?: string
    errorName?: string
  }): void
}

export function sanitizeResumeText(value: unknown): string {
  if (typeof value !== 'string') throw new ResumeMappingInputError('Resume text must be a string')
  const normalized = value.replace(/\0/g, '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\r\n?/g, '\n').trim()
  if (!normalized) throw new ResumeMappingInputError('Resume text cannot be empty')
  if (normalized.length > ONBOARDING_MAPPING_CONFIG.maximumResumeTextLength) {
    throw new ResumeMappingInputError(`Resume text must be ${ONBOARDING_MAPPING_CONFIG.maximumResumeTextLength} characters or fewer`)
  }
  return normalized
}

export async function mapResumeOnServer(
  input: { text: unknown; sourceType: unknown },
  options: { provider?: ResumeLlmProvider; environment?: NodeJS.ProcessEnv; diagnostic?: ServerMappingDiagnostic } = {},
): Promise<ParsedResume> {
  if (!['pdf', 'docx', 'text'].includes(input.sourceType as ResumeSourceType)) throw new ResumeMappingInputError('Invalid resume source type')
  const text = sanitizeResumeText(input.text)
  if (!options.provider && !llmMappingEnabled(options.environment)) throw new Error('Onboarding LLM is not configured')
  let output: unknown
  try {
    output = await (options.provider ?? new OpenAIResumeLlmProvider()).mapResumeText(text)
    options.diagnostic?.('provider_request_success', { category: 'success' })
  } catch (error) {
    const providerError = error as { status?: unknown; code?: unknown; name?: unknown }
    options.diagnostic?.('provider_request_failure', {
      category: 'provider',
      providerStatus: typeof providerError?.status === 'number' ? providerError.status : undefined,
      providerCode: typeof providerError?.code === 'string' ? providerError.code : undefined,
      errorName: typeof providerError?.name === 'string' ? providerError.name : 'UnknownError',
    })
    throw error
  }
  try {
    return parseLlmResumeOutput(output)
  } catch (error) {
    throw new ResumeMappingOutputError(error instanceof Error ? error.message : 'Model output validation failed')
  }
}
