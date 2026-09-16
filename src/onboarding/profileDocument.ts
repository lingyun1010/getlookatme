import type { ProfileDocument } from '../profile/types.ts'
import { NEUTRAL_PROFILE_DEFAULTS } from './defaults.ts'
import type { ProfileDocumentDraft } from './types.ts'
import { safeHttpUrl } from './urls.ts'
import { validateProfileDraft } from './validation.ts'

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?'
}

export function draftToProfileDocument(draft: ProfileDocumentDraft): ProfileDocument {
  const validation = validateProfileDraft(draft)
  if (!validation.valid) throw new Error(validation.blockingErrors.map(({ message }) => message).join(' '))
  const fullName = draft.identity.fullName!.trim()
  const preferredName = draft.identity.preferredName!.trim()
  const summary = draft.identity.summary!.trim()
  return {
    profileId: 'temporary_session_profile', slug: 'preview', version: 1,
    identity: {
      fullName, preferredName,
      headline: draft.identity.headline!.trim(),
      location: draft.identity.location?.trim() || undefined,
      summary,
      introduction: summary,
      email: draft.identity.email!.trim(),
      githubUrl: safeHttpUrl(draft.identity.githubUrl),
      linkedinUrl: safeHttpUrl(draft.identity.linkedinUrl),
      websiteUrl: safeHttpUrl(draft.identity.websiteUrl),
    },
    seo: { title: `${fullName} — LookAtMe Preview`, description: summary.slice(0, 160) },
    highlights: [], skills: draft.skills, services: draft.services,
    experience: draft.experience.map((item) => ({ ...item, featured: item.id === draft.featured.experienceId })),
    education: draft.education.map((item) => ({ ...item, featured: item.id === draft.featured.educationId })),
    projects: draft.projects,
    focusAreas: draft.skills.flatMap(({ items }) => items).slice(0, 8),
    suggestedQuestions: [],
    avatar: { mode: 'placeholder', alt: `Initials avatar for ${fullName}`, initials: initials(fullName) },
    presentation: draft.presentation,
    ai: { enabled: false, unavailableMessage: NEUTRAL_PROFILE_DEFAULTS.aiUnavailableMessage },
  }
}
