import type { ParsedResume } from './types.ts'
import { safeHttpUrl } from './urls.ts'

export const RESUME_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    identity: {
      type: 'object', additionalProperties: false,
      properties: {
        fullName: { type: ['string', 'null'] }, preferredName: { type: ['string', 'null'] },
        email: { type: ['string', 'null'] }, location: { type: ['string', 'null'] }, headline: { type: ['string', 'null'] },
      },
      required: ['fullName', 'preferredName', 'email', 'location', 'headline'],
    },
    summary: { type: ['string', 'null'] },
    skills: { type: 'array', items: { type: 'string' } },
    experience: {
      type: 'array', items: {
        type: 'object', additionalProperties: false,
        properties: {
          role: { type: 'string' }, company: { type: 'string' }, location: { type: ['string', 'null'] },
          startDate: { type: ['string', 'null'] }, endDate: { type: ['string', 'null'] }, summary: { type: ['string', 'null'] },
          highlights: { type: 'array', items: { type: 'string' } }, technologies: { type: 'array', items: { type: 'string' } },
        },
        required: ['role', 'company', 'location', 'startDate', 'endDate', 'summary', 'highlights', 'technologies'],
      },
    },
    education: {
      type: 'array', items: {
        type: 'object', additionalProperties: false,
        properties: {
          degree: { type: 'string' }, institution: { type: ['string', 'null'] }, startDate: { type: ['string', 'null'] },
          endDate: { type: ['string', 'null'] }, description: { type: ['string', 'null'] }, honours: { type: ['string', 'null'] },
        },
        required: ['degree', 'institution', 'startDate', 'endDate', 'description', 'honours'],
      },
    },
    projects: {
      type: 'array', items: {
        type: 'object', additionalProperties: false,
        properties: {
          title: { type: 'string' }, category: { type: 'string' }, shortDescription: { type: 'string' }, description: { type: ['string', 'null'] },
          technologies: { type: 'array', items: { type: 'string' } }, tags: { type: 'array', items: { type: 'string' } },
          links: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { label: { type: 'string' }, url: { type: 'string' } }, required: ['label', 'url'] } },
        },
        required: ['title', 'category', 'shortDescription', 'description', 'technologies', 'tags', 'links'],
      },
    },
    links: {
      type: 'object', additionalProperties: false,
      properties: { linkedinUrl: { type: ['string', 'null'] }, githubUrl: { type: ['string', 'null'] }, websiteUrl: { type: ['string', 'null'] } },
      required: ['linkedinUrl', 'githubUrl', 'websiteUrl'],
    },
    warnings: { type: 'array', items: { type: 'string' } },
    inferredFields: { type: 'array', items: { type: 'string' } },
    lowConfidenceFields: { type: 'array', items: { type: 'string' } },
  },
  required: ['identity', 'summary', 'skills', 'experience', 'education', 'projects', 'links', 'warnings', 'inferredFields', 'lowConfidenceFields'],
} as const

type RecordValue = Record<string, unknown>
const isRecord = (value: unknown): value is RecordValue => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const optionalString = (value: unknown, field: string): string | undefined => {
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value !== 'string') throw new Error(`${field} must be a string or null`)
  return value.trim() || undefined
}
const stringArray = (value: unknown, field: string): string[] => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) throw new Error(`${field} must be a string array`)
  return value.map((item) => item.trim()).filter(Boolean)
}
const records = (value: unknown, field: string): RecordValue[] => {
  if (!Array.isArray(value) || value.some((item) => !isRecord(item))) throw new Error(`${field} must be an object array`)
  return value as RecordValue[]
}

function validOptionalUrl(value: unknown, field: string): string | undefined {
  const candidate = optionalString(value, field)
  if (!candidate) return undefined
  const safe = safeHttpUrl(candidate)
  if (!safe) throw new Error(`${field} must be an HTTP(S) URL`)
  return safe
}

