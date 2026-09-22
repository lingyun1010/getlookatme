import type { ProfileDocumentDraft, ProfileValidationResult, ValidationIssue } from './types.ts'
import { safeHttpUrl } from './urls.ts'

export function validateProfileDraft(draft: ProfileDocumentDraft): ProfileValidationResult {
  const blockingErrors: ValidationIssue[] = []
  const missingInformation: ValidationIssue[] = []
  const warnings: ValidationIssue[] = draft.warnings.map((message) => ({ severity: 'warning', field: 'mapping', message }))
  const required: Array<[keyof ProfileDocumentDraft['identity'], string]> = [
    ['fullName', 'Full name'], ['preferredName', 'Preferred name'], ['headline', 'Headline'], ['summary', 'Summary'], ['email', 'Email'],
  ]
  required.forEach(([field, label]) => {
    if (!draft.identity[field]?.trim()) blockingErrors.push({ severity: 'blocking', field: `identity.${field}`, message: `${label} is required to render the profile.` })
  })
  if ((draft.identity.summary?.length ?? 0) > 280) blockingErrors.push({ severity: 'blocking', field: 'identity.summary', message: 'Hero summary must be 280 characters or fewer.' })
  ;(['githubUrl', 'linkedinUrl', 'websiteUrl'] as const).forEach((field) => {
    const value = draft.identity[field]
    if (value && !safeHttpUrl(value)) blockingErrors.push({ severity: 'blocking', field: `identity.${field}`, message: `${field} must be an HTTP(S) URL.` })
  })
  draft.projects.forEach((project, projectIndex) => {
    project.links?.forEach((link, linkIndex) => {
      if (!safeHttpUrl(link.url)) blockingErrors.push({
        severity: 'blocking',
        field: `projects.${projectIndex}.links.${linkIndex}.url`,
        message: `Project link for ${project.title || `project ${projectIndex + 1}`} must be an HTTP(S) URL.`,
      })
    })
  })
  const optional: Array<[string, boolean, string]> = [
    ['identity.location', Boolean(draft.identity.location), 'Location was not provided.'],
    ['identity.linkedinUrl', Boolean(draft.identity.linkedinUrl), 'LinkedIn URL was not provided.'],
    ['identity.githubUrl', Boolean(draft.identity.githubUrl), 'GitHub URL was not provided.'],
    ['services', draft.services.length > 0, 'Services were not provided.'],
    ['projects', draft.projects.length > 0, 'No projects were detected.'],
    ['profileImage', false, 'No profile image was provided; initials will be used.'],
  ]
  optional.forEach(([field, present, message]) => { if (!present) missingInformation.push({ severity: 'missing', field, message }) })
  return { valid: blockingErrors.length === 0, blockingErrors, missingInformation, warnings }
}
