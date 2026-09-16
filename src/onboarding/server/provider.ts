import OpenAI from 'openai'
import { ONBOARDING_MAPPING_CONFIG } from '../config.ts'
import { RESUME_OUTPUT_SCHEMA } from '../llmSchema.ts'
import { RESUME_MAPPING_PROMPT } from './prompt.ts'

export interface ResumeLlmProvider {
  mapResumeText(text: string): Promise<unknown>
}

export class OpenAIResumeLlmProvider implements ResumeLlmProvider {
  private readonly apiKey: string | undefined
  private readonly model: string

  constructor(
    apiKey = process.env.OPENAI_API_KEY,
    model = ONBOARDING_MAPPING_CONFIG.model,
  ) {
    this.apiKey = apiKey
    this.model = model
  }

  async mapResumeText(text: string): Promise<unknown> {
    if (!this.apiKey) throw new Error('Onboarding LLM is not configured')
    const client = new OpenAI({ apiKey: this.apiKey })
    const response = await client.responses.create({
      model: this.model,
      store: false,
      instructions: RESUME_MAPPING_PROMPT,
      input: `Resume text begins after the delimiter.\n---BEGIN RESUME---\n${text}\n---END RESUME---`,
      text: { format: { type: 'json_schema', name: 'parsed_resume', strict: true, schema: RESUME_OUTPUT_SCHEMA } },
    })
    if (!response.output_text) throw new Error('Model returned an empty response')
    return JSON.parse(response.output_text) as unknown
  }
}
