import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_PUBLISHABLE_KEY
const emailA = process.env.M2_TEST_USER_A_EMAIL
const emailB = process.env.M2_TEST_USER_B_EMAIL
const password = process.env.M2_TEST_PASSWORD
const phase = process.argv[2]

assert.ok(url && key && emailA && emailB && password, 'Live Supabase and test-user environment variables are required')

function client(storage?: Map<string, string>): SupabaseClient {
  return createClient(url, key, {
    auth: storage ? {
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: {
        getItem: (name) => storage.get(name) ?? null,
        setItem: (name, value) => { storage.set(name, value) },
        removeItem: (name) => { storage.delete(name) },
      },
    } : { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

if (phase === 'signup') {
  for (const [label, email] of [['A', emailA], ['B', emailB]] as const) {
    const { data, error } = await client().auth.signUp({ email, password })
    assert.ifError(error)
    assert.ok(data.user?.id, `User ${label} should be created`)
    console.log(JSON.stringify({ label, email, userId: data.user.id, sessionCreated: Boolean(data.session) }))
  }
  process.exit(0)
}

assert.equal(phase, 'validate', 'Use signup or validate phase')

const storageA = new Map<string, string>()
const a = client(storageA)
const b = client()
const anon = client()
const signInA = await a.auth.signInWithPassword({ email: emailA, password })
const signInB = await b.auth.signInWithPassword({ email: emailB, password })
assert.ifError(signInA.error)
assert.ifError(signInB.error)
const userA = signInA.data.user!
const userB = signInB.data.user!
assert.notEqual(userA.id, userB.id)

const restoredA = client(storageA)
const restoredSession = await restoredA.auth.getSession()
assert.ifError(restoredSession.error)
assert.equal(restoredSession.data.session?.user.id, userA.id, 'session persists into a new client')

const profileResultA = await a.from('profiles').select('*').eq('user_id', userA.id).single()
const profileResultB = await b.from('profiles').select('*').eq('user_id', userB.id).single()
assert.ifError(profileResultA.error)
assert.ifError(profileResultB.error)
const profileA = profileResultA.data
const profileB = profileResultB.data

const cvPath = `${userA.id}/${profileA.id}/cv/live-test.pdf`
const photoPath = `${userA.id}/${profileA.id}/original-photo/live-test.png`
const framePath = `${userA.id}/${profileA.id}/avatar-frames/live-test.png`
const pdf = new Blob(['%PDF-1.4 live validation'], { type: 'application/pdf' })
const png = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' })

assert.ifError((await a.storage.from('profile-private-assets').upload(cvPath, pdf)).error)
assert.ifError((await a.storage.from('profile-private-assets').upload(photoPath, png)).error)
assert.ifError((await a.storage.from('profile-public-assets').upload(framePath, png)).error)

const draft = { identity: { fullName: 'M2 User A' }, marker: 'persisted-live' }
const onboardingUpdate = await a.from('onboarding_states').update({
  draft,
  cv_path: cvPath,
  original_photo_path: photoPath,
  avatar_frame_paths: [framePath],
  avatar_metadata: { validated: true },
  selected_avatar_mode: 'dynamic',
}).eq('profile_id', profileA.id).select().single()
assert.ifError(onboardingUpdate.error)

const frameUrl = a.storage.from('profile-public-assets').getPublicUrl(framePath).data.publicUrl
const document = {
  profileId: profileA.id,
  slug: profileA.slug,
  version: 1,
  identity: { fullName: 'M2 User A', preferredName: 'M2A', headline: 'Validation profile', summary: 'Live M2 validation.', introduction: 'Live M2 validation.', email: emailA },
  seo: { title: 'M2 validation', description: 'Live M2 validation profile.' },
  highlights: [], skills: [], services: [], experience: [], education: [], projects: [], focusAreas: [], suggestedQuestions: [],
  avatar: { mode: 'directional', alt: 'Validation avatar', centerFrame: { key: 'center', frame: 0, src: frameUrl }, directionalFrames: [{ key: 'right', frame: 0, src: frameUrl, angle: 0 }] },
  avatarMode: 'dynamic', avatarFrameSet: { version: 2, center: { key: 'center', src: frameUrl }, directions: [{ key: 'right', src: frameUrl, angle: 0 }] },
  presentation: { servicesIntro: '', contactHeading: '' }, ai: { enabled: false },
}
assert.ifError((await a.from('profiles').update({ document }).eq('id', profileA.id)).error)

const reloginA = client()
assert.ifError((await reloginA.auth.signInWithPassword({ email: emailA, password })).error)
const persisted = await reloginA.from('onboarding_states').select('*').eq('profile_id', profileA.id).single()
assert.ifError(persisted.error)
assert.equal(persisted.data.draft.marker, 'persisted-live')
assert.equal(persisted.data.cv_path, cvPath)
assert.equal(persisted.data.original_photo_path, photoPath)
assert.deepEqual(persisted.data.avatar_frame_paths, [framePath])

for (const table of ['profiles', 'onboarding_states'] as const) {
  const idColumn = table === 'profiles' ? 'id' : 'profile_id'
  const aId = profileA.id
  const hidden = await b.from(table).select('*').eq(idColumn, aId)
  assert.ifError(hidden.error)
  assert.equal(hidden.data.length, 0, `B cannot read A ${table}`)
  const changed = await b.from(table).update(table === 'profiles' ? { slug: `stolen-${profileA.id.slice(0, 8)}` } : { selected_avatar_mode: 'original' }).eq(idColumn, aId).select()
  assert.ifError(changed.error)
  assert.equal(changed.data.length, 0, `B cannot update A ${table}`)
  const removed = await b.from(table).delete().eq(idColumn, aId).select()
  assert.ifError(removed.error)
  assert.equal(removed.data.length, 0, `B cannot delete A ${table}`)
}

for (const path of [cvPath, photoPath]) {
  assert.ifError((await a.storage.from('profile-private-assets').download(path)).error)
  assert.ok((await b.storage.from('profile-private-assets').download(path)).error, `B cannot download ${path}`)
}
assert.ok((await anon.storage.from('profile-private-assets').download(cvPath)).error, 'anonymous CV download is denied')
assert.ok((await anon.storage.from('profile-private-assets').download(photoPath)).error, 'anonymous original-photo download is denied')
assert.equal((await fetch(frameUrl)).status, 200, 'published frame URL is publicly downloadable')

assert.ok((await b.storage.from('profile-public-assets').upload(`${userA.id}/${profileA.id}/avatar-frames/b-intrusion.png`, png)).error, 'B cannot upload into A frame path')
await b.storage.from('profile-private-assets').remove([cvPath, photoPath])
await b.storage.from('profile-public-assets').remove([framePath])
assert.ifError((await a.storage.from('profile-private-assets').download(cvPath)).error)
assert.equal((await fetch(frameUrl)).status, 200, 'B cannot delete A public frame')

const beforePublish = await anon.from('profiles').select('id').eq('id', profileA.id)
assert.ifError(beforePublish.error)
assert.equal(beforePublish.data.length, 0, 'unpublished profile is not public')
assert.ifError((await a.from('profiles').update({ is_published: true }).eq('id', profileA.id)).error)
const published = await anon.from('profiles').select('id,slug,document').eq('id', profileA.id).single()
assert.ifError(published.error)
assert.equal(published.data.document.profileId, profileA.id)
const stillPrivate = await anon.from('onboarding_states').select('*').eq('profile_id', profileA.id)
assert.ok(stillPrivate.error, 'anonymous onboarding access has no grant')
assert.ok((await anon.storage.from('profile-private-assets').download(photoPath)).error, 'original remains private after publishing')

const bCanSeePublished = await b.from('profiles').select('id').eq('id', profileA.id).single()
assert.ifError(bCanSeePublished.error)
assert.equal(bCanSeePublished.data.id, profileA.id, 'published profile is intentionally readable')
const bStillCannotPreviewState = await b.from('onboarding_states').select('*').eq('profile_id', profileA.id)
assert.equal(bStillCannotPreviewState.data?.length, 0)

assert.ifError((await restoredA.auth.signOut()).error)
assert.equal((await restoredA.auth.getSession()).data.session, null, 'sign out clears persisted session')

console.log(JSON.stringify({
  ok: true,
  users: { a: userA.id, b: userB.id },
  profiles: { a: profileA.id, b: profileB.id },
  checks: ['auth', 'session', 'profile ownership', 'onboarding persistence', 'private CV', 'private original photo', 'public frames', 'published profile', 'sign out'],
}))
