import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { isAvatarFrameSet, normalizeAvatarMode } from '../src/avatar/generation.ts'
import { NEUTRAL_PROFILE_DEFAULTS } from '../src/onboarding/defaults.ts'
import { extractResumeText, extractedPastedText, type DocumentExtractors, type ResumeFileLike } from '../src/onboarding/extraction.ts'
import { parsedResumeToDraft } from '../src/onboarding/mapping.ts'
import { parseResumeDeterministically } from '../src/onboarding/parser.ts'
import { draftToProfileDocument } from '../src/onboarding/profileDocument.ts'
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

test('hero summary rejects content over 280 characters without truncating it', () => {
  const draft = parsedResumeToDraft(parseResumeDeterministically(extractedPastedText(fixtureText)))
  draft.identity.summary = 'x'.repeat(281)
  const result = validateProfileDraft(draft)
  assert.equal(result.valid, false)
  assert.match(result.blockingErrors.map(({ message }) => message).join(' '), /280 characters/)
  assert.equal(draft.identity.summary.length, 281)
})

test('temporary profile uses the canonical renderer contract and cannot use Lingyun RAG', () => {
  const draft = parsedResumeToDraft(parseResumeDeterministically(extractedPastedText(fixtureText)))
  draft.identity.headline = 'Senior Engineer'
  const profile = draftToProfileDocument(draft)
  assert.equal(profile.slug, 'preview')
  assert.equal(profile.ai.enabled, false)
  assert.equal(profile.ai.unavailableMessage, NEUTRAL_PROFILE_DEFAULTS.aiUnavailableMessage)
  assert.equal(profile.avatar.mode, 'placeholder')
  assert.equal(resolveProfile('lingyun')?.profileId, 'profile_lingyun_seed')
  assert.equal(resolveProfile('aaron')?.ai.enabled, false)
})

test('temporary profile supports original and dynamic avatar state without storing frame counts', () => {
  const draft = parsedResumeToDraft(parseResumeDeterministically(extractedPastedText(fixtureText)))
  draft.identity.headline = 'Senior Engineer'
  draft.avatarMode = 'original'
  draft.avatarImageUrl = 'data:image/png;base64,abc'
  const original = draftToProfileDocument(draft)
  assert.equal(original.avatarMode, 'original')
  assert.equal(original.avatarImageUrl, 'data:image/png;base64,abc')
  assert.equal(original.avatar.mode, 'placeholder')

  const frameSet = {
    version: 2,
    center: { key: 'center', frame: 0, src: '/generated/center.png' },
    directions: [
      { key: 'left', frame: 1, src: '/generated/left.png', angle: 180 },
      { key: 'right', frame: 2, src: '/generated/right.png', angle: 0 },
      { key: 'up', frame: 3, src: '/generated/up.png', angle: 270 },
      { key: 'down', frame: 4, src: '/generated/down.png', angle: 90 },
    ],
  } satisfies { version: 2; center: { key: string; frame: number; src: string }; directions: Array<{ key: string; frame: number; src: string; angle: number }> }

  const dynamicDraft = { ...draft, avatarMode: 'dynamic' as const, avatarPreset: 'smooth' as const, avatarFrameSet: frameSet }
  const dynamic = draftToProfileDocument(dynamicDraft)
  assert.equal(dynamic.avatarMode, 'dynamic')
  assert.equal(dynamic.avatarPreset, 'smooth')
  assert.equal(dynamic.avatarFrameSet?.version, 2)
  assert.equal(dynamic.avatar.mode, 'directional')
  assert.ok(isAvatarFrameSet(dynamic.avatarFrameSet))
})

test('avatar generation helpers normalize product state and reject malformed frame sets', () => {
  assert.equal(normalizeAvatarMode('dynamic'), 'dynamic')
  assert.equal(normalizeAvatarMode('original'), 'original')
  assert.equal(normalizeAvatarMode(undefined), 'original')
  assert.equal(isAvatarFrameSet({
    version: 2,
    center: { key: 'center', frame: 0, src: '/generated/center.png' },
    directions: [{ key: 'left', frame: 1, src: '/generated/left.png', angle: 180 }],
  }), true)
  assert.equal(isAvatarFrameSet({ version: 1, center: { key: 'center', src: '/generated/center.png' }, directions: [] }), false)
})

test('onboarding and renderer never assign untrusted strings through innerHTML', async () => {
  const sources = await Promise.all([
    readFile(new URL('../profile.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/onboarding/createApp.ts', import.meta.url), 'utf8'),
  ])
  assert.doesNotMatch(sources.join('\n'), /\.innerHTML\s*=/)
})

test('structured profile section saves persist through the existing document flow', async () => {
  const source = await readFile(new URL('../src/onboarding/createApp.ts', import.meta.url), 'utf8')
  assert.match(source, /mountStructuredProfileEditor/)
  assert.match(source, /saveProfileDocument\(ownedProfile,draftToProfileDocument/)
  assert.match(source, /saveOnboardingState\(ownedProfile/)
  assert.match(source, /manualProfileButton/)
  assert.doesNotMatch(source, /window\.location\.assign\('\/preview'\)/)
})
