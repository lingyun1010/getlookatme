import type { AvatarFrameSet } from 'lookatme-avatar'
import { requireSupabase } from '../auth/supabase.ts'
import type { OwnedProfile } from '../profile/repository.ts'
import { createPrivateAssetUrl, uploadProfileAsset } from '../profile/repository.ts'
import type { AvatarAsset, AvatarGenerationJob, AvatarPreset } from './types.ts'

export async function listAvatarAssets(profile: OwnedProfile): Promise<AvatarAsset[]> {
  const { data, error } = await requireSupabase().from('avatars').select('*').eq('profile_id', profile.id).order('created_at', { ascending: false })
  if (error) throw error
  return data as AvatarAsset[]
}

export async function listAvatarJobs(profile: OwnedProfile): Promise<AvatarGenerationJob[]> {
  const { data, error } = await requireSupabase().from('avatar_generation_jobs').select('*').eq('profile_id', profile.id).order('created_at', { ascending: false }).limit(12)
  if (error) throw error
  return data as AvatarGenerationJob[]
}

export async function uploadOriginalPhoto(profile: OwnedProfile, file: File): Promise<string> {
  return (await uploadProfileAsset(profile, 'profile-private-assets', 'original-photo', file, file.name)).path
}

export async function originalPhotoUrl(path: string | null): Promise<string | null> {
  return path ? createPrivateAssetUrl(path) : null
}

export async function createAvatarJob(profile: OwnedProfile, sourcePhotoPath: string, style: string, preset: AvatarPreset): Promise<AvatarGenerationJob> {
  const { data: { session } } = await requireSupabase().auth.getSession()
  const response = await fetch('/api/avatar-jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
    body: JSON.stringify({ profileId: profile.id, sourcePhotoPath, style, preset }),
  })
  const result = await response.json() as { job?: AvatarGenerationJob; error?: string }
  if (!response.ok || !result.job) throw new Error(result.error ?? 'Could not queue avatar generation.')
  return result.job
}

export async function retryAvatarJob(jobId: string): Promise<void> {
  const { data, error } = await requireSupabase().rpc('retry_avatar_generation_job', { job_id: jobId })
  if (error) throw error
  if (!data) throw new Error('Only a failed job can be retried.')
}

export async function cancelAvatarJob(jobId: string): Promise<boolean> {
  const { data, error } = await requireSupabase().rpc('cancel_avatar_generation_job', { job_id: jobId })
  if (error) throw error
  return Boolean(data)
}

export async function activateAvatar(profile: OwnedProfile, avatarId: string | null): Promise<void> {
  const { error } = await requireSupabase().from('profiles').update({ active_avatar_id: avatarId }).eq('id', profile.id).eq('user_id', profile.user_id)
  if (error) throw error
}

export async function deleteAvatar(profile: OwnedProfile, avatar: AvatarAsset): Promise<void> {
  if (profile.active_avatar_id === avatar.id) throw new Error('Choose another avatar before deleting the active avatar.')
  const paths = [avatar.preview_path, avatar.center_frame_path, ...avatar.frame_paths].filter((path): path is string => Boolean(path))
  const { error } = await requireSupabase().from('avatars').delete().eq('id', avatar.id).eq('profile_id', profile.id)
  if (error) throw error
  if (paths.length) await requireSupabase().storage.from('profile-public-assets').remove(paths)
}

export function avatarAssetFrameSet(asset: AvatarAsset): AvatarFrameSet {
  const publicUrl = (path: string) => requireSupabase().storage.from('profile-public-assets').getPublicUrl(path).data.publicUrl
  const directions = asset.frame_metadata.directions ?? []
  return {
    version: 2,
    center: { key: 'center', src: publicUrl(asset.center_frame_path) },
    directions: directions.map(({ key, angle, path }) => ({ key, angle, src: publicUrl(path) })),
    metadata: { source: { type: 'manual' } },
  }
}

export function avatarPreviewUrl(asset: AvatarAsset): string {
  return requireSupabase().storage.from('profile-public-assets').getPublicUrl(asset.preview_path ?? asset.center_frame_path).data.publicUrl
}
