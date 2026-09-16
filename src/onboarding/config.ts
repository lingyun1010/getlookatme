export const ONBOARDING_MAPPING_CONFIG = {
  model: process.env.OPENAI_ONBOARDING_MODEL ?? 'gpt-5-mini',
  maximumResumeTextLength: 40_000,
  requestTimeoutMs: 20_000,
} as const

export function llmMappingEnabled(environment: NodeJS.ProcessEnv = process.env): boolean {
  return environment.ONBOARDING_LLM_ENABLED !== 'false' && Boolean(environment.OPENAI_API_KEY)
}
