import type { ExtractedResumeText, MappingDiagnostic, ParsedResume, ResumeMappingService } from './types.ts'
import { validateParsedResumeResponse } from './llmSchema.ts'

export class LLMResumeMappingService implements ResumeMappingService {
  private readonly endpoint: string
  private readonly fetcher: typeof fetch
  private readonly timeoutMs: number
  private readonly diagnostic?: MappingDiagnostic

  constructor(
    endpoint = '/api/onboarding/map-resume',
    fetcher: typeof fetch = fetch,
    timeoutMs = 60_000,
    diagnostic?: MappingDiagnostic,
  ) {
    this.endpoint = endpoint
    this.fetcher = fetcher.bind(globalThis)
    this.timeoutMs = timeoutMs
    this.diagnostic = diagnostic
  }

  async mapResume(extracted: ExtractedResumeText): Promise<ParsedResume> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      this.diagnostic?.('LLM mapper invoked', { endpoint: this.endpoint, sourceType: extracted.sourceType, textLength: extracted.text.length })
      const response = await this.fetcher(this.endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ text: extracted.text, sourceType: extracted.sourceType }),
      })
      this.diagnostic?.('LLM mapper response received', { endpoint: this.endpoint, status: response.status, ok: response.ok })
      if (!response.ok) throw new Error(`Resume mapper returned ${response.status}`)
      const body = await response.json() as { parsedResume?: unknown }
      if (!body.parsedResume || typeof body.parsedResume !== 'object') throw new Error('Resume mapper returned an empty response')
      const parsed = validateParsedResumeResponse(body.parsedResume)
      this.diagnostic?.('LLM mapper response validated', { mapper: parsed.mapping.mapper })
      return parsed
    } catch (error) {
      this.diagnostic?.('LLM mapper failed', {
        endpoint: this.endpoint,
        reason: error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown error',
      })
      throw error
    } finally {
      clearTimeout(timer)
    }
  }
}
