import { buildKnowledgeSources } from './builder.ts'
import { chunkKnowledgeSource } from './chunker.ts'
import { planKnowledgeSync } from './planner.ts'
import type { BuiltKnowledgeSource, EmbeddingClient, KnowledgeRepository, KnowledgeSyncResult, PersistedChunkInput } from './types.ts'

async function indexSource(
  profileId: string,
  source: BuiltKnowledgeSource,
  repository: KnowledgeRepository,
  embeddings: EmbeddingClient,
): Promise<number> {
  const chunks = chunkKnowledgeSource(source)
  const vectors = await embeddings.embedTexts(chunks.map(({ content }) => content))
  const sourceId = await repository.upsertSource(profileId, source)
  const persisted: PersistedChunkInput[] = chunks.map((chunk, index) => ({
    ...chunk,
    profileId,
    sourceId,
    sourceType: source.sourceType,
    sourceRef: source.sourceRef,
    section: source.section,
    embedding: vectors[index],
    embeddingVersion: embeddings.version,
  }))
  await repository.replaceChunks(sourceId, persisted)
  return chunks.length
}

export async function syncProfileKnowledge(
  profileId: string,
  repository: KnowledgeRepository,
  embeddings: EmbeddingClient,
): Promise<KnowledgeSyncResult> {
  if (!profileId) throw new Error('A profile ID is required for knowledge sync.')
  const profile = await repository.loadProfile(profileId)
  if (profile.profileId !== profileId) throw new Error('Profile document identity does not match the requested profile.')
  const built = buildKnowledgeSources(profile)
  const existing = await repository.listSources(profileId)
  const plan = planKnowledgeSync(built, existing, embeddings.version)
  let embeddingsGenerated = 0

  for (const source of plan.newSources) embeddingsGenerated += await indexSource(profileId, source, repository, embeddings)
  for (const { source } of plan.changedSources) embeddingsGenerated += await indexSource(profileId, source, repository, embeddings)
  await repository.deleteSources(profileId, plan.deletedSources.map(({ id }) => id))

  const status = await repository.getStatus(profileId)
  return {
    profileId,
    newSources: plan.newSources.length,
    changedSources: plan.changedSources.length,
    unchangedSources: plan.unchangedSources.length,
    deletedSources: plan.deletedSources.length,
    embeddingsGenerated,
    sourceCount: status.sourceCount,
    chunkCount: status.chunkCount,
    lastIndexedAt: status.lastIndexedAt,
  }
}
