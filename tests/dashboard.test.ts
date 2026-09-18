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
  assert.match(app, /requireAuthenticatedUser\('\/dashboard'\)/)
  assert.match(page, /src\/dashboard\/dashboard\.css/)
  assert.doesNotMatch(page, /profile\/templates\/kinetic/)
})

test('dashboard derives overview state from owned profile data', () => {
  assert.match(app, /getOwnedProfile\(user\)/)
  assert.match(app, /loadOnboardingState\(profile\)/)
  assert.match(app, /profile\.is_published/)
  assert.match(app, /state\?\.cv_path/)
  assert.match(app, /state\?\.avatar_frame_paths/)
})

test('unfinished dashboard capabilities are visibly disabled', () => {
  assert.match(page, /Persistent knowledge base · Coming soon/)
  assert.match(app, /Publish · Coming soon/)
  assert.match(page, /No activity yet/)
  assert.match(css, /\.dashboard-sidebar \.disabled/)
})

test('create workspace is mounted inside the shared authenticated dashboard shell', () => {
  assert.match(routes, /"source": "\/dashboard\/create", "destination": "\/create\.html"/)
  assert.match(routes, /"source": "\/create", "destination": "\/dashboard\/create"/)
  assert.match(createWorkspace, /requireAuthenticatedUser\('\/dashboard\/create'\)/)
  assert.match(createWorkspace, /mountDashboardShell\(content/)
  assert.match(createWorkspace, /import\('\.\/createApp\.ts'\)/)
  assert.match(createPage, /createWorkspaceTemplate/)
  assert.match(createPage, /src\/dashboard\/dashboard\.css/)
  assert.doesNotMatch(createPage, /profile\/templates\/kinetic/)
  assert.match(shell, /\/dashboard\/create/)
})

test('dashboard creator actions stay in the dashboard workspace', () => {
  assert.doesNotMatch(page, /href="\/create/)
  assert.match(page, /href="\/dashboard\/create/)
})
