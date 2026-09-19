import type { User } from '@supabase/supabase-js'
import type { AvatarFrameSet } from 'lookatme-avatar'
import type { ProfileDocument } from './types.ts'
import type { ProfileDocumentDraft } from '../onboarding/types.ts'
import { requireSupabase } from '../auth/supabase.ts'
import { resolveProfileAvatar } from '../avatar/resolution.ts'
import type { AvatarAsset } from '../avatar/types.ts'

export interface OwnedProfile {
  id: string
  user_id: string
  slug: string
  document: ProfileDocument | Record<string, never>
  is_published: boolean
  active_avatar_id: string | null
}

export interface OnboardingState {
  profile_id: string
  user_id: string
  draft: ProfileDocumentDraft | null
  cv_path: string | null
  original_photo_path: string | null
  avatar_frame_paths: string[]
  avatar_metadata: Record<string, unknown>
  selected_avatar_mode: 'original' | 'dynamic'
}

export function ownedAssetPath(userId: string, profileId: string, kind: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/\.{2,}/g, '.').replace(/^[.-]+|[.-]+$/g, '') || 'asset'
  return `${userId}/${profileId}/${kind}/${crypto.randomUUID()}-${safeName}`
}

export function isOwnedAssetPath(path: string, userId: string, profileId: string): boolean {
  return path.startsWith(`${userId}/${profileId}/`)
}

export async function getOwnedProfile(user: User): Promise<OwnedProfile> {
  const client = requireSupabase()
  const { data, error } = await client.from('profiles').select('id,user_id,slug,document,is_published,active_avatar_id').eq('user_id', user.id).order('created_at').limit(1).single()
  if (error) throw error
  return data as OwnedProfile
}

export async function loadOnboardingState(profile: OwnedProfile): Promise<OnboardingState | null> {
  const { data, error } = await requireSupabase().from('onboarding_states').select('*').eq('profile_id', profile.id).maybeSingle()
  if (error) throw error
  return data as OnboardingState | null
}

export async function saveOnboardingState(profile: OwnedProfile, values: Partial<Omit<OnboardingState, 'profile_id' | 'user_id'>>): Promise<void> {
  const { error } = await requireSupabase().from('onboarding_states').upsert({ profile_id: profile.id, user_id: profile.user_id, ...values }, { onConflict: 'profile_id' })
  if (error) throw error
}

export async function saveProfileDocument(profile: OwnedProfile, document: ProfileDocument): Promise<void> {
  const { error } = await requireSupabase().from('profiles').update({ document }).eq('id', profile.id).eq('user_id', profile.user_id)
  if (error) throw error
}

export async function uploadProfileAsset(profile: OwnedProfile, bucket: 'profile-private-assets' | 'profile-public-assets', kind: string, file: Blob, fileName: string): Promise<{ path: string; publicUrl?: string }> {
  const client = requireSupabase()
  const path = ownedAssetPath(profile.user_id, profile.id, kind, fileName)
  const { error } = await client.storage.from(bucket).upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
  if (error) throw error
  if (bucket === 'profile-public-assets') return { path, publicUrl: client.storage.from(bucket).getPublicUrl(path).data.publicUrl }
  return { path }
}

export async function createPrivateAssetUrl(path: string, expiresInSeconds = 3600): Promise<string> {
  const { data, error } = await requireSupabase().storage.from('profile-private-assets').createSignedUrl(path, expiresInSeconds)
  if (error) throw error
  return data.signedUrl
}

function storedAvatarFrameSet(asset: Pick<AvatarAsset, 'center_frame_path' | 'frame_metadata'>): AvatarFrameSet {
  const publicUrl = (path: string) => requireSupabase().storage.from('profile-public-assets').getPublicUrl(path).data.publicUrl
  return {
    version: 2,
    center: { key: 'center', src: publicUrl(asset.center_frame_path) },
    directions: (asset.frame_metadata.directions ?? []).map(({ key, angle, path }) => ({ key, angle, src: publicUrl(path) })),
    metadata: { source: { type: 'manual' } },
  }
}

async function durableFrame(profile: OwnedProfile, source: string, key: string): Promise<{ path: string; url: string }> {
  const response = await fetch(source)
  if (!response.ok) throw new Error(`Could not persist generated avatar frame ${key}.`)
  const blob = await response.blob()
  const uploaded = await uploadProfileAsset(profile, 'profile-public-assets', 'avatar-frames', blob, `${key}.png`)
  return { path: uploaded.path, url: uploaded.publicUrl! }
}

export async function persistAvatarFrames(profile: OwnedProfile, frames: AvatarFrameSet): Promise<{ frames: AvatarFrameSet; paths: string[] }> {
  const center = await durableFrame(profile, frames.center.src, frames.center.key || 'center')
  const directions = await Promise.all(frames.directions.map(async (direction) => {
    const saved = await durableFrame(profile, direction.src, direction.key)
    return { ...direction, src: saved.url, storagePath: saved.path }
  }))
  return {
    frames: { ...frames, center: { ...frames.center, src: center.url }, directions },
    paths: [center.path, ...directions.map(({ storagePath }) => storagePath)],
  }
}

export async function loadPublicProfile(slug: string): Promise<ProfileDocument | null> {
  const client = requireSupabase()
  const { data, error } = await client.from('profiles').select('document').eq('slug', slug).eq('is_published', true).maybeSingle()
  if (error) throw error
  const document = data?.document as ProfileDocument | undefined
  if (!document?.profileId) return null
  const { data: activeData, error: activeError } = await client.rpc('get_public_active_avatar', { requested_slug: slug }).maybeSingle()
  if (activeError) throw activeError
  const active = activeData as { center_frame_path: string; frame_paths: string[]; frame_metadata: AvatarAsset['frame_metadata'] } | null
  if (!active) {
    const response = await fetch(`/api/profile-avatar?slug=${encodeURIComponent(slug)}`)
    const resolved = response.ok ? await response.json() as { originalPhotoUrl?: string | null } : {}
    return resolveProfileAvatar(document, { originalPhotoUrl: resolved.originalPhotoUrl })
  }
  const asset = {
    center_frame_path: active.center_frame_path,
    frame_paths: active.frame_paths,
    frame_metadata: active.frame_metadata,
  } as AvatarAsset
  return resolveProfileAvatar(document, { activeFrameSet: storedAvatarFrameSet(asset) })
}

export async function loadCurrentUserProfileDocument(): Promise<ProfileDocument | null> {
  const { data: { user } } = await requireSupabase().auth.getUser()
  if (!user) return null
  const profile = await getOwnedProfile(user)
  const document = profile.document as ProfileDocument
  if (document?.profileId !== profile.id) return null
  const state = await loadOnboardingState(profile)
  let activeFrameSet: AvatarFrameSet | null = null
  if (profile.active_avatar_id) {
    const { data, error } = await requireSupabase().from('avatars').select('*').eq('id', profile.active_avatar_id).eq('profile_id', profile.id).maybeSingle()
    if (error) throw error
    if (data) activeFrameSet = storedAvatarFrameSet(data as AvatarAsset)
  }
  const originalPhotoUrl = state?.original_photo_path ? await createPrivateAssetUrl(state.original_photo_path) : null
  return resolveProfileAvatar(document, { activeFrameSet, originalPhotoUrl })
}
