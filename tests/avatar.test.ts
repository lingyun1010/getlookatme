import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { resolveProfileAvatar } from '../src/avatar/resolution.ts'
import { canRetryAvatarJob, isAvatarJobStatus } from '../src/avatar/types.ts'
import { resolveProfile } from '../src/profile/resolveProfile.ts'

const migration = await readFile(new URL('../supabase/migrations/202609190001_avatar_assets_jobs.sql', import.meta.url), 'utf8')
const createPage = await readFile(new URL('../create.html', import.meta.url), 'utf8')
const createApp = await readFile(new URL('../src/onboarding/createApp.ts', import.meta.url), 'utf8')
const worker = await readFile(new URL('../src/avatar/worker.ts', import.meta.url), 'utf8')

const frames = { version: 2 as const, center: { key: 'center', src: '/center.png' }, directions: [{ key: 'left', angle: 180, src: '/left.png' }] }

test('CV onboarding presents PDF/DOCX only and includes LinkedIn download guidance', () => {
  assert.match(createPage, /accept="\.pdf,\.docx/)
  assert.doesNotMatch(createPage, /resumeText|Paste resume text/)
  assert.match(createPage, /Using LinkedIn\? Download your LinkedIn profile as a PDF/)
  assert.doesNotMatch(createApp, /avatar|photoFile|extractedPastedText/)
})

test('avatar fallback prefers active generated, then original photo, then initials', () => {
  const base = resolveProfile('aaron')!
  const active = resolveProfileAvatar(base, { activeFrameSet: frames, originalPhotoUrl: '/photo.png' })
  assert.equal(active.avatarMode, 'dynamic'); assert.equal(active.avatarFrameSet, frames); assert.equal(active.avatarImageUrl, undefined)
  const original = resolveProfileAvatar(base, { originalPhotoUrl: '/photo.png' })
  assert.equal(original.avatarMode, 'original'); assert.equal(original.avatarImageUrl, '/photo.png')
  const initials = resolveProfileAvatar(base, {})
  assert.equal(initials.avatarImageUrl, undefined); assert.equal(initials.avatar.mode, 'placeholder')
})

test('avatar job states and retry path are constrained', () => {
  for (const state of ['queued', 'generating', 'ready', 'failed']) assert.equal(isAvatarJobStatus(state), true)
  assert.equal(isAvatarJobStatus('complete'), false)
  assert.equal(canRetryAvatarJob({ status: 'failed' }), true)
  assert.equal(canRetryAvatarJob({ status: 'ready' }), false)
})

test('worker claim and asset upsert make duplicate processing idempotent without activation', () => {
  assert.match(migration, /for update skip locked/i)
  assert.match(migration, /generation_job_id uuid not null unique/i)
  assert.match(worker, /upsert\(/)
  assert.match(worker, /onConflict: 'generation_job_id'/)
  assert.doesNotMatch(worker, /active_avatar_id/)
})

test('multiple avatar assets are retained and activation is ownership constrained', () => {
  assert.doesNotMatch(migration, /unique \(profile_id\)/i)
  assert.match(migration, /profiles_active_avatar_owner_fk/i)
  assert.match(migration, /foreign key \(active_avatar_id, user_id, id\)/i)
  assert.match(migration, /Owners can delete inactive avatars/i)
})

test('durable avatar records contain paths and never signed URLs', () => {
  assert.match(migration, /source_photo_path text not null/i)
  assert.match(migration, /center_frame_path text not null/i)
  assert.match(migration, /frame_paths text\[\]/i)
  assert.doesNotMatch(migration, /signed_url|signedUrl/i)
})

test('avatar assets and jobs have owner-scoped RLS', () => {
  assert.match(migration, /alter table public\.avatars enable row level security/i)
  assert.match(migration, /alter table public\.avatar_generation_jobs enable row level security/i)
  assert.match(migration, /Owners can read avatars[\s\S]*auth\.uid\(\)\) = user_id/i)
  assert.match(migration, /Owners can read avatar jobs[\s\S]*auth\.uid\(\)\) = user_id/i)
})
