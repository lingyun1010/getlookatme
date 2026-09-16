import { profile as lingyunProfile } from './lingyun.ts'
import type { Profile } from './types.ts'

const seedProfiles: Record<string, Profile> = {
  [lingyunProfile.slug]: lingyunProfile,
}

export function profileSlugFromPath(pathname: string): string {
  return pathname.split('/').filter(Boolean)[0] ?? lingyunProfile.slug
}

export function resolveProfile(pathname: string): Profile | null {
  return seedProfiles[profileSlugFromPath(pathname)] ?? null
}
