import assert from 'node:assert/strict'
import test from 'node:test'
import { lingyunProfile } from '../src/profile/profiles/lingyun.ts'
import {
  buildKnowledgeSources, chunkKnowledgeSource, contentHash, planKnowledgeSync, stableSerialize, syncProfileKnowledge,
} from '../src/knowledge/index.ts'
import type {
  BuiltKnowledgeSource, EmbeddingClient, KnowledgeRepository, KnowledgeStatus, PersistedChunkInput,
  StoredKnowledgeSource,
} from '../src/knowledge/types.ts'
import type { ProfileDocument } from '../src/profile/types.ts'

const profileId = '11111111-1111-4111-8111-111111111111'
const makeProfile = (): ProfileDocument => structuredClone({ ...lingyunProfile, profileId })

class FakeEmbeddings implements EmbeddingClient {
  calls = 0
  inputs: string[] = []
  readonly version: string
  constructor(version = 'test-model:1536:v1') { this.version = version }
  async embedTexts(inputs: string[]): Promise<number[][]> {
    this.calls += inputs.length
    this.inputs.push(...inputs)
    return inputs.map((_, index) => [1, index])
  }
  async embedText(input: string): Promise<number[]> { return (await this.embedTexts([input]))[0] }
}

class FakeRepository implements KnowledgeRepository {
  profile = makeProfile()
  sources: StoredKnowledgeSource[] = []
  private nextId = 1
  async loadProfile(requested: string): Promise<ProfileDocument> {
    assert.equal(requested, profileId)
    return structuredClone(this.profile)
  }
  async listSources(): Promise<StoredKnowledgeSource[]> { return structuredClone(this.sources) }
  async upsertSource(requested: string, source: BuiltKnowledgeSource): Promise<string> {
    assert.equal(requested, profileId)
    let stored = this.sources.find((item) => item.sourceType === source.sourceType && item.sourceRef === source.sourceRef)
    if (!stored) {
      stored = { id: `source-${this.nextId++}`, profileId, sourceType: source.sourceType, sourceRef: source.sourceRef, contentHash: source.contentHash, status: 'active', chunks: [] }
      this.sources.push(stored)
    }
    stored.contentHash = source.contentHash
    stored.status = 'active'
    return stored.id
  }
  async replaceChunks(sourceId: string, chunks: PersistedChunkInput[]): Promise<void> {
    const source = this.sources.find(({ id }) => id === sourceId)!
    source.chunks = chunks.map((chunk, index) => ({ id: `${sourceId}-${index}`, chunkIndex: chunk.chunkIndex, contentHash: chunk.contentHash, embeddingVersion: chunk.embeddingVersion }))
  }
  async deleteSources(requested: string, sourceIds: string[]): Promise<void> {
    assert.equal(requested, profileId)
    this.sources = this.sources.filter(({ id }) => !sourceIds.includes(id))
  }
  async getStatus(requested: string): Promise<KnowledgeStatus> {
    assert.equal(requested, profileId)
    return { profileId, sourceCount: this.sources.length, chunkCount: this.sources.flatMap(({ chunks }) => chunks).length, failedSourceCount: 0, lastIndexedAt: '2026-09-19T00:00:00Z' }
  }
  async search(): Promise<never[]> { return [] }
}

test('builds deterministic sources from ProfileDocument with stable entity references', () => {
  const first = buildKnowledgeSources(makeProfile())
  const second = buildKnowledgeSources(makeProfile())
  assert.deepEqual(first, second)
  assert.equal(first[0].sourceRef, 'profile')
  assert.equal(new Set(first.map(({ sourceType, sourceRef }) => `${sourceType}/${sourceRef}`)).size, first.length)
  assert.ok(first.some(({ sourceType }) => sourceType === 'experience'))
  assert.ok(first.some(({ sourceType }) => sourceType === 'project'))
  assert.ok(first.some(({ sourceType }) => sourceType === 'skill'))
  assert.ok(first.some(({ sourceType }) => sourceType === 'education'))
})

