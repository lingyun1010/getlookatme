export const RAG_CONFIG = {
  embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
  answerModel: process.env.OPENAI_ANSWER_MODEL ?? 'gpt-5-mini',
  topK: 4,
  profileSearchLimit: 5,
  minimumProfileSimilarity: 0.3,
  minimumSimilarity: 0.3,
  minimumIntentSimilarity: 0.17,
  intentTypeBoost: 1.18,
  maximumQuestionLength: 500,
} as const
