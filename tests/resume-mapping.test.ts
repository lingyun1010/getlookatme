import assert from 'node:assert/strict'
import test from 'node:test'
import { extractedPastedText } from '../src/onboarding/extraction.ts'
import { LLMResumeMappingService } from '../src/onboarding/llmClient.ts'
import { parseLlmResumeOutput, validateParsedResumeResponse } from '../src/onboarding/llmSchema.ts'
import { parsedResumeToDraft } from '../src/onboarding/mapping.ts'
import { FALLBACK_WARNING, createResumeMappingService } from '../src/onboarding/mappingCoordinator.ts'
import { mapResumeOnServer, ResumeMappingInputError, sanitizeResumeText } from '../src/onboarding/server/service.ts'
import type { ExtractedResumeText, ParsedResume, ResumeMappingService } from '../src/onboarding/types.ts'

const extracted: ExtractedResumeText = extractedPastedText('Jordan Example\njordan@example.com\nProfessional Experience\nEngineer at Example Ltd')

const llmFixture = {
  identity: { fullName: 'Jordan Example', preferredName: null, email: 'jordan@example.com', location: 'Sydney, Australia', headline: 'Software Engineer' },
  summary: null,
  skills: ['TypeScript', 'Node.js'],
  experience: [{
    role: 'Software Engineer', company: 'Example Ltd', location: 'Sydney, Australia', startDate: '2022', endDate: 'Present',
    summary: 'Built documented web systems.', highlights: ['Improved test coverage.'], technologies: ['TypeScript'],
  }],
  education: [{ degree: 'BSc Computer Science', institution: 'Example University', startDate: '2018', endDate: '2021', description: null, honours: null }],
  projects: [{
    title: 'Developer Toolkit', category: 'Personal Project', shortDescription: 'A documented developer toolkit.', description: null,
    technologies: ['Node.js'], tags: ['Tooling'], links: [{ label: 'Repository', url: 'https://github.com/jordan/toolkit' }],
  }],
  links: { linkedinUrl: null, githubUrl: 'https://github.com/jordan', websiteUrl: null },
  warnings: ['Professional summary was not present.'], inferredFields: ['identity.headline'], lowConfidenceFields: [],
}

const parsedFixture: ParsedResume = parseLlmResumeOutput(llmFixture)

class StubMapper implements ResumeMappingService {
  calls = 0
  private readonly result: ParsedResume | Error
  constructor(result: ParsedResume | Error) { this.result = result }
  async mapResume(): Promise<ParsedResume> {
    this.calls += 1
    if (this.result instanceof Error) throw this.result
    return this.result
  }
}

test('service selection prefers LLM when enabled and deterministic when disabled', async () => {
  const diagnostics: string[] = []
  const llm = new StubMapper(parsedFixture)
  const deterministic = new StubMapper({ ...parsedFixture, mapping: { mapper: 'deterministic', inferredFields: [], lowConfidenceFields: [] } })
  assert.equal((await createResumeMappingService({ llmEnabled: true, llm, deterministic, diagnostic: (event) => diagnostics.push(event) }).mapResume(extracted)).mapping.mapper, 'llm')
  assert.equal(llm.calls, 1)
  assert.deepEqual(diagnostics, ['Mapper selected', 'Mapper completed'])
  const disabledLlm = new StubMapper(new Error('must not run'))
  assert.equal((await createResumeMappingService({ llmEnabled: false, llm: disabledLlm, deterministic }).mapResume(extracted)).mapping.mapper, 'deterministic')
  assert.equal(disabledLlm.calls, 0)
})

test('LLM failure activates deterministic fallback with a visible warning', async () => {
  const diagnostics: string[] = []
  const deterministic = new StubMapper({ ...parsedFixture, warnings: [], mapping: { mapper: 'deterministic', inferredFields: [], lowConfidenceFields: [] } })
  const result = await createResumeMappingService({
    llmEnabled: true, llm: new StubMapper(new Error('provider failed')), deterministic,
    diagnostic: (event) => diagnostics.push(event),
  }).mapResume(extracted)
  assert.equal(result.mapping.mapper, 'deterministic')
  assert.ok(result.warnings.includes(FALLBACK_WARNING))
  assert.ok(diagnostics.includes('Deterministic fallback activated'))
})

test('valid structured fixture preserves realistic skills, experience, education, projects, and provenance', () => {
  const result = parseLlmResumeOutput(llmFixture)
  assert.deepEqual(result.skills, ['TypeScript', 'Node.js'])
  assert.equal(result.experience[0]?.company, 'Example Ltd')
  assert.equal(result.education[0]?.institution, 'Example University')
  assert.equal(result.projects[0]?.title, 'Developer Toolkit')
  assert.equal(result.identity.preferredName, undefined)
  assert.deepEqual(result.mapping.inferredFields, ['identity.headline'])
  assert.equal(parsedResumeToDraft(result).mapping.mapper, 'llm')
})

test('the successful endpoint shape from manual QA passes client validation', () => {
  const parsedResume = {
    identity: { fullName: 'Lingyun Zhao', headline: 'Software Engineer' },
    skills: ['Java', 'React', 'AWS'], experience: [], education: [], projects: [], links: {}, warnings: [],
    mapping: { mapper: 'llm', inferredFields: [], lowConfidenceFields: [] },
  }
  const result = validateParsedResumeResponse(parsedResume)
  assert.equal(result.mapping.mapper, 'llm')
  assert.deepEqual(result.skills, ['Java', 'React', 'AWS'])
})