test('preserves project evidence and navigation metadata without inventing links', () => {
  const profile = makeProfile()
  const project = profile.projects.find(({ links }) => links?.some(({ url }) => url.includes('github.com')))!
  const source = buildKnowledgeSources(profile).find(({ sourceType, sourceRef }) => sourceType === 'project' && sourceRef === project.id)!
  assert.equal(source.metadata.section, 'projects')
  assert.equal(source.metadata.evidenceType, 'project')
  assert.deepEqual(source.metadata.skills, project.technologies)
  assert.match(String(source.metadata.githubUrl), /^https:\/\/github\.com\//)
  assert.match(source.content, /Evidence:/)
})

test('stable hashing ignores object key order and normalizes line endings', () => {
  assert.equal(stableSerialize({ b: 2, a: ' value\r\n' }), stableSerialize({ a: 'value', b: 2 }))
  assert.equal(contentHash({ b: 2, a: 1 }), contentHash({ a: 1, b: 2 }))
  assert.notEqual(contentHash({ a: 1 }), contentHash({ a: 2 }))
})

test('chunking is deterministic, preserves boundaries for small entities, and splits long content', () => {
  const source = buildKnowledgeSources(makeProfile())[0]
  assert.equal(chunkKnowledgeSource(source).length, 1)
  const long = { ...source, content: Array.from({ length: 80 }, (_, index) => `Paragraph ${index} contains deterministic professional evidence.`).join('\n') }
  const first = chunkKnowledgeSource(long, { maximumCharacters: 300, overlapCharacters: 40 })
  assert.deepEqual(first, chunkKnowledgeSource(long, { maximumCharacters: 300, overlapCharacters: 40 }))
  assert.ok(first.length > 1)
  assert.deepEqual(first.map(({ chunkIndex }) => chunkIndex), first.map((_, index) => index))
})

test('planner detects unchanged, changed, deleted, and embedding-version-invalidated sources', () => {
  const [source, changed] = buildKnowledgeSources(makeProfile()).slice(0, 2)
  const sourceChunkHash = chunkKnowledgeSource(source)[0].contentHash
  const persisted: StoredKnowledgeSource[] = [
    { id: 'same', profileId, sourceType: source.sourceType, sourceRef: source.sourceRef, contentHash: source.contentHash, status: 'active', chunks: [{ id: 'chunk', chunkIndex: 0, contentHash: sourceChunkHash, embeddingVersion: 'v1' }] },
    { id: 'changed', profileId, sourceType: changed.sourceType, sourceRef: changed.sourceRef, contentHash: '0'.repeat(64), status: 'active', chunks: [{ id: 'chunk-2', chunkIndex: 0, contentHash: 'x', embeddingVersion: 'v1' }] },
    { id: 'deleted', profileId, sourceType: 'manual', sourceRef: 'removed', contentHash: '1'.repeat(64), status: 'active', chunks: [] },
  ]
  const plan = planKnowledgeSync([source, changed], persisted, 'v1')
  assert.equal(plan.unchangedSources.length, 1)
  assert.equal(plan.changedSources.length, 1)
  assert.equal(plan.deletedSources.length, 1)
  assert.equal(planKnowledgeSync([source], persisted.slice(0, 1), 'v2').changedSources.length, 1)
})

test('incremental sync embeds only new or changed sources and removes deleted sources', async () => {
  const repository = new FakeRepository()
  const embeddings = new FakeEmbeddings()
  const initial = await syncProfileKnowledge(profileId, repository, embeddings)
  assert.equal(initial.newSources, initial.sourceCount)
  assert.equal(initial.embeddingsGenerated, initial.chunkCount)

  const unchanged = await syncProfileKnowledge(profileId, repository, embeddings)
  assert.equal(unchanged.embeddingsGenerated, 0)
  assert.equal(unchanged.unchangedSources, initial.sourceCount)

  repository.profile.projects[0].description = `${repository.profile.projects[0].description ?? ''} One verified change.`
  const changed = await syncProfileKnowledge(profileId, repository, embeddings)
  assert.equal(changed.changedSources, 1)
  assert.equal(changed.embeddingsGenerated, 1)

  repository.profile.projects.pop()
  const removed = await syncProfileKnowledge(profileId, repository, embeddings)
  assert.equal(removed.deletedSources, 1)
  assert.equal(removed.embeddingsGenerated, 0)
})

test('sync rejects a mismatched ProfileDocument identity', async () => {
  const repository = new FakeRepository()
  repository.profile.profileId = 'another-profile'
  await assert.rejects(syncProfileKnowledge(profileId, repository, new FakeEmbeddings()), /identity does not match/)
})
