import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { resolveChatAvatar } from '../src/chat/avatar.ts'
import { evidenceProfileId } from '../src/chat/evidence.ts'
import { parsedResumeToDraft } from '../src/onboarding/mapping.ts'
import { parseResumeDeterministically } from '../src/onboarding/parser.ts'
import { draftToProfileDocument } from '../src/onboarding/profileDocument.ts'
import { extractedPastedText } from '../src/onboarding/extraction.ts'
import { generateExampleQuestions } from '../src/profile/exampleQuestions.ts'
import { resolveProfile } from '../src/profile/resolveProfile.ts'

const source = `Jane Example
jane@example.com
Summary
Engineer building accessible TypeScript products.
Skills
TypeScript, Accessibility, Testing
Experience
Senior Engineer at Example Co
Education
BSc Computer Science | Example University
Projects
Open Tools | Developer tooling`

const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8')

test('portfolio header exposes a profile-aware Chat entry', async () => {
  const renderer = await read('../profile.html')
  assert.match(renderer, /<nav class="nav"[\s\S]*id="profileChatLink">Chat<\/a>/)
  assert.match(renderer, /profileChatLink"\)\.href = `\/\$\{encodeURIComponent\(profile\.slug\)\}\/chat`/)
})

test('onboarding stores three to five deterministic profile-aware example questions', () => {
  const profile = draftToProfileDocument(parsedResumeToDraft(parseResumeDeterministically(extractedPastedText(source))))
  assert.ok(profile.suggestedQuestions.length >= 3 && profile.suggestedQuestions.length <= 5)
  assert.ok(profile.suggestedQuestions.some((question) => /Open Tools|TypeScript|Senior Engineer/.test(question)))
  assert.deepEqual(profile.suggestedQuestions, generateExampleQuestions({
    preferredName: profile.identity.preferredName, projects: profile.projects, skills: profile.skills,
    experience: profile.experience, education: profile.education,
  }))
})

test('quick and dedicated chat consume the same ProfileDocument question set', async () => {
  const [renderer, chatPage] = await Promise.all([read('../profile.html'), read('../src/chat/chatPage.ts')])
  assert.match(renderer, /const suggestedQuestions = profile\.suggestedQuestions/)
  assert.match(chatPage, /const suggested = profile\.suggestedQuestions\.slice\(0, 5\)/)
  assert.doesNotMatch(chatPage, /What kind of work|Which projects best/)
})

test('question buttons invoke their existing chat submit paths', async () => {
  const [renderer, chatPage] = await Promise.all([read('../profile.html'), read('../src/chat/chatPage.ts')])
  assert.match(renderer, /askAvatar\(button\.dataset\.question\)/)
  assert.match(chatPage, /addEventListener\('click', \(\) => void submit\(question\)\)/)
})

test('chat avatar prefers the generated center frame', () => {
  const profile = structuredClone(resolveProfile('aaron')!)
  profile.avatarFrameSet = { version: 2, center: { key: 'center', src: '/center.png' }, directions: [{ key: 'left', angle: 180, src: '/left.png' }] }
  profile.avatarImageUrl = '/photo.png'
  assert.deepEqual(resolveChatAvatar(profile), { kind: 'image', src: '/center.png', alt: profile.avatar.alt })
})

test('chat avatar falls back through profile photo, legacy center, and initials', () => {
  const placeholder = structuredClone(resolveProfile('aaron')!)
  placeholder.avatarImageUrl = '/photo.png'
  assert.equal(resolveChatAvatar(placeholder).kind, 'image')
  const legacy = resolveChatAvatar(resolveProfile('lingyun')!)
  assert.equal(legacy.kind, 'image')
  if (legacy.kind === 'image') assert.match(legacy.src, /center\.png$/)
  delete placeholder.avatarImageUrl
  assert.deepEqual(resolveChatAvatar(placeholder), { kind: 'initials', initials: 'AE', alt: placeholder.avatar.alt })
})

test('chat add-on consumes template tokens without importing template layout CSS', async () => {
  const [page, styles] = await Promise.all([read('../chat.html'), read('../src/chat/chat.css')])
  assert.match(page, /kinetic\/tokens\.css/)
  assert.doesNotMatch(page, /kinetic\/kinetic\.css/)
  assert.match(styles, /var\(--portfolio-background\)/)
  assert.match(styles, /var\(--portfolio-font\)/)
})

test('each evidence source carries its own navigation target when source refs repeat', () => {
  const sources = [
    { id: 'chunk-1', type: 'project', title: 'Project A — part 1', sourceRef: 'project-a' },
    { id: 'chunk-2', type: 'project', title: 'Project A — part 2', sourceRef: 'project-a' },
    { id: 'chunk-3', type: 'experience', title: 'Experience B', sourceRef: 'experience-b' },
  ]
  assert.deepEqual(sources.map(evidenceProfileId), ['project-a', 'project-a', 'experience-b'])
})
