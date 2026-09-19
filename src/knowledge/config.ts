export const KNOWLEDGE_CONFIG = {
  embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
  embeddingDimensions: 1536,
  indexingVersion: 'profile-knowledge-v1',
  maximumChunkCharacters: 1_800,
  chunkOverlapCharacters: 200,
  embeddingBatchSize: 64,
} as const

export function embeddingVersion(): string {
  return `${KNOWLEDGE_CONFIG.embeddingModel}:${KNOWLEDGE_CONFIG.embeddingDimensions}:${KNOWLEDGE_CONFIG.indexingVersion}`
}
