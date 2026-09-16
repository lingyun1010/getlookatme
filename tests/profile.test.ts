import assert from 'node:assert/strict'
import test from 'node:test'
import { lingyunAvatar } from '../src/avatar/lingyun.ts'
import { profileSlugFromPath, resolveProfile } from '../src/profile/resolveProfile.ts'

test('resolves the root and Lingyun slug to the temporary seed profile', () => {
  assert.equal(profileSlugFromPath('/'), 'lingyun')
  assert.equal(resolveProfile('/')?.slug, 'lingyun')
  assert.equal(resolveProfile('/lingyun')?.slug, 'lingyun')
  assert.equal(resolveProfile('/lingyun/'), resolveProfile('/lingyun'))
})

test('does not silently render Lingyun for an unknown profile slug', () => {
  assert.equal(resolveProfile('/aaron'), null)
})

test('keeps the runtime avatar manifest complete and profile-scoped', () => {
  assert.equal(lingyunAvatar.directions.length, 16)
  assert.match(lingyunAvatar.center.src, /^\/profiles\/lingyun\/avatar\//)
  assert.ok(lingyunAvatar.directions.every((frame) => frame.src.startsWith('/profiles/lingyun/avatar/')))
  assert.equal(new Set(lingyunAvatar.directions.map((frame) => frame.key)).size, 16)
})
