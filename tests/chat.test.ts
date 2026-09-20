import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import type { User } from '@supabase/supabase-js'
import { lingyunProfile } from '../src/profile/profiles/lingyun.ts'
import { InvalidAuthenticationError, ProfileAccessError, ProfileChatService, type ChatTargetProfile } from '../src/rag/chatService.ts'
import { answerProfileQuestion, NO_ANSWER } from '../src/rag/profileAnswer.ts'
import type { KnowledgeSearchResult } from '../src/knowledge/types.ts'

const profileAId = '11111111-1111-4111-8111-111111111111'
const profileBId = '22222222-2222-4222-8222-222222222222'
const owner = { id: 'owner-a' } as User
const nonOwner = { id: 'owner-b' } as User
const document = structuredClone({ ...lingyunProfile, profileId: profileAId, slug: 'profile-a' })
const target = (isPublished: boolean): ChatTargetProfile => ({
  id: profileAId, userId: owner.id, slug: 'profile-a', isPublished, document,
})
const result = (overrides: Partial<KnowledgeSearchResult> = {}): KnowledgeSearchResult => ({
  profileId: profileAId, chunkId: 'chunk-a', sourceId: 'source-a', content: 'Verified evidence.',
  similarity: 0.8, sourceType: 'project', sourceRef: 'project-a', section: 'projects',
  title: 'Project A', metadata: { category: 'AI' }, ...overrides,
})

function harness(options: {
  published?: boolean
  user?: User | null
  resolved?: ChatTargetProfile | null
  results?: KnowledgeSearchResult[]
  evidenceIds?: string[]
} = {}) {
  const calls = { authenticate: 0, embed: 0, search: 0, generate: 0, searchedProfileIds: [] as string[] }
  const service = new ProfileChatService({
    authenticate: async () => { calls.authenticate++; return options.user ?? null },
    resolveProfile: async () => options.resolved === undefined ? target(options.published ?? true) : options.resolved,
    embeddings: { embedText: async () => { calls.embed++; return [1, 0] } },
    knowledge: { search: async (profileId) => { calls.search++; calls.searchedProfileIds.push(profileId); return options.results ?? [result()] } },
    generateAnswer: async () => { calls.generate++; return { answer: 'A grounded answer.', evidenceIds: options.evidenceIds ?? ['chunk-a'] } },
  })
  return { service, calls }
}

test('published profiles allow anonymous and authenticated non-owner callers', async () => {
  const anonymous = harness({ published: true })
  assert.equal((await anonymous.service.ask('Question?', 'profile-a')).noAnswer, false)
  const authenticated = harness({ published: true, user: nonOwner })
  assert.equal((await authenticated.service.ask('Question?', 'profile-a', 'Bearer valid')).noAnswer, false)
})

test('an unpublished profile allows its owner', async () => {
  const { service } = harness({ published: false, user: owner })
  assert.equal((await service.ask('Question?', 'profile-a', 'Bearer owner')).noAnswer, false)
})

for (const scenario of [
  { name: 'anonymous', authorization: undefined, user: null },
  { name: 'authenticated non-owner', authorization: 'Bearer other', user: nonOwner },
]) {
  test(`an unpublished profile denies an ${scenario.name} before provider work`, async () => {
    const { service, calls } = harness({ published: false, user: scenario.user })
    await assert.rejects(service.ask('Question?', 'profile-a', scenario.authorization), ProfileAccessError)
    assert.deepEqual({ embed: calls.embed, search: calls.search, generate: calls.generate }, { embed: 0, search: 0, generate: 0 })
  })
}

test('unknown slugs do not fall back and do no provider work', async () => {
  const { service, calls } = harness({ resolved: null })
  await assert.rejects(service.ask('Question?', 'missing'), ProfileAccessError)
  assert.deepEqual({ embed: calls.embed, search: calls.search, generate: calls.generate }, { embed: 0, search: 0, generate: 0 })
})

test('an invalid supplied bearer token is rejected before provider work', async () => {
  const { service, calls } = harness({ published: true, user: null })
  await assert.rejects(service.ask('Question?', 'profile-a', 'Bearer invalid'), InvalidAuthenticationError)
  assert.deepEqual({ embed: calls.embed, search: calls.search, generate: calls.generate }, { embed: 0, search: 0, generate: 0 })
})

test('only the server-resolved profile UUID reaches retrieval and cross-profile rows are rejected', async () => {
  const { service, calls } = harness({ results: [result(), result({ profileId: profileBId, chunkId: 'chunk-b' })] })
  const answer = await service.ask('Question?', 'profile-a')
  assert.deepEqual(calls.searchedProfileIds, [profileAId])
  assert.deepEqual(answer.evidence.map(({ chunkId }) => chunkId), ['chunk-a'])
})

test('empty and below-threshold knowledge return the stable no-answer without invoking the LLM', async () => {
  for (const results of [[], [result({ similarity: 0.01 })]]) {
    const { service, calls } = harness({ results })
    assert.deepEqual(await service.ask('Question?', 'profile-a'), NO_ANSWER)
    assert.equal(calls.generate, 0)
  }
})

test('invalid or absent model citations become no-answer', async () => {
  for (const evidenceIds of [[], ['not-retrieved']]) {
    const { service } = harness({ evidenceIds })
    assert.deepEqual(await service.ask('Question?', 'profile-a'), NO_ANSWER)
  }
})

test('evidence and compatibility aliases derive only from retrieved chunks', async () => {
  const answer = await answerProfileQuestion('Question?', document, [result()], async () => ({
    answer: 'Supported.', evidenceIds: ['chunk-a', 'chunk-a'],
  }))
  assert.deepEqual(answer.evidence, [{
    chunkId: 'chunk-a', sourceId: 'source-a', sourceType: 'project', sourceRef: 'project-a',
    section: 'projects', title: 'Project A', metadata: { category: 'AI' },
  }])
  assert.deepEqual(answer.sources, [{ id: 'chunk-a', type: 'project', title: 'Project A' }])
  assert.deepEqual(answer.relatedIds, ['project-a'])
})

test('both chat endpoints use the shared orchestration service and not legacy retrieval', async () => {
  const [production, local] = await Promise.all([
    readFile(new URL('../api/chat.ts', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/dev-api.ts', import.meta.url), 'utf8'),
  ])
  for (const source of [production, local]) {
    assert.match(source, /createServerChatService/)
    assert.doesNotMatch(source, /answerPortfolioQuestion|from ['"].*\/retrieve\.ts/)
  }
})
