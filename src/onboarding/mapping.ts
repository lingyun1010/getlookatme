import { NEUTRAL_PROFILE_DEFAULTS } from './defaults.ts'
import type { ParsedResume, ProfileDocumentDraft } from './types.ts'

function slug(value: string, fallback: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 56) || fallback
}

export function parsedResumeToDraft(parsed: ParsedResume): ProfileDocumentDraft {
  const experience = parsed.experience.map((item, index) => ({ ...item, id: slug(`${item.role}-${item.company}`, `experience-${index + 1}`), featured: index === 0 }))
  const education = parsed.education.map((item, index) => ({ ...item, id: slug(`${item.degree}-${item.institution ?? ''}`, `education-${index + 1}`), featured: index === 0 }))
  const projects = parsed.projects.map((item, index) => ({ ...item, id: slug(item.title, `project-${index + 1}`) }))
  const missingFields = [
    ['identity.fullName', parsed.identity.fullName],
    ['identity.preferredName', parsed.identity.preferredName],
    ['identity.location', parsed.identity.location],
    ['identity.headline', parsed.identity.headline],
    ['identity.summary', parsed.summary],
    ['identity.linkedinUrl', parsed.links.linkedinUrl],
    ['identity.githubUrl', parsed.links.githubUrl],
    ['services', undefined],
    ['profileImage', undefined],
  ].filter(([, value]) => !value).map(([field]) => field as string)
  return {
    identity: { ...parsed.identity, summary: parsed.summary, ...parsed.links },
    skills: parsed.skills.length ? [{ id: 'resume-skills', category: 'Skills', items: parsed.skills }] : [],
    services: [],
    experience,
    education,
    projects,
    featured: { experienceId: experience[0]?.id, educationId: education[0]?.id, projectId: projects[0]?.id },
    presentation: {
      servicesIntro: NEUTRAL_PROFILE_DEFAULTS.servicesIntro,
      contactHeading: NEUTRAL_PROFILE_DEFAULTS.contactHeading,
    },
    missingFields,
    warnings: [
      ...parsed.warnings,
      ...parsed.mapping.inferredFields.map((field) => `${field} was inferred and should be reviewed.`),
      ...parsed.mapping.lowConfidenceFields.map((field) => `${field} was mapped with low confidence and should be reviewed.`),
    ],
    mapping: parsed.mapping,
  }
}
