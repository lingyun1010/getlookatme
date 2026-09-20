import type { ProfileDocument } from '../profile/types.ts'

export type KnowledgeSourceType = 'profile' | 'experience' | 'project' | 'skill' | 'education' | 'service' | 'highlight' | 'publication' | 'manual' | (string & {})
export type KnowledgeSourceStatus = 'active' | 'stale' | 'failed'
export type KnowledgeMetadata = Record<string, string | number | boolean | string[] | null | undefined>

export interface BuiltKnowledgeSource {
  sourceType: KnowledgeSourceType
  sourceRef: string
  title: string
  section: string
  content: string
  metadata: KnowledgeMetadata
  contentHash: string
}

export interface BuiltKnowledgeChunk {
  chunkIndex: number
  content: string
  contentHash: string
  metadata: KnowledgeMetadata
}

export interface StoredKnowledgeChunk {
  id: string
  chunkIndex: number
  contentHash: string
  embeddingVersion: string
}

export interface StoredKnowledgeSource {
  id: string
  profileId: string
  sourceType: string
  sourceRef: string
  contentHash: string
  status: KnowledgeSourceStatus
  chunks: StoredKnowledgeChunk[]
}

export interface KnowledgeSyncPlan {
  newSources: BuiltKnowledgeSource[]
  changedSources: Array<{ source: BuiltKnowledgeSource; persisted: StoredKnowledgeSource }>
  unchangedSources: Array<{ source: BuiltKnowledgeSource; persisted: StoredKnowledgeSource }>
  deletedSources: StoredKnowledgeSource[]
}

export interface PersistedChunkInput extends BuiltKnowledgeChunk {
  profileId: string
  sourceId: string
  sourceType: string
  sourceRef: string
  section: string
  embedding: number[]
  embeddingVersion: string
}

export interface KnowledgeRepository {
  loadProfile(profileId: string): Promise<ProfileDocument>
  listSources(profileId: string): Promise<StoredKnowledgeSource[]>
  upsertSource(profileId: string, source: BuiltKnowledgeSource): Promise<string>
  replaceChunks(sourceId: string, chunks: PersistedChunkInput[]): Promise<void>
  deleteSources(profileId: string, sourceIds: string[]): Promise<void>
  getStatus(profileId: string): Promise<KnowledgeStatus>
  search(profileId: string, queryEmbedding: number[], limit?: number): Promise<KnowledgeSearchResult[]>
}

export interface EmbeddingClient {
  readonly version: string
  embedTexts(inputs: string[]): Promise<number[][]>
  embedText(input: string): Promise<number[]>
}

export interface KnowledgeSyncResult {
  profileId: string
  newSources: number
  changedSources: number
  unchangedSources: number
  deletedSources: number
  embeddingsGenerated: number
  sourceCount: number
  chunkCount: number
  lastIndexedAt: string | null
}

export interface KnowledgeStatus {
  profileId: string
  sourceCount: number
  chunkCount: number
  failedSourceCount: number
  lastIndexedAt: string | null
}

export interface KnowledgeSearchResult {
  profileId?: string
  chunkId: string
  sourceId: string
  content: string
  similarity: number
  sourceType: string
  sourceRef: string
  section: string
  title: string | null
  metadata: KnowledgeMetadata
}
