import type { AvatarFrameSet } from 'lookatme-avatar'
import type { Education, Experience, ProfileAvatarMode, ProfileAvatarPreset, ProfileDocument, Project, Service, SkillGroup } from '../profile/types.ts'

export type ResumeSourceType = 'pdf' | 'docx' | 'text'

export interface ExtractedResumeText {
  text: string
  sourceType: ResumeSourceType
  metadata: { fileName?: string; fileSize?: number; pageCount?: number }
  warnings: string[]
}

export interface ParsedResume {
  identity: {
    fullName?: string
    preferredName?: string
    email?: string
    location?: string
    headline?: string
  }
  summary?: string
  skills: string[]
  experience: Array<Omit<Experience, 'id' | 'featured'>>
  education: Array<Omit<Education, 'id' | 'featured'>>
  projects: Array<Omit<Project, 'id'>>
  links: { linkedinUrl?: string; githubUrl?: string; websiteUrl?: string }
  warnings: string[]
  mapping: {
    mapper: 'llm' | 'deterministic'
    inferredFields: string[]
    lowConfidenceFields: string[]
  }
}

export interface ProfileDocumentDraft {
  identity: {
    fullName?: string
    preferredName?: string
    headline?: string
    location?: string
    summary?: string
    email?: string
    githubUrl?: string
    linkedinUrl?: string
    websiteUrl?: string
  }
  skills: SkillGroup[]
  services: Service[]
  experience: Experience[]
  education: Education[]
  projects: Project[]
  presentation: { servicesIntro: string; contactHeading: string }
  featured: { experienceId?: string; educationId?: string; projectId?: string }
  missingFields: string[]
  warnings: string[]
  mapping: ParsedResume['mapping']
  avatarMode?: ProfileAvatarMode
  avatarPreset?: ProfileAvatarPreset
  avatarImageUrl?: string
  avatarFrameSet?: AvatarFrameSet | null
}

export type ValidationSeverity = 'blocking' | 'missing' | 'warning'

export interface ValidationIssue {
  severity: ValidationSeverity
  field: string
  message: string
}

export interface ProfileValidationResult {
  valid: boolean
  blockingErrors: ValidationIssue[]
  missingInformation: ValidationIssue[]
  warnings: ValidationIssue[]
}

export interface ResumeMappingService {
  mapResume(extracted: ExtractedResumeText): Promise<ParsedResume>
}

export type MappingDiagnostic = (event: string, details?: Record<string, unknown>) => void

export type TemporaryProfileDocument = ProfileDocument
