import type { EmbeddingClient, KnowledgeRepository, KnowledgeSyncResult } from '../knowledge/types.ts'
import { syncProfileKnowledge } from '../knowledge/sync.ts'
import type { ProfileAiStatus } from './types.ts'

export interface AiProfileState { id: string; userId: string; enabled: boolean; status: ProfileAiStatus; isPublished: boolean }
export interface AiStateRepository {
  findOwnedProfile(userId: string): Promise<AiProfileState | null>
  updateState(profileId: string, userId: string, values: { enabled?: boolean; status?: ProfileAiStatus; lastIndexedAt?: string | null; lastError?: string | null }): Promise<AiProfileState>
}
export interface AiLifecycleDependencies { state: AiStateRepository; knowledge: KnowledgeRepository; embeddings: EmbeddingClient; now(): string; recordEmbeddingUsage?(profile: AiProfileState, quantity: number): Promise<void> }
export class AiLifecycleError extends Error {}

async function owned(userId: string, state: AiStateRepository) {
  const profile = await state.findOwnedProfile(userId)
  if (!profile) throw new AiLifecycleError('Profile not found.')
  return profile
}

async function index(profile: AiProfileState, dependencies: AiLifecycleDependencies): Promise<{ profile: AiProfileState; sync: KnowledgeSyncResult }> {
  await dependencies.state.updateState(profile.id, profile.userId, { enabled: true, status: 'indexing', lastError: null })
  try {
    const sync = await syncProfileKnowledge(profile.id, dependencies.knowledge, dependencies.embeddings)
    if (sync.embeddingsGenerated > 0) await dependencies.recordEmbeddingUsage?.(profile, sync.embeddingsGenerated)
    if (sync.sourceCount === 0 || sync.chunkCount === 0) throw new Error('No usable profile knowledge was produced.')
    const ready = await dependencies.state.updateState(profile.id, profile.userId, { enabled: true, status: 'ready', lastIndexedAt: dependencies.now(), lastError: null })
    return { profile: ready, sync }
  } catch {
    await dependencies.state.updateState(profile.id, profile.userId, { enabled: true, status: 'failed', lastError: 'AI profile setup could not be completed. Please retry.' })
    throw new AiLifecycleError('AI profile setup could not be completed. Your profile changes were saved.')
  }
}

export async function enableProfileAi(userId: string, dependencies: AiLifecycleDependencies) {
  return index(await owned(userId, dependencies.state), dependencies)
}
export async function retryProfileAi(userId: string, dependencies: AiLifecycleDependencies) {
  const profile = await owned(userId, dependencies.state)
  if (!profile.enabled) throw new AiLifecycleError('Enable AI before retrying setup.')
  return index(profile, dependencies)
}
export async function refreshProfileAi(userId: string, dependencies: AiLifecycleDependencies) {
  const profile = await owned(userId, dependencies.state)
  if (!profile.enabled) return { profile, sync: null }
  await dependencies.state.updateState(profile.id, profile.userId, { status: 'stale', lastError: null })
  return index(profile, dependencies)
}
export async function disableProfileAi(userId: string, dependencies: AiLifecycleDependencies) {
  const profile = await owned(userId, dependencies.state)
  return dependencies.state.updateState(profile.id, profile.userId, { enabled: false, status: 'off', lastError: null })
}
