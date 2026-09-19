import type { AvatarAsset, AvatarGenerationJob } from './types.ts'
import { isActiveAvatarJob } from './types.ts'

export function avatarAssetsKey(assets: AvatarAsset[]): string {
  return assets.map(({ id, created_at }) => `${id}:${created_at}`).join('|')
}

export function avatarJobsKey(jobs: AvatarGenerationJob[]): string {
  return jobs.map(({ id, status, avatar_id, error }) => `${id}:${status}:${avatar_id ?? ''}:${error ?? ''}`).join('|')
}

export function hasActiveGeneration(jobs: AvatarGenerationJob[]): boolean {
  return jobs.some(isActiveAvatarJob)
}

export function transitionedToReady(previous: AvatarGenerationJob[], next: AvatarGenerationJob[]): boolean {
  const old = new Map(previous.map((job) => [job.id, job.status]))
  return next.some((job) => job.status === 'ready' && old.get(job.id) !== 'ready')
}
