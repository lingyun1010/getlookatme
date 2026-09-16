import type { Education, Experience, ProfileDocument } from './types.ts'

export function featuredExperience(profile: ProfileDocument): Experience {
  const record = profile.experience.find(({ featured }) => featured)
  if (!record) throw new Error(`Profile ${profile.profileId} requires a featured experience`)
  return record
}

export function featuredEducation(profile: ProfileDocument): Education {
  const record = profile.education.find(({ featured }) => featured)
  if (!record) throw new Error(`Profile ${profile.profileId} requires a featured education record`)
  return record
}
