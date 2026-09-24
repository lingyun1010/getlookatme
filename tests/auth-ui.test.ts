import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { safeAuthRedirect } from '../src/auth/authActions.ts'

const landing = await readFile(new URL('../index.html', import.meta.url), 'utf8')
const modal = await readFile(new URL('../src/auth/AuthModal.ts', import.meta.url), 'utf8')
const form = await readFile(new URL('../src/auth/AuthForm.ts', import.meta.url), 'utf8')
const authPage = await readFile(new URL('../auth.html', import.meta.url), 'utf8')
const vercel = await readFile(new URL('../vercel.json', import.meta.url), 'utf8')

test('landing auth triggers declare the correct reusable modal modes', () => {
  assert.match(landing, /class="sign-in" data-auth-mode="sign-in"/)
  assert.match(landing, /class="button button-small auth-cta" data-auth-mode="sign-up"/)
})

test('auth modal provides the required keyboard and focus behavior', () => {
  assert.match(modal, /aria-modal/)
  assert.match(modal, /e\.key==='Escape'/)
  assert.match(modal, /e\.key!=='Tab'/)
  assert.match(modal, /this\.trigger\?\.focus\(\)/)
})

test('one AuthForm owns sign in, sign up, confirmation and password recovery', () => {
  assert.match(form, /signIn\(email,\s*password\)/)
  assert.match(form, /signUp\(email,\s*password\)/)
  assert.match(form, /signInWithOAuth\(provider,\s*redirectTo\)/)
  assert.match(form, /google/)
  assert.match(form, /linkedin_oidc/)
  assert.match(form, /github/)
  assert.match(form, /sendPasswordReset/)
  assert.match(form, /updatePassword/)
  assert.match(form, /confirmation/)
  assert.match(authPage, /src\/auth\/authPage\.ts/)
})

test('standalone login and signup routes share the auth page', () => {
  assert.match(vercel, /"source": "\/login", "destination": "\/auth\.html"/)
  assert.match(vercel, /"source": "\/signup", "destination": "\/auth\.html"/)
  assert.doesNotMatch(authPage, /profile\/templates\/kinetic/)
})

test('auth redirects allow internal paths and reject open redirects', () => {
  const origin = 'https://getlookatme.example'
  assert.equal(safeAuthRedirect('/dashboard?tab=profile', '/create', origin), '/dashboard?tab=profile')
  assert.equal(safeAuthRedirect('https://evil.example', '/create', origin), '/create')
  assert.equal(safeAuthRedirect('//evil.example/path', '/create', origin), '/create')
  assert.equal(safeAuthRedirect('/\\evil.example', '/create', origin), '/create')
})
