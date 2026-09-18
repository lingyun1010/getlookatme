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
  const avatarMode = draft.avatarMode ?? 'original'
  const avatarPreset = avatarMode === 'dynamic' ? (draft.avatarPreset ?? 'smooth') : undefined
  const avatarFrameSet = avatarMode === 'dynamic' ? draft.avatarFrameSet ?? null : null
  const avatar: ProfileDocument['avatar'] = avatarMode === 'dynamic' && avatarFrameSet
    ? {
        mode: 'directional',
        alt: `Dynamic avatar for ${fullName}`,
        centerFrame: { key: avatarFrameSet.center.key || 'center', frame: avatarFrameSet.center.frame ?? 0, src: avatarFrameSet.center.src },
        directionalFrames: avatarFrameSet.directions.map((direction) => ({
          key: direction.key,
          src: direction.src,
          frame: direction.frame ?? 0,
          angle: Number.isFinite(direction.angle) ? direction.angle : 0,
        })),
        presentation: { objectFit: 'contain', objectPosition: 'center bottom' },
      }
    : { mode: 'placeholder', alt: `Initials avatar for ${fullName}`, initials: initials(fullName) }
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
    avatar,
    avatarMode,
    avatarPreset,
    avatarImageUrl: draft.avatarImageUrl || undefined,
    avatarFrameSet,
    presentation: draft.presentation,
    ai: { enabled: false, unavailableMessage: NEUTRAL_PROFILE_DEFAULTS.aiUnavailableMessage },
  }
}
