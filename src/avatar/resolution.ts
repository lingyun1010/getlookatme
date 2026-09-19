import type { AvatarFrameSet } from 'lookatme-avatar'
import type { ProfileDocument } from '../profile/types.ts'

export interface ResolvedAvatarSources {
  activeFrameSet?: AvatarFrameSet | null
  originalPhotoUrl?: string | null
}

export function resolveProfileAvatar(document: ProfileDocument, sources: ResolvedAvatarSources): ProfileDocument {
  if (sources.activeFrameSet) {
    return { ...document, avatarMode: 'dynamic', avatarFrameSet: sources.activeFrameSet, avatarImageUrl: undefined }
  }
  if (sources.originalPhotoUrl) {
    return { ...document, avatarMode: 'original', avatarFrameSet: null, avatarImageUrl: sources.originalPhotoUrl }
  }
  // Legacy embedded generated data remains renderable when no new asset relationship exists.
  if (document.avatarMode === 'dynamic' && document.avatarFrameSet) return document
  return { ...document, avatarMode: 'original', avatarFrameSet: null, avatarImageUrl: undefined }
}
