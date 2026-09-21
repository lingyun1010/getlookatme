export type KnowledgeChunkType =
  | 'summary'
  | 'skill'
  | 'experience'
  | 'education'
  | 'project'
  | 'service'
  | 'highlight'

export interface KnowledgeChunkMetadata {
  sourceId?: string
  category?: string
  technologies?: string[]
  dates?: string[]
  urls?: string[]
}

export interface KnowledgeChunk {
  id: string
  type: KnowledgeChunkType
  title: string
  content: string
  metadata: KnowledgeChunkMetadata
}

export interface IndexedKnowledgeChunk {
  chunk: KnowledgeChunk
  embedding: number[]
}

export interface RagIndex {
  version: 1
  embeddingModel: string
  items: IndexedKnowledgeChunk[]
}

export interface RetrievalResult {
  chunk: KnowledgeChunk
  vectorScore: number
  finalScore: number
  intentMatched: boolean
}

export interface PortfolioAnswerSource {
  id: string
  type: string
  title: string
}

export interface PortfolioAnswerEvidence {
  chunkId: string
  sourceId: string
  sourceType: string
  sourceRef: string
  section: string
  title: string | null
  metadata: Record<string, unknown>
}

export interface PortfolioAnswer {
  answer: string
  evidence: PortfolioAnswerEvidence[]
  sources: PortfolioAnswerSource[]
  relatedIds: string[]
  confidence: 'high' | 'medium' | 'low'
  noAnswer: boolean
}

export type ChatRole = 'user' | 'assistant'

export interface ChatHistoryMessage {
  role: ChatRole
  content: string
}

export interface ChatMessage extends ChatHistoryMessage {
  id: string
  evidence?: PortfolioAnswerEvidence[]
  sources?: PortfolioAnswerSource[]
  relatedIds?: string[]
}
