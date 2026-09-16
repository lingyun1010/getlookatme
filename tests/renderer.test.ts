import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const renderer = await readFile(new URL('../index.html', import.meta.url), 'utf8')

test('shared renderer does not assign profile-derived content through innerHTML', () => {
  assert.doesNotMatch(renderer, /\.innerHTML\s*=/)
  assert.doesNotMatch(renderer, /renderList\s*\(/)
})

test('shared renderer contains no known Lingyun-specific presentation values', () => {
  assert.doesNotMatch(renderer, /Lingyun/i)
  assert.doesNotMatch(renderer, /production-systems/)
  assert.doesNotMatch(renderer, /Focused engineering work across AI product systems/)
  assert.doesNotMatch(renderer, /Let us build useful AI with a little visual magic/)
})

test('shared renderer uses explicit featured selectors instead of array position', () => {
  assert.match(renderer, /featuredExperience\(profile\)/)
  assert.match(renderer, /featuredEducation\(profile\)/)
  assert.doesNotMatch(renderer, /profile\.experience\[0\]/)
})

test('shared renderer keeps Aaron AI disabled before any chat request', () => {
  const guard = renderer.indexOf('if (!profile.ai.enabled) return;')
  const request = renderer.indexOf('fetch(`${apiBaseUrl}/api/chat`')
  assert.ok(guard >= 0)
  assert.ok(request > guard)
})
