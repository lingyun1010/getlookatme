import { aaronProfile } from './profiles/aaron.ts'
import { lingyunProfile } from './profiles/lingyun.ts'
import type { ProfileDocument } from './types.ts'

const profileDefinitions: ProfileDocument[] = [lingyunProfile, aaronProfile]

export function assertValidProfileRegistry(profiles: readonly ProfileDocument[]): void {
  const slugs = new Set<string>()
  const profileIds = new Set<string>()

  for (const profile of profiles) {
    if (slugs.has(profile.slug)) throw new Error(`Duplicate profile slug: ${profile.slug}`)
    if (profileIds.has(profile.profileId)) throw new Error(`Duplicate profileId: ${profile.profileId}`)
    slugs.add(profile.slug)
    profileIds.add(profile.profileId)
  }
}

assertValidProfileRegistry(profileDefinitions)

export const registeredProfiles = [...profileDefinitions]
export const profileRegistry = new Map(
  registeredProfiles.map((profile) => [profile.slug, profile]),
)
