import type { ProfileDocument } from '../profile/types.ts'

export const TEMPORARY_PROFILE_KEY = 'lookatme.temporaryProfile.v1'

export function saveTemporaryProfile(profile: ProfileDocument, storage: Pick<Storage, 'setItem'> = sessionStorage): void {
  storage.setItem(TEMPORARY_PROFILE_KEY, JSON.stringify(profile))
}

export function loadTemporaryProfile(storage: Pick<Storage, 'getItem'> = sessionStorage): ProfileDocument | null {
  try {
    const value = storage.getItem(TEMPORARY_PROFILE_KEY)
    if (!value) return null
    const profile = JSON.parse(value) as ProfileDocument
    if (profile.profileId !== 'temporary_session_profile' || profile.slug !== 'preview' || profile.ai?.enabled !== false) return null
    if (!profile.identity?.fullName || !profile.identity?.preferredName || !Array.isArray(profile.experience)) return null
    return profile
  } catch {
    return null
  }
}
