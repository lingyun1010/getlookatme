import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { NEUTRAL_PROFILE_DEFAULTS } from '../src/onboarding/defaults.ts'
import { extractResumeText, extractedPastedText, type DocumentExtractors, type ResumeFileLike } from '../src/onboarding/extraction.ts'
import { parsedResumeToDraft } from '../src/onboarding/mapping.ts'
import { parseResumeDeterministically } from '../src/onboarding/parser.ts'
import { draftToProfileDocument } from '../src/onboarding/profileDocument.ts'
import { loadTemporaryProfile, saveTemporaryProfile, TEMPORARY_PROFILE_KEY } from '../src/onboarding/session.ts'
import type { ParsedResume } from '../src/onboarding/types.ts'
import { validateProfileDraft } from '../src/onboarding/validation.ts'
import { resolveProfile } from '../src/profile/resolveProfile.ts'

const fixtureText = `Jane Example
jane@example.com
https://github.com/jane
https://linkedin.com/in/jane

Summary
Engineer who builds accessible web products.

Skills
TypeScript, Accessibility, Testing

Experience
Senior Engineer at Example Co

Education
BSc Computer Science | Example University

Projects
Open Tools | Developer tooling`

function file(name: string, type: string, size = 100): ResumeFileLike {
  return { name, type, size, async arrayBuffer() { return new TextEncoder().encode('fixture').buffer } }
}

const extractors: DocumentExtractors = {
  async pdf() { return { text: fixtureText, pageCount: 2 } },
  async docx() { return { text: fixtureText, warnings: ['DOCX fixture warning'] } },
}

test('PDF extraction stays behind the extraction abstraction', async () => {
  const result = await extractResumeText(file('resume.pdf', 'application/pdf'), extractors)
  assert.equal(result.sourceType, 'pdf')
  assert.equal(result.metadata.pageCount, 2)
  assert.match(result.text, /Jane Example/)
})

test('DOCX extraction stays behind the extraction abstraction', async () => {
  const result = await extractResumeText(file('resume.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), extractors)
  assert.equal(result.sourceType, 'docx')
  assert.deepEqual(result.warnings, ['DOCX fixture warning'])
})

test('pasted text is normalized and short text is rejected', () => {
  assert.equal(extractedPastedText(`  ${fixtureText}\r\n`).sourceType, 'text')
  assert.throws(() => extractedPastedText('too short'), /at least 20/)
})

test('invalid files and extraction failures produce clear errors', async () => {
  await assert.rejects(() => extractResumeText(file('resume.txt', 'text/plain'), extractors), /PDF or DOCX/)
  await assert.rejects(() => extractResumeText(file('resume.pdf', 'application/pdf', 9 * 1024 * 1024), extractors), /8 MB/)
  const broken = { ...extractors, async pdf() { throw new Error('corrupt xref') } }
  await assert.rejects(() => extractResumeText(file('resume.pdf', 'application/pdf'), broken), /Could not extract resume text: corrupt xref/)
})

test('deterministic parsing and draft mapping do not hallucinate absent facts', () => {
  const parsed = parseResumeDeterministically(extractedPastedText(fixtureText))
  const draft = parsedResumeToDraft(parsed)
  assert.equal(draft.identity.fullName, 'Jane Example')
  assert.equal(draft.identity.location, undefined)
  assert.equal(draft.services.length, 0)
  assert.ok(draft.missingFields.includes('identity.location'))
  assert.equal(draft.presentation.servicesIntro, NEUTRAL_PROFILE_DEFAULTS.servicesIntro)
  assert.equal(draft.experience[0]?.featured, true)
})

test('validation classifies blocking, missing, and warning issues', () => {
  const parsed: ParsedResume = {
    identity: {}, skills: [], experience: [], education: [], projects: [], links: {}, warnings: ['Low confidence mapping'],
    mapping: { mapper: 'deterministic', inferredFields: [], lowConfidenceFields: [] },
  }
  const draft = parsedResumeToDraft(parsed)
  draft.identity.githubUrl = 'javascript:alert(1)'
  const result = validateProfileDraft(draft)
  assert.equal(result.valid, false)
  assert.ok(result.blockingErrors.some(({ field }) => field === 'identity.fullName'))
  assert.ok(result.blockingErrors.some(({ field }) => field === 'identity.githubUrl'))
  assert.ok(result.missingInformation.some(({ field }) => field === 'profileImage'))
  assert.ok(result.warnings.some(({ message }) => /Low confidence/.test(message)))
})

test('temporary profile uses the canonical renderer contract and cannot use Lingyun RAG', () => {
  const draft = parsedResumeToDraft(parseResumeDeterministically(extractedPastedText(fixtureText)))
  draft.identity.headline = 'Senior Engineer'
  const profile = draftToProfileDocument(draft)
  assert.equal(profile.slug, 'preview')
  assert.equal(profile.ai.enabled, false)
  assert.equal(profile.avatar.mode, 'placeholder')
  assert.equal(resolveProfile('lingyun')?.profileId, 'profile_lingyun_seed')
  assert.equal(resolveProfile('aaron')?.ai.enabled, false)
})

test('temporary preview round-trips only through session storage', () => {
  const draft = parsedResumeToDraft(parseResumeDeterministically(extractedPastedText(fixtureText)))
  draft.identity.headline = 'Senior Engineer'
  const profile = draftToProfileDocument(draft)
  const values = new Map<string, string>()
  const storage = { setItem(key: string, value: string) { values.set(key, value) }, getItem(key: string) { return values.get(key) ?? null } }
  saveTemporaryProfile(profile, storage)
  assert.ok(values.has(TEMPORARY_PROFILE_KEY))
  const loaded = loadTemporaryProfile(storage)
  assert.equal(loaded?.profileId, profile.profileId)
  assert.equal(loaded?.identity.fullName, profile.identity.fullName)
  assert.equal(loaded?.ai.enabled, false)
})

test('onboarding and renderer never assign untrusted strings through innerHTML', async () => {
  const sources = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/onboarding/createApp.ts', import.meta.url), 'utf8'),
  ])
  assert.doesNotMatch(sources.join('\n'), /\.innerHTML\s*=/)
})
