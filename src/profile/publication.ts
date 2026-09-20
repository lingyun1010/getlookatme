import type { ProfileDocument } from './types.ts'
import { validateProfileSlug } from './slugs.ts'

export interface PublicationProfile {
  id: string
  userId: string
  slug: string
  document: ProfileDocument | Record<string, never>
  isPublished: boolean
}

export interface PublicationRepository {
  findOwnedProfile(userId: string): Promise<PublicationProfile | null>
  findProfileIdBySlug(slug: string): Promise<string | null>
  updateProfile(profileId: string, userId: string, values: { slug?: string; document?: ProfileDocument; isPublished?: boolean }): Promise<PublicationProfile>
}

export class PublicationError extends Error {
  readonly code: 'not_found' | 'invalid' | 'unavailable'
  constructor(message: string, code: 'not_found' | 'invalid' | 'unavailable') { super(message); this.code = code }
}

function publishableDocument(profile: PublicationProfile): ProfileDocument {
  const document = profile.document as ProfileDocument
  if (document?.profileId !== profile.id) throw new PublicationError('Complete and save your profile before publishing.', 'invalid')
  const required = [document.identity?.fullName, document.identity?.preferredName, document.identity?.headline, document.identity?.summary, document.identity?.email]
  if (!document.version || required.some((value) => !value?.trim())) {
    throw new PublicationError('Complete the required profile details before publishing.', 'invalid')
  }
  return document
}

async function ownedProfile(userId: string, repository: PublicationRepository): Promise<PublicationProfile> {
  const profile = await repository.findOwnedProfile(userId)
  if (!profile) throw new PublicationError('Profile not found.', 'not_found')
  return profile
}

async function availableSlug(slugInput: string, profile: PublicationProfile, repository: PublicationRepository): Promise<string> {
  const validation = validateProfileSlug(slugInput)
  if (!validation.valid) throw new PublicationError(validation.error, 'invalid')
  const existingId = await repository.findProfileIdBySlug(validation.slug)
  if (existingId && existingId !== profile.id) throw new PublicationError('This URL is already taken.', 'unavailable')
  return validation.slug
}

export async function checkSlugAvailability(userId: string, slugInput: string, repository: PublicationRepository) {
  const profile = await ownedProfile(userId, repository)
  const slug = await availableSlug(slugInput, profile, repository)
  return { slug, available: true as const }
}

export async function updateProfileSlug(userId: string, slugInput: string, repository: PublicationRepository) {
  const profile = await ownedProfile(userId, repository)
  const document = publishableDocument(profile)
  const slug = await availableSlug(slugInput, profile, repository)
  return repository.updateProfile(profile.id, userId, { slug, document: { ...document, slug } })
}

export async function publishProfile(userId: string, slugInput: string, repository: PublicationRepository) {
  const profile = await ownedProfile(userId, repository)
  const document = publishableDocument(profile)
  const slug = await availableSlug(slugInput, profile, repository)
  return repository.updateProfile(profile.id, userId, { slug, document: { ...document, slug }, isPublished: true })
}

export async function unpublishProfile(userId: string, repository: PublicationRepository) {
  const profile = await ownedProfile(userId, repository)
  return repository.updateProfile(profile.id, userId, { isPublished: false })
}
