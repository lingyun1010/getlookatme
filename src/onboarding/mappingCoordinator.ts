import { LLMResumeMappingService } from './llmClient.ts'
import { DeterministicResumeMappingService } from './parser.ts'
import type { ExtractedResumeText, MappingDiagnostic, ParsedResume, ResumeMappingService } from './types.ts'

export const FALLBACK_WARNING = 'AI-assisted parsing was unavailable. A basic parser was used instead; please review the extracted information carefully.'

export class PreferredResumeMappingService implements ResumeMappingService {
  private readonly preferred: ResumeMappingService
  private readonly fallback: ResumeMappingService
  private readonly preferLlm: boolean
  private readonly diagnostic?: MappingDiagnostic

  constructor(
    preferred: ResumeMappingService,
    fallback: ResumeMappingService,
    preferLlm = true,
    diagnostic?: MappingDiagnostic,
  ) {
    this.preferred = preferred
    this.fallback = fallback
    this.preferLlm = preferLlm
    this.diagnostic = diagnostic
  }

  async mapResume(extracted: ExtractedResumeText): Promise<ParsedResume> {
    if (this.preferLlm) {
      this.diagnostic?.('Mapper selected', { mapper: 'llm', sourceType: extracted.sourceType })
      try {
        const parsed = await this.preferred.mapResume(extracted)
        this.diagnostic?.('Mapper completed', { mapper: parsed.mapping.mapper })
        return parsed
      } catch (error) {
        this.diagnostic?.('Deterministic fallback activated', {
          reason: error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown error',
        })
        const parsed = await this.fallback.mapResume(extracted)
        this.diagnostic?.('Mapper completed', { mapper: parsed.mapping.mapper })
        return { ...parsed, warnings: [...parsed.warnings, FALLBACK_WARNING] }
      }
    }
    this.diagnostic?.('Mapper selected', { mapper: 'deterministic', sourceType: extracted.sourceType })
    const parsed = await this.fallback.mapResume(extracted)
    this.diagnostic?.('Mapper completed', { mapper: parsed.mapping.mapper })
    return parsed
  }
}

export function createResumeMappingService(options: {
  llmEnabled?: boolean
  llm?: ResumeMappingService
  deterministic?: ResumeMappingService
  diagnostic?: MappingDiagnostic
} = {}): ResumeMappingService {
  const clientEnvironment = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
  const enabled = options.llmEnabled ?? clientEnvironment?.VITE_ONBOARDING_LLM_ENABLED !== 'false'
  const apiBaseUrl = (clientEnvironment?.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
  const configuredTimeout = Number(clientEnvironment?.VITE_ONBOARDING_LLM_TIMEOUT_MS)
  const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 60_000
  const developmentDiagnostic: MappingDiagnostic | undefined = clientEnvironment?.DEV
    ? (event, details) => console.info(`[onboarding] ${event}`, details ?? {})
    : undefined
  const diagnostic = options.diagnostic ?? developmentDiagnostic
  return new PreferredResumeMappingService(
    options.llm ?? new LLMResumeMappingService(`${apiBaseUrl}/api/onboarding/map-resume`, fetch, timeoutMs, diagnostic),
    options.deterministic ?? new DeterministicResumeMappingService(),
    enabled,
    diagnostic,
  )
}
