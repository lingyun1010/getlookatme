import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { isOwnedAssetPath, ownedAssetPath } from '../src/profile/repository.ts'
import { draftToProfileDocument } from '../src/onboarding/profileDocument.ts'
import { extractedPastedText } from '../src/onboarding/extraction.ts'
import { parseResumeDeterministically } from '../src/onboarding/parser.ts'
import { parsedResumeToDraft } from '../src/onboarding/mapping.ts'

const migration = await readFile(new URL('../supabase/migrations/202609180001_auth_profile_ownership.sql', import.meta.url), 'utf8')

test('owned asset paths are scoped by both stable user and profile IDs', () => {
  const path = ownedAssetPath('user-a', 'profile-a', 'cv', '../../resume.pdf')
  assert.equal(isOwnedAssetPath(path, 'user-a', 'profile-a'), true)
  assert.equal(isOwnedAssetPath(path, 'user-b', 'profile-a'), false)
  assert.equal(isOwnedAssetPath(path, 'user-a', 'profile-b'), false)
  assert.doesNotMatch(path, /\.\./)
})

test('persisted ProfileDocuments use database identity instead of the temporary preview identity', () => {
  const text = `Jane Example\njane@example.com\nSummary\nEngineer building reliable products.\nExperience\nEngineer at Example\nEducation\nBSc | University`
  const draft = parsedResumeToDraft(parseResumeDeterministically(extractedPastedText(text)))
  draft.identity.headline = 'Engineer'
  const document = draftToProfileDocument(draft, { profileId: '6cd294a5-f974-4e15-8d3f-51913f33b28e', slug: 'jane-profile' })
  assert.equal(document.profileId, '6cd294a5-f974-4e15-8d3f-51913f33b28e')
  assert.equal(document.slug, 'jane-profile')
})

test('migration enforces owner predicates for profile and onboarding writes', () => {
  assert.match(migration, /alter table public\.profiles enable row level security/i)
  assert.match(migration, /alter table public\.onboarding_states enable row level security/i)
  assert.match(migration, /with check \(\(select auth\.uid\(\)\) = user_id\)/i)
  assert.match(migration, /foreign key \(profile_id, user_id\)/i)
  assert.match(migration, /using \(is_published = true\)/i)
})

test('storage writes require a matching auth user folder and owned profile folder', () => {
  assert.match(migration, /storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/i)
  assert.match(migration, /p\.id::text = \(storage\.foldername\(name\)\)\[2\]/i)
  assert.match(migration, /p\.user_id = \(select auth\.uid\(\)\)/i)
  assert.match(migration, /bucket_id = 'profile-private-assets' or \(storage\.foldername\(name\)\)\[3\] = 'avatar-frames'/i)
})

test('original photos and CVs share the private bucket while public writes are frame-only', async () => {
  const onboarding = await readFile(new URL('../src/onboarding/createApp.ts', import.meta.url), 'utf8')
  assert.match(onboarding, /'profile-private-assets', 'original-photo'/)
  assert.doesNotMatch(onboarding, /'profile-public-assets', 'original-photo'/)
  assert.match(migration, /'profile-private-assets'.*false.*application\/pdf.*image\/jpeg/is)
})

test('browser configuration never accepts a service-role key', async () => {
  const source = await readFile(new URL('../src/auth/supabase.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /SERVICE_ROLE/i)
  assert.match(source, /VITE_SUPABASE_PUBLISHABLE_KEY/)
})
