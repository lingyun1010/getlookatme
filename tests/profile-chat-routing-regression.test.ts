import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { lingyunProfile } from '../src/profile/profiles/lingyun.ts'
import { profileSlugFromPath, resolveProfile } from '../src/profile/resolveProfile.ts'

const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8')

test('a direct fresh /:slug load resolves the requested profile with populated content', () => {
  const profile = resolveProfile('/lingyun')
  assert.equal(profile?.profileId, lingyunProfile.profileId)
  assert.ok(profile?.projects.length)
  assert.ok(profile?.experience.length)
})

test('profile slug parsing remains independent of query strings and navigation state', () => {
  assert.equal(profileSlugFromPath('/lingyun'), 'lingyun')
  assert.equal(profileSlugFromPath('/lingyun?message=ignored'), 'lingyun?message=ignored')
})

test('the direct /:slug/chat rewrite is ordered before the /:slug profile rewrite', async () => {
  const routes = await read('../vercel.json')
  assert.ok(routes.indexOf('"source": "/:slug/chat"') < routes.indexOf('"source": "/:slug"'))
})

test('chat derives the same first path segment used by profile slug resolution', async () => {
  const chat = await read('../src/chat/chatPage.ts')
  assert.match(chat, /window\.location\.pathname\.split\('\/'\)\.filter\(Boolean\)/)
  assert.equal(profileSlugFromPath('/lingyun/chat'), 'lingyun')
})

test('neither direct profile nor direct chat loading requires navigation state', async () => {
  const [profilePage, chatPage] = await Promise.all([read('../index.html'), read('../src/chat/chatPage.ts')])
  assert.match(profilePage, /loadPublicProfile\(requestedSlug\)/)
  assert.match(chatPage, /loadPublicProfile\(slug\)/)
  assert.ok(chatPage.indexOf('loadPublicProfile(slug)') < chatPage.indexOf('consumeTransferredConversation(slug)'))
})

test('published anonymous profile loading remains the first database lookup for both routes', async () => {
  const [profilePage, chatPage] = await Promise.all([read('../index.html'), read('../src/chat/chatPage.ts')])
  assert.match(profilePage, /resolveProfile\(window\.location\.pathname\).*loadPublicProfile\(requestedSlug\)/s)
  assert.ok(chatPage.indexOf('loadPublicProfile(slug)') < chatPage.indexOf('loadCurrentUserProfileDocument()'))
})

test('owner draft preview remains authenticated and loads the current owner profile', async () => {
  const profilePage = await read('../index.html')
  assert.match(profilePage, /pathname === "\/preview".*requireAuthenticatedUser/s)
  assert.match(profilePage, /pathname === "\/preview"[\s\S]*loadCurrentUserProfileDocument\(\)/)
})

test('wrong or missing chat slugs fail explicitly instead of rendering an empty profile', async () => {
  const chatPage = await read('../src/chat/chatPage.ts')
  assert.match(chatPage, /if \(!profile \|\| parts\[1\] !== 'chat'\)/)
  assert.match(chatPage, /Profile not found/)
  assert.match(chatPage, /throw new Error\('Profile chat not found'\)/)
})

test('browser entry modules do not import the server environment config', async () => {
  const [client, chatPage, limits] = await Promise.all([
    read('../src/chat/client.ts'), read('../src/chat/chatPage.ts'), read('../src/rag/limits.ts'),
  ])
  assert.doesNotMatch(client + chatPage + limits, /rag\/config|process\.env/)
})

test('quick-chat submission is intercepted before calling the shared POST client', async () => {
  const [profilePage, client] = await Promise.all([read('../index.html'), read('../src/chat/client.ts')])
  assert.match(profilePage, /chatForm\.addEventListener\("submit", \(event\) => \{\s*event\.preventDefault\(\);\s*askAvatar/s)
  assert.match(client, /method: 'POST'/)
  assert.match(client, /`\$\{apiBaseUrl\}\/api\/chat`/)
})
