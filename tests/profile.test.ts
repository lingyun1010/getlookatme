import assert from 'node:assert/strict'
import test from 'node:test'
import { assertValidProfileRegistry, profileRegistry, registeredProfiles } from '../src/profile/registry.ts'
import { profileSlugFromPath, resolveProfile } from '../src/profile/resolveProfile.ts'
import type { ProfileDocument } from '../src/profile/types.ts'

function assertRequiredProfileDocument(profile: ProfileDocument): void {
  assert.ok(profile.profileId)
  assert.ok(profile.slug)
  assert.ok(profile.version > 0)
  assert.ok(profile.identity.fullName)
  assert.ok(profile.identity.preferredName)
  assert.ok(profile.identity.headline)
  assert.ok(profile.identity.summary)
  assert.ok(profile.identity.email)
  assert.ok(profile.seo.title)
  assert.ok(profile.seo.description)
  assert.ok(profile.experience.length > 0)
  assert.ok(profile.education.length > 0)
  assert.ok(profile.projects.length > 0)
  assert.ok(profile.skills.length > 0)
  assert.ok(profile.suggestedQuestions.length > 0)
  assert.ok(profile.avatar.alt)
}

test('Lingyun and Aaron satisfy the required ProfileDocument contract', () => {
  assertRequiredProfileDocument(resolveProfile('lingyun')!)
  assertRequiredProfileDocument(resolveProfile('aaron')!)
})

test('resolves root, pathname, and direct slug values through the registry', () => {
  assert.equal(profileSlugFromPath('/'), 'lingyun')
  assert.equal(resolveProfile('/')?.slug, 'lingyun')
  assert.equal(resolveProfile('/lingyun')?.identity.preferredName, 'Lingyun')
  assert.equal(resolveProfile('lingyun')?.slug, 'lingyun')
  assert.equal(resolveProfile('/aaron')?.identity.preferredName, 'Aaron')
  assert.equal(resolveProfile('aaron')?.slug, 'aaron')
})

test('returns null for an unknown profile instead of falling back to Lingyun', () => {
  assert.equal(resolveProfile('/unknown-profile'), null)
})

test('keeps profileId stable and distinct from mutable public slugs', () => {
  const lingyun = resolveProfile('lingyun')!
  const aaron = resolveProfile('aaron')!
  assert.notEqual(lingyun.profileId, aaron.profileId)
  assert.notEqual(lingyun.profileId, lingyun.slug)
  assert.notEqual(aaron.profileId, aaron.slug)
})

test('preserves Lingyun stable record IDs used by RAG source navigation', () => {
  const lingyun = resolveProfile('lingyun')!
  assert.ok(lingyun.projects.some(({ id }) => id === 'tiktok-content-agent'))
  assert.ok(lingyun.experience.some(({ id }) => id === 'embl-ebi-senior-software-engineer'))
  assert.ok(lingyun.education.some(({ id }) => id === 'phd-computer-vision'))
})

test('uses a complete directional avatar for Lingyun and a distinct fallback for Aaron', () => {
  const lingyun = resolveProfile('lingyun')!
  const aaron = resolveProfile('aaron')!
  assert.equal(lingyun.avatar.mode, 'directional')
  if (lingyun.avatar.mode === 'directional') {
    assert.equal(lingyun.avatar.directionalFrames.length, 16)
    assert.match(lingyun.avatar.centerFrame.src, /^\/profiles\/lingyun\/avatar\//)
  }
  assert.equal(aaron.avatar.mode, 'placeholder')
})

test('prevents Aaron from using the Lingyun-only RAG capability', () => {
  assert.equal(resolveProfile('lingyun')?.ai.enabled, true)
  assert.equal(resolveProfile('aaron')?.ai.enabled, false)
  assert.match(resolveProfile('aaron')?.ai.unavailableMessage ?? '', /not available/i)
})

test('registry contains unique slugs and profileIds', () => {
  assert.equal(profileRegistry.size, 2)
  assert.doesNotThrow(() => assertValidProfileRegistry(registeredProfiles))
  assert.equal(new Set(registeredProfiles.map(({ slug }) => slug)).size, registeredProfiles.length)
  assert.equal(new Set(registeredProfiles.map(({ profileId }) => profileId)).size, registeredProfiles.length)
  assert.throws(
    () => assertValidProfileRegistry([registeredProfiles[0], { ...registeredProfiles[1], slug: registeredProfiles[0].slug }]),
    /Duplicate profile slug/,
  )
})
