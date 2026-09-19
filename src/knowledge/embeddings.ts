import OpenAI from 'openai'
import { KNOWLEDGE_CONFIG, embeddingVersion } from './config.ts'
import type { EmbeddingClient } from './types.ts'

export class OpenAIEmbeddingClient implements EmbeddingClient {
  readonly version = embeddingVersion()
  private readonly client: OpenAI

  constructor(apiKey = process.env.OPENAI_API_KEY) {
    if (!apiKey) throw new Error('OPENAI_API_KEY is required to index profile knowledge.')
    this.client = new OpenAI({ apiKey })
  }

  async embedTexts(inputs: string[]): Promise<number[][]> {
    if (!inputs.length) return []
    const output: number[][] = []
    for (let start = 0; start < inputs.length; start += KNOWLEDGE_CONFIG.embeddingBatchSize) {
      const response = await this.client.embeddings.create({
        model: KNOWLEDGE_CONFIG.embeddingModel,
        dimensions: KNOWLEDGE_CONFIG.embeddingDimensions,
        input: inputs.slice(start, start + KNOWLEDGE_CONFIG.embeddingBatchSize),
        encoding_format: 'float',
      })
      output.push(...response.data.sort((left, right) => left.index - right.index).map(({ embedding }) => embedding))
    }
    if (output.length !== inputs.length) throw new Error(`Embedding provider returned ${output.length} vectors for ${inputs.length} inputs.`)
    return output
  }

  async embedText(input: string): Promise<number[]> {
    const [embedding] = await this.embedTexts([input])
    return embedding
  }
}
