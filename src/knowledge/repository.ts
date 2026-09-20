import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProfileDocument } from '../profile/types.ts'
import type {
  BuiltKnowledgeSource, KnowledgeRepository, KnowledgeSearchResult, KnowledgeStatus,
  PersistedChunkInput, StoredKnowledgeSource,
} from './types.ts'

interface SourceRow {
  id: string
  profile_id: string
  source_type: string
  source_ref: string
  content_hash: string
  status: StoredKnowledgeSource['status']
  knowledge_chunks: Array<{ id: string; chunk_index: number; content_hash: string; embedding_version: string }> | null
}

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message)
}

export class SupabaseKnowledgeRepository implements KnowledgeRepository {
  private readonly client: SupabaseClient
  constructor(client: SupabaseClient) { this.client = client }

  async loadProfile(profileId: string): Promise<ProfileDocument> {
    const { data, error } = await this.client.from('profiles').select('document').eq('id', profileId).single()
    throwIfError(error)
    const document = data?.document as ProfileDocument | undefined
    if (!document?.profileId) throw new Error(`Profile ${profileId} has no structured ProfileDocument.`)
    return document
  }

  async listSources(profileId: string): Promise<StoredKnowledgeSource[]> {
    const { data, error } = await this.client.from('knowledge_sources')
      .select('id,profile_id,source_type,source_ref,content_hash,status,knowledge_chunks(id,chunk_index,content_hash,embedding_version)')
      .eq('profile_id', profileId)
    throwIfError(error)
    return ((data ?? []) as unknown as SourceRow[]).map((source) => ({
      id: source.id,
      profileId: source.profile_id,
      sourceType: source.source_type,
      sourceRef: source.source_ref,
      contentHash: source.content_hash,
      status: source.status,
      chunks: (source.knowledge_chunks ?? []).map((chunk) => ({
        id: chunk.id, chunkIndex: chunk.chunk_index, contentHash: chunk.content_hash, embeddingVersion: chunk.embedding_version,
      })),
    }))
  }

  async upsertSource(profileId: string, source: BuiltKnowledgeSource): Promise<string> {
    const { data, error } = await this.client.from('knowledge_sources').upsert({
      profile_id: profileId,
      source_type: source.sourceType,
      source_ref: source.sourceRef,
      title: source.title,
      content_hash: source.contentHash,
      status: 'active',
    }, { onConflict: 'profile_id,source_type,source_ref' }).select('id').single()
    throwIfError(error)
    if (!data?.id) throw new Error(`Knowledge source ${source.sourceType}/${source.sourceRef} was not persisted.`)
    return data.id as string
  }

  async replaceChunks(sourceId: string, chunks: PersistedChunkInput[]): Promise<void> {
    if (!chunks.length) throw new Error('A knowledge source must produce at least one chunk.')
    const { error } = await this.client.from('knowledge_chunks').upsert(chunks.map((chunk) => ({
      profile_id: chunk.profileId,
      source_id: chunk.sourceId,
      chunk_index: chunk.chunkIndex,
      content: chunk.content,
      embedding: chunk.embedding,
      source_type: chunk.sourceType,
      source_ref: chunk.sourceRef,
      section: chunk.section,
      metadata: chunk.metadata,
      content_hash: chunk.contentHash,
      embedding_version: chunk.embeddingVersion,
    })), { onConflict: 'source_id,chunk_index' })
    throwIfError(error)
    const { error: deleteError } = await this.client.from('knowledge_chunks').delete()
      .eq('source_id', sourceId)
      .eq('profile_id', chunks[0].profileId)
      .gte('chunk_index', chunks.length)
    throwIfError(deleteError)
  }

  async deleteSources(profileId: string, sourceIds: string[]): Promise<void> {
    if (!sourceIds.length) return
    const { error } = await this.client.from('knowledge_sources').delete().eq('profile_id', profileId).in('id', sourceIds)
    throwIfError(error)
  }

  async getStatus(profileId: string): Promise<KnowledgeStatus> {
    const [sources, chunks, failed, latest] = await Promise.all([
      this.client.from('knowledge_sources').select('id', { count: 'exact', head: true }).eq('profile_id', profileId),
      this.client.from('knowledge_chunks').select('id', { count: 'exact', head: true }).eq('profile_id', profileId),
      this.client.from('knowledge_sources').select('id', { count: 'exact', head: true }).eq('profile_id', profileId).eq('status', 'failed'),
      this.client.from('knowledge_chunks').select('updated_at').eq('profile_id', profileId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    for (const result of [sources, chunks, failed, latest]) throwIfError(result.error)
    return {
      profileId,
      sourceCount: sources.count ?? 0,
      chunkCount: chunks.count ?? 0,
      failedSourceCount: failed.count ?? 0,
      lastIndexedAt: (latest.data as { updated_at?: string } | null)?.updated_at ?? null,
    }
  }

  async search(profileId: string, queryEmbedding: number[], limit = 5): Promise<KnowledgeSearchResult[]> {
    if (!profileId) throw new Error('A profile ID is required for knowledge search.')
    const { data, error } = await this.client.rpc('search_profile_knowledge', {
      requested_profile_id: profileId,
      query_embedding: queryEmbedding,
      match_count: limit,
    })
    throwIfError(error)
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      profileId: row.profile_id as string | undefined,
      chunkId: row.chunk_id as string,
      sourceId: row.source_id as string,
      content: row.content as string,
      similarity: row.similarity as number,
      sourceType: row.source_type as string,
      sourceRef: row.source_ref as string,
      section: row.section as string,
      title: (row.source_title as string | null | undefined) ?? null,
      metadata: row.metadata as KnowledgeSearchResult['metadata'],
    }))
  }
}
