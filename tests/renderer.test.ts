import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const renderer = await readFile(new URL('../index.html', import.meta.url), 'utf8')
const landing = await readFile(new URL('../landing.html', import.meta.url), 'utf8')
const kineticStyles = await readFile(new URL('../src/profile/templates/kinetic/kinetic.css', import.meta.url), 'utf8')

test('product and portfolio template styles have separate entry boundaries', () => {
  assert.match(renderer, /class="portfolio-page portfolio-template-kinetic"/)
  assert.match(renderer, /\/src\/profile\/templates\/kinetic\/kinetic\.css/)
  assert.doesNotMatch(renderer, /src\/landing\/landing\.css/)
  assert.match(landing, /src\/landing\/landing\.css/)
  assert.doesNotMatch(landing, /src\/profile\/templates\//)
})

test('the current portfolio template owns its page-level visual defaults', () => {
  assert.match(kineticStyles, /body\.portfolio-template-kinetic\s*\{/)
  assert.match(kineticStyles, /\.portfolio-template-kinetic a\s*\{/)
  assert.doesNotMatch(kineticStyles, /\.site-header|\.final-cta|\.auth-cta/)
})

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
  const request = renderer.indexOf('await askProfile(profile.slug')
  assert.ok(guard >= 0)
  assert.ok(request > guard)
})

test('the frontend AI guard still prevents true temporary previews from reaching chat', () => {
  const guard = renderer.indexOf('if (!profile.ai.enabled) return;')
  const request = renderer.indexOf('await askProfile(profile.slug')
  assert.ok(guard >= 0)
  assert.ok(request > guard)
  assert.match(renderer, /chatInput\.disabled = !profile\.ai\.enabled/)
  assert.match(renderer, /chatSubmit\.disabled = !profile\.ai\.enabled/)
})
