import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8')

test('the Beta funnel is emitted from the active runtime paths', async () => {
  const [migration, onboarding, worker, publication, profilePage, rag, dashboard, billing, landing] = await Promise.all([
    read('../supabase/migrations/202609210004_beta_funnel_analytics.sql'),
    read('../src/onboarding/createApp.ts'),
    read('../src/avatar/worker.ts'),
    read('../src/profile/publicationRequest.ts'),
    read('../index.html'),
    read('../src/rag/serverChat.ts'),
    read('../src/dashboard/dashboardApp.ts'),
    read('../src/billing/request.ts'),
    read('../src/landing/landing.ts'),
  ])
  assert.match(migration, /signup_completed/)
  assert.match(onboarding, /trackFunnelEvent\('cv_uploaded'\)/)
  assert.match(onboarding, /trackFunnelEvent\('cv_parsed'\)/)
  assert.match(worker, /eventType: 'avatar_generated'/)
  assert.match(publication, /eventType: 'profile_published'/)
  assert.match(profilePage, /trackFunnelEvent\("public_profile_viewed"/)
  assert.match(rag, /eventType: 'rag_question_asked'/)
  assert.match(dashboard, /trackFunnelEvent\('upgrade_clicked'\)/)
  assert.match(billing, /'checkout_started'/)
  assert.match(billing, /'subscription_activated'/)
  assert.match(landing, /trackFunnelEvent\('create_profile_clicked'\)/)
})

test('local and production analytics routes use the same request handler', async () => {
  const [localApi, productionApi, handler] = await Promise.all([
    read('../scripts/dev-api.ts'),
    read('../api/analytics.ts'),
    read('../src/analytics/request.ts'),
  ])
  assert.match(localApi, /handleAnalyticsRequest/)
  assert.match(productionApi, /handleAnalyticsRequest/)
  assert.match(handler, /authenticateBearer/)
  assert.match(handler, /\.eq\('is_published', true\)/)
  assert.doesNotMatch(handler, /metadata:/)
})