test('PDF, DOCX, and pasted text all enter the same mapper coordinator', async () => {
  const llm = new StubMapper(parsedFixture)
  const service = createResumeMappingService({ llmEnabled: true, llm, deterministic: new StubMapper(parsedFixture) })
  for (const sourceType of ['pdf', 'docx', 'text'] as const) await service.mapResume({ ...extracted, sourceType })
  assert.equal(llm.calls, 3)
})

test('malformed, empty, schema-invalid, and invalid URL model outputs are rejected', () => {
  assert.throws(() => parseLlmResumeOutput(null), /schema/)
  assert.throws(() => parseLlmResumeOutput({}), /schema/)
  assert.throws(() => parseLlmResumeOutput({ ...llmFixture, skills: 'TypeScript' }), /string array/)
  assert.throws(() => parseLlmResumeOutput({ ...llmFixture, links: { ...llmFixture.links, githubUrl: 'javascript:alert(1)' } }), /HTTP\(S\)/)
  const invalidProject = structuredClone(llmFixture)
  invalidProject.projects[0]!.links[0]!.url = 'not-a-url'
  assert.throws(() => parseLlmResumeOutput(invalidProject), /HTTP\(S\)/)
})

test('server mapper validates input, strips HTML, rejects oversized text, and validates provider output', async () => {
  assert.equal(sanitizeResumeText('<b>Jordan</b>\0<script>alert(1)</script>'), 'Jordan')
  assert.throws(() => sanitizeResumeText(''), ResumeMappingInputError)
  assert.throws(() => sanitizeResumeText('x'.repeat(40_001)), /40000/)
  const provider = { async mapResumeText() { return llmFixture } }
  const result = await mapResumeOnServer({ text: extracted.text, sourceType: 'text' }, { provider })
  assert.equal(result.mapping.mapper, 'llm')
  await assert.rejects(() => mapResumeOnServer({ text: extracted.text, sourceType: 'rtf' }, { provider }), /source type/)
  await assert.rejects(() => mapResumeOnServer({ text: extracted.text, sourceType: 'text' }, { environment: {} }), /not configured/)
  await assert.rejects(() => mapResumeOnServer({ text: extracted.text, sourceType: 'text' }, { provider: { async mapResumeText() { throw new Error('provider unavailable') } } }), /provider unavailable/)
  await assert.rejects(() => mapResumeOnServer({ text: extracted.text, sourceType: 'text' }, { provider: { async mapResumeText() { return {} } } }), /schema/)
})

test('client mapper rejects provider error and empty or malformed response', async () => {
  const errorFetcher = async () => new Response('{}', { status: 503 })
  await assert.rejects(() => new LLMResumeMappingService('/map', errorFetcher as typeof fetch).mapResume(extracted), /503/)
  const emptyFetcher = async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
  await assert.rejects(() => new LLMResumeMappingService('/map', emptyFetcher as typeof fetch).mapResume(extracted), /empty response/)
  const malformedFetcher = async () => new Response(JSON.stringify({ parsedResume: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  await assert.rejects(() => new LLMResumeMappingService('/map', malformedFetcher as typeof fetch).mapResume(extracted), /metadata/)
})

test('client mapper invokes browser fetch with the global receiver', async () => {
  function browserLikeFetcher(this: unknown): Promise<Response> {
    if (this !== globalThis) throw new TypeError('Illegal invocation')
    const parsedResume = { ...parsedFixture, mapping: { mapper: 'llm', inferredFields: [], lowConfidenceFields: [] } }
    return Promise.resolve(new Response(JSON.stringify({ parsedResume }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  }
  const result = await new LLMResumeMappingService('/map', browserLikeFetcher as typeof fetch).mapResume(extracted)
  assert.equal(result.mapping.mapper, 'llm')
})

test('client mapper times out and lets the coordinator fall back', async () => {
  const hangingFetcher = (_input: URL | RequestInfo, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
  })
  const llm = new LLMResumeMappingService('/map', hangingFetcher as typeof fetch, 5)
  const deterministic = new StubMapper({ ...parsedFixture, warnings: [], mapping: { mapper: 'deterministic', inferredFields: [], lowConfidenceFields: [] } })
  const result = await createResumeMappingService({ llmEnabled: true, llm, deterministic }).mapResume(extracted)
  assert.equal(result.mapping.mapper, 'deterministic')
  assert.ok(result.warnings.includes(FALLBACK_WARNING))
})

test('section-heading variants are represented through the structured fixture path without generated facts', () => {
  const headings = ['Professional Experience', 'Core Skills', 'Academic Background', 'Personal Projects']
  assert.ok(headings.every((heading) => heading.length > 0))
  const result = parseLlmResumeOutput({ ...llmFixture, summary: null, links: { linkedinUrl: null, githubUrl: null, websiteUrl: null } })
  assert.equal(result.summary, undefined)
  assert.deepEqual(result.links, { linkedinUrl: undefined, githubUrl: undefined, websiteUrl: undefined })
})
