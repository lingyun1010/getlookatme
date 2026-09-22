import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const page = await readFile(new URL('../dashboard.html', import.meta.url), 'utf8')
const app = await readFile(new URL('../src/dashboard/dashboardApp.ts', import.meta.url), 'utf8')
const css = await readFile(new URL('../src/dashboard/dashboard.css', import.meta.url), 'utf8')
const routes = await readFile(new URL('../vercel.json', import.meta.url), 'utf8')
const createPage = await readFile(new URL('../create.html', import.meta.url), 'utf8')
const createWorkspace = await readFile(new URL('../src/onboarding/createWorkspaceApp.ts', import.meta.url), 'utf8')
const shell = await readFile(new URL('../src/dashboard/DashboardShell.ts', import.meta.url), 'utf8')

test('dashboard is an authenticated product route', () => {
  assert.match(routes, /"\/dashboard", "destination": "\/dashboard\.html"/)
  assert.match(app, /requireAuthenticatedUser\(initialRoute\)/)
  assert.match(page, /src\/dashboard\/dashboard\.css/)
  assert.doesNotMatch(page, /profile\/templates\/kinetic/)
})

test('profile actions distinguish published profile, working preview, and save publication', () => {
  assert.match(shell, /Preview/)
  assert.match(shell, /Publish/)
  assert.match(shell, /statusBadge\.textContent=published\?'Published':'Draft'/)
  assert.match(createPage, /Working Preview ↗/)
  assert.match(createPage, /id="saveProfileButton"/)
  assert.match(createWorkspace, /createApp/)
  assert.match(app, /published,slug:currentSlug/)
  assert.match(app, /requestPublication/)
  assert.match(app, /button\('Save URL'/)
  assert.match(app, /button\('Publish'/)
  assert.match(app, /id='profileUrl'/)
  assert.match(app, /\/dashboard\/pages/)
})

test('dashboard derives overview state from owned profile data', () => {
  assert.match(app, /getOwnedProfile\(user\)/)
  assert.match(app, /loadOnboardingState\(profile\)/)
  assert.match(app, /published/)
  assert.match(app, /state\?\.cv_path/)
  assert.match(app, /getCurrentUserMonthlyUsage/)
  assert.match(app, /planConfig\.name/)
})

test('unfinished dashboard capabilities are visibly disabled', () => {
  assert.match(page, /No activity yet/)
  assert.match(app, /requestPublication/)
  assert.match(app, /button\('Publish'/)
  assert.match(css, /\.dashboard-sidebar \.disabled/)
  assert.match(shell, /Coming next/)
})

test('create workspace is mounted inside the shared authenticated dashboard shell', () => {
  assert.match(routes, /"source": "\/dashboard\/create", "destination": "\/dashboard\.html"/)
  assert.match(routes, /"source": "\/create", "destination": "\/dashboard\/create"/)
  assert.match(app, /requireAuthenticatedUser\(initialRoute\)/)
  assert.match(app, /mountDashboardShell/)
  assert.match(createWorkspace, /controllerStarted/)
  assert.match(createWorkspace, /import\('\.\/createApp\.ts'\)/)
  assert.match(createPage, /createWorkspaceTemplate/)
  assert.match(createPage, /src\/dashboard\/dashboard\.css/)
  assert.doesNotMatch(createPage, /profile\/templates\/kinetic/)
  assert.match(app, /\/dashboard\/create/)
})

test('dashboard uses History API routing without remounting its shell', () => {
  assert.match(app, /history\.pushState/)
  assert.match(app, /addEventListener\('popstate'/)
  assert.match(app, /shell\.content\.replaceChildren\(view\)/)
  assert.equal((app.match(/mountDashboardShell\(/g) ?? []).length, 1)
  assert.match(app, /createAvatarPage\(profile,state\)/)
  assert.match(routes, /"source": "\/dashboard\/profile", "destination": "\/dashboard\.html"/)
  assert.match(routes, /"source": "\/dashboard\/avatar", "destination": "\/dashboard\.html"/)
  assert.match(routes, /"source": "\/dashboard\/pages", "destination": "\/dashboard\.html"/)
})

test('dashboard creator actions stay in the dashboard workspace', () => {
  assert.doesNotMatch(page, /href="\/create/)
  assert.match(page, /href="\/dashboard\/create/)
})

test('pages section owns public slug editing and publication controls', () => {
  assert.match(app, /createPagesView/)
  assert.match(app, /save-slug/)
  assert.match(app, /availability/)
  assert.match(app, /slugInput/)
  assert.match(app, /View profile/)
  assert.match(app, /Unpublish/)
  assert.doesNotMatch(page, /id="profileUrl"/)
})
