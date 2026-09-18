import type { AvatarFrameSet } from 'lookatme-avatar'

export type ProfileAvatarMode = 'original' | 'dynamic'
export type ProfileAvatarPreset = 'fast' | 'balanced' | 'smooth'

export function normalizeAvatarMode(value: string | null | undefined): ProfileAvatarMode {
  return value === 'dynamic' ? 'dynamic' : 'original'
}

export function normalizeAvatarPreset(value: string | null | undefined): ProfileAvatarPreset | undefined {
  if (value === 'fast' || value === 'balanced' || value === 'smooth') return value
  return undefined
}

export function isAvatarFrameSet(value: unknown): value is AvatarFrameSet {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<AvatarFrameSet>
  if (candidate.version !== 2) return false
  if (!candidate.center || typeof candidate.center !== 'object' || !candidate.center.src) return false
  if (!Array.isArray(candidate.directions) || candidate.directions.length === 0) return false
  return candidate.directions.every((direction) => direction && typeof direction === 'object' && typeof direction.src === 'string' && typeof direction.angle === 'number')
}

export function validateAvatarGenerationRequest(request: { portrait?: unknown; preset?: unknown }): { mode: ProfileAvatarMode; preset?: ProfileAvatarPreset; portrait: unknown } {
  const portrait = request.portrait
  if (!portrait) throw new Error('A portrait image file is required.')
  const preset = normalizeAvatarPreset(typeof request.preset === 'string' ? request.preset : undefined)
  return { mode: 'dynamic', preset, portrait }
}
