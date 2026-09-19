import { chunkKnowledgeSource } from './chunker.ts'
import type { BuiltKnowledgeSource, KnowledgeSyncPlan, StoredKnowledgeSource } from './types.ts'

const key = (source: Pick<BuiltKnowledgeSource, 'sourceType' | 'sourceRef'> | Pick<StoredKnowledgeSource, 'sourceType' | 'sourceRef'>) =>
  `${source.sourceType}\u0000${source.sourceRef}`

export function planKnowledgeSync(
  built: BuiltKnowledgeSource[],
  persisted: StoredKnowledgeSource[],
  embeddingVersion: string,
): KnowledgeSyncPlan {
  const existingByKey = new Map(persisted.map((source) => [key(source), source]))
  const newSources: BuiltKnowledgeSource[] = []
  const changedSources: KnowledgeSyncPlan['changedSources'] = []
  const unchangedSources: KnowledgeSyncPlan['unchangedSources'] = []

  for (const source of built) {
    const existing = existingByKey.get(key(source))
    if (!existing) newSources.push(source)
    else {
      existingByKey.delete(key(source))
      const expectedChunks = chunkKnowledgeSource(source)
      const chunksCurrent = existing.chunks.length === expectedChunks.length && expectedChunks.every((chunk) => {
        const persistedChunk = existing.chunks.find(({ chunkIndex }) => chunkIndex === chunk.chunkIndex)
        return persistedChunk?.contentHash === chunk.contentHash && persistedChunk.embeddingVersion === embeddingVersion
      })
      if (existing.contentHash === source.contentHash && existing.status === 'active' && chunksCurrent) unchangedSources.push({ source, persisted: existing })
      else changedSources.push({ source, persisted: existing })
    }
  }

  return { newSources, changedSources, unchangedSources, deletedSources: [...existingByKey.values()] }
}
