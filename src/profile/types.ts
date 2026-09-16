export interface ProfileContact {
  email?: string
  linkedin?: string
  github?: string
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

export interface Profile {
  slug: string
  name: string
  preferredName: string
  headline: string
  location?: string
  summary: string
  introduction: string
  contact?: ProfileContact
  focusAreas: string[]
  highlights: Highlight[]
  skills: SkillGroup[]
  services: Service[]
  experience: Experience[]
  education: Education[]
  projects: Project[]
  suggestedQuestions: string[]
  seo: ProfileSeo
}