export function parseLlmResumeOutput(value: unknown): ParsedResume {
  if (!isRecord(value) || !isRecord(value.identity) || !isRecord(value.links)) throw new Error('Model output does not match the resume schema')
  const experience = records(value.experience, 'experience').map((item, index) => ({
    role: optionalString(item.role, `experience.${index}.role`) ?? '', company: optionalString(item.company, `experience.${index}.company`) ?? '',
    location: optionalString(item.location, `experience.${index}.location`), startDate: optionalString(item.startDate, `experience.${index}.startDate`),
    endDate: optionalString(item.endDate, `experience.${index}.endDate`), summary: optionalString(item.summary, `experience.${index}.summary`),
    highlights: stringArray(item.highlights, `experience.${index}.highlights`), technologies: stringArray(item.technologies, `experience.${index}.technologies`),
  }))
  if (experience.some(({ role, company }) => !role || !company)) throw new Error('Each experience requires a role and company')
  const education = records(value.education, 'education').map((item, index) => ({
    degree: optionalString(item.degree, `education.${index}.degree`) ?? '', institution: optionalString(item.institution, `education.${index}.institution`),
    startDate: optionalString(item.startDate, `education.${index}.startDate`), endDate: optionalString(item.endDate, `education.${index}.endDate`),
    description: optionalString(item.description, `education.${index}.description`), honours: optionalString(item.honours, `education.${index}.honours`),
  }))
  if (education.some(({ degree }) => !degree)) throw new Error('Each education record requires a degree')
  const projects = records(value.projects, 'projects').map((item, index) => ({
    title: optionalString(item.title, `projects.${index}.title`) ?? '', category: optionalString(item.category, `projects.${index}.category`) ?? 'Project',
    shortDescription: optionalString(item.shortDescription, `projects.${index}.shortDescription`) ?? '', description: optionalString(item.description, `projects.${index}.description`),
    technologies: stringArray(item.technologies, `projects.${index}.technologies`), tags: stringArray(item.tags, `projects.${index}.tags`),
    links: records(item.links, `projects.${index}.links`).map((link, linkIndex) => ({
      label: optionalString(link.label, `projects.${index}.links.${linkIndex}.label`) ?? 'Project',
      url: validOptionalUrl(link.url, `projects.${index}.links.${linkIndex}.url`)!,
    })),
  }))
  if (projects.some(({ title }) => !title)) throw new Error('Each project requires a title')
  return {
    identity: {
      fullName: optionalString(value.identity.fullName, 'identity.fullName'), preferredName: optionalString(value.identity.preferredName, 'identity.preferredName'),
      email: optionalString(value.identity.email, 'identity.email'), location: optionalString(value.identity.location, 'identity.location'), headline: optionalString(value.identity.headline, 'identity.headline'),
    },
    summary: optionalString(value.summary, 'summary'), skills: stringArray(value.skills, 'skills'), experience, education, projects,
    links: {
      linkedinUrl: validOptionalUrl(value.links.linkedinUrl, 'links.linkedinUrl'), githubUrl: validOptionalUrl(value.links.githubUrl, 'links.githubUrl'),
      websiteUrl: validOptionalUrl(value.links.websiteUrl, 'links.websiteUrl'),
    },
    warnings: stringArray(value.warnings, 'warnings'),
    mapping: { mapper: 'llm', inferredFields: stringArray(value.inferredFields, 'inferredFields'), lowConfidenceFields: stringArray(value.lowConfidenceFields, 'lowConfidenceFields') },
  }
}

export function validateParsedResumeResponse(value: unknown): ParsedResume {
  if (!isRecord(value) || !isRecord(value.mapping) || value.mapping.mapper !== 'llm') throw new Error('Mapper response metadata is invalid')
  return parseLlmResumeOutput({
    ...value,
    inferredFields: value.mapping.inferredFields,
    lowConfidenceFields: value.mapping.lowConfidenceFields,
  })
}
