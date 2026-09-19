import type { AvatarFrameSet } from 'lookatme-avatar'

export type AvatarPreset = 'fast' | 'balanced' | 'smooth'
export type AvatarJobStatus = 'queued' | 'generating' | 'ready' | 'failed' | 'cancelled'

export interface AvatarAsset {
  id: string
  user_id: string
  profile_id: string
  generation_job_id: string
  source_photo_path: string
  style: string
  preset: AvatarPreset
  preview_path: string | null
  center_frame_path: string
  frame_paths: string[]
  frame_metadata: { directions?: Array<{ key: string; angle: number; path: string }>; legacyFrameSet?: AvatarFrameSet }
  created_at: string
}

export interface AvatarGenerationJob {
  id: string
  user_id: string
  profile_id: string
  source_photo_path: string
  style: string
  preset: AvatarPreset
  status: AvatarJobStatus
  avatar_id: string | null
  error: string | null
  attempts: number
  created_at: string
  started_at: string | null
  completed_at: string | null
}

export function isAvatarPreset(value: unknown): value is AvatarPreset {
  return value === 'fast' || value === 'balanced' || value === 'smooth'
}

export function isAvatarJobStatus(value: unknown): value is AvatarJobStatus {
  return value === 'queued' || value === 'generating' || value === 'ready' || value === 'failed' || value === 'cancelled'
}

export function isActiveAvatarJob(job: Pick<AvatarGenerationJob, 'status'>): boolean {
  return job.status === 'queued' || job.status === 'generating'
}

export function canRetryAvatarJob(job: Pick<AvatarGenerationJob, 'status'>): boolean {
  return job.status === 'failed'
}
