export type ProfileId = string

export interface ProfileIdentity {
  fullName: string
  preferredName: string
  headline: string
  location?: string
  summary: string
  introduction: string
  email: string
  githubUrl?: string
  linkedinUrl?: string
  websiteUrl?: string
}

export interface SkillGroup {
  id: string
  category: string
  items: string[]
}

export interface Service {
  id: string
  name: string
  description: string
}

export interface Highlight {
  id: string
  title: string
  description: string
}

export interface Experience {
  id: string
  role: string
  company: string
  location?: string
  startDate?: string
  endDate?: string
  summary?: string
  highlights?: string[]
  technologies?: string[]
}

export interface Education {
  id: string
  degree: string
  institution?: string
  startDate?: string
  endDate?: string
  description?: string
  honours?: string
}

export interface ProfileLink {
  label: string
  url: string
}

export interface Project {
  id: string
  title: string
  category: string
  shortDescription: string
  description?: string
  technologies?: string[]
  links?: ProfileLink[]
  tags?: string[]
  image?: string
  imageAlt?: string
}

export interface ProfileSeo {
  title: string
  description: string
}

export interface AvatarFrame {
  key: string
  frame: number
  src: string
  angle?: number
}

export interface AvatarPresentation {
  objectFit?: 'contain' | 'cover'
  objectPosition?: string
}

export interface DirectionalAvatar {
  mode: 'directional'
  alt: string
  centerFrame: AvatarFrame
  directionalFrames: Array<AvatarFrame & { angle: number }>
  centerDeadZone?: number
  presentation?: AvatarPresentation
}

export interface PlaceholderAvatar {
  mode: 'placeholder'
  alt: string
  initials: string
  presentation?: AvatarPresentation
}

export type ProfileAvatar = DirectionalAvatar | PlaceholderAvatar

export interface ProfilePresentation {
  theme?: 'default'
}

export interface ProfileAi {
  enabled: boolean
  unavailableMessage?: string
}

export interface ProfileDocument {
  profileId: ProfileId
  slug: string
  version: number
  identity: ProfileIdentity
  seo: ProfileSeo
  highlights: Highlight[]
  skills: SkillGroup[]
  services: Service[]
  experience: Experience[]
  education: Education[]
  projects: Project[]
  focusAreas: string[]
  suggestedQuestions: string[]
  avatar: ProfileAvatar
  presentation?: ProfilePresentation
  ai: ProfileAi
}
