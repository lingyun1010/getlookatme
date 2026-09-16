import type { Education, Experience, Project } from '../profile/types.ts'
import { extractResumeText, extractedPastedText } from './extraction.ts'
import { parsedResumeToDraft } from './mapping.ts'
import { createResumeMappingService } from './mappingCoordinator.ts'
import { draftToProfileDocument } from './profileDocument.ts'
import { saveTemporaryProfile } from './session.ts'
import type { ProfileDocumentDraft, ProfileValidationResult } from './types.ts'
import { validateProfileDraft } from './validation.ts'

const inputStep = document.querySelector<HTMLElement>('#inputStep')!
const buildingStep = document.querySelector<HTMLElement>('#buildingStep')!
const reviewStep = document.querySelector<HTMLElement>('#reviewStep')!
const inputError = document.querySelector<HTMLElement>('#inputError')!
const fileInput = document.querySelector<HTMLInputElement>('#resumeFile')!
const textInput = document.querySelector<HTMLTextAreaElement>('#resumeText')!
const mappingService = createResumeMappingService()
let draft: ProfileDocumentDraft | null = null

const field = <T extends HTMLInputElement | HTMLTextAreaElement>(id: string): T => document.querySelector<T>(`#${id}`)!
const lines = (value: string): string[] => value.split('\n').map((line) => line.trim()).filter(Boolean)
const parts = (value: string): string[] => value.split('|').map((part) => part.trim())

function showStep(step: HTMLElement): void {
  ;[inputStep, buildingStep, reviewStep].forEach((item) => { item.hidden = item !== step })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function renderIssues(result: ProfileValidationResult): void {
  const host = document.querySelector<HTMLElement>('#reviewIssues')!
  host.replaceChildren()
  const groups = [
    ['Needs attention', result.blockingErrors],
    ['Optional information missing', result.missingInformation],
    ['Review suggested', result.warnings],
  ] as const
  groups.forEach(([title, issues]) => {
    if (!issues.length) return
    const section = document.createElement('section')
    section.className = 'issue-group'
    const heading = document.createElement('strong')
    heading.textContent = title
    const list = document.createElement('ul')
    issues.forEach(({ message }) => {
      const item = document.createElement('li')
      item.textContent = message
      list.append(item)
    })
    section.append(heading, list)
    host.append(section)
  })
}

function populateReview(value: ProfileDocumentDraft): void {
  field<HTMLInputElement>('fullName').value = value.identity.fullName ?? ''
  field<HTMLInputElement>('preferredName').value = value.identity.preferredName ?? ''
  field<HTMLInputElement>('location').value = value.identity.location ?? ''
  field<HTMLInputElement>('headline').value = value.identity.headline ?? ''
  field<HTMLInputElement>('email').value = value.identity.email ?? ''
  field<HTMLTextAreaElement>('summary').value = value.identity.summary ?? ''
  field<HTMLInputElement>('linkedinUrl').value = value.identity.linkedinUrl ?? ''
  field<HTMLInputElement>('githubUrl').value = value.identity.githubUrl ?? ''
  field<HTMLInputElement>('websiteUrl').value = value.identity.websiteUrl ?? ''
  field<HTMLTextAreaElement>('skills').value = value.skills.flatMap(({ items }) => items).join('\n')
  field<HTMLTextAreaElement>('experience').value = value.experience.map((item) => [item.role, item.company, item.startDate, item.endDate, item.summary].map((part) => part ?? '').join(' | ')).join('\n')
  field<HTMLTextAreaElement>('education').value = value.education.map((item) => [item.degree, item.institution, item.startDate, item.endDate].map((part) => part ?? '').join(' | ')).join('\n')
  field<HTMLTextAreaElement>('projects').value = value.projects.map((item) => [item.title, item.category, item.shortDescription, item.links?.[0]?.url].map((part) => part ?? '').join(' | ')).join('\n')
  field<HTMLTextAreaElement>('servicesIntro').value = value.presentation.servicesIntro
  field<HTMLInputElement>('contactHeading').value = value.presentation.contactHeading
  renderIssues(validateProfileDraft(value))
}

function readReview(): ProfileDocumentDraft {
  if (!draft) throw new Error('No profile draft is available.')
  const experience: Experience[] = lines(field<HTMLTextAreaElement>('experience').value).map((line, index) => {
    const [role, company, startDate, endDate, summary] = parts(line)
    return { id: `temporary-experience-${index + 1}`, role, company, startDate: startDate || undefined, endDate: endDate || undefined, summary: summary || undefined, featured: index === 0 }
  })
  const education: Education[] = lines(field<HTMLTextAreaElement>('education').value).map((line, index) => {
    const [degree, institution, startDate, endDate] = parts(line)
    return { id: `temporary-education-${index + 1}`, degree, institution: institution || undefined, startDate: startDate || undefined, endDate: endDate || undefined, featured: index === 0 }
  })
  const projects: Project[] = lines(field<HTMLTextAreaElement>('projects').value).map((line, index) => {
    const [title, category, shortDescription, url] = parts(line)
    return { id: `temporary-project-${index + 1}`, title, category: category || 'Project', shortDescription: shortDescription || '', links: url ? [{ label: 'Project', url }] : undefined }
  })
  const skillItems = lines(field<HTMLTextAreaElement>('skills').value)
  return {
    ...draft,
    identity: {
      fullName: field<HTMLInputElement>('fullName').value.trim(), preferredName: field<HTMLInputElement>('preferredName').value.trim(),
      location: field<HTMLInputElement>('location').value.trim(), headline: field<HTMLInputElement>('headline').value.trim(),
      email: field<HTMLInputElement>('email').value.trim(), summary: field<HTMLTextAreaElement>('summary').value.trim(),
      linkedinUrl: field<HTMLInputElement>('linkedinUrl').value.trim(), githubUrl: field<HTMLInputElement>('githubUrl').value.trim(), websiteUrl: field<HTMLInputElement>('websiteUrl').value.trim(),
    },
    skills: skillItems.length ? [{ id: 'resume-skills', category: 'Skills', items: skillItems }] : [],
    experience, education, projects,
    featured: { experienceId: experience[0]?.id, educationId: education[0]?.id, projectId: projects[0]?.id },
    presentation: { servicesIntro: field<HTMLTextAreaElement>('servicesIntro').value.trim(), contactHeading: field<HTMLInputElement>('contactHeading').value.trim() },
  }
}

document.querySelector('#buildButton')!.addEventListener('click', async () => {
  inputError.hidden = true
  showStep(buildingStep)
  try {
    const extracted = fileInput.files?.[0]
      ? await extractResumeText(fileInput.files[0])
      : extractedPastedText(textInput.value)
    document.querySelector<HTMLElement>('#buildingStatus')!.textContent = 'Mapping structured resume information…'
    const parsed = await mappingService.mapResume(extracted)
    draft = parsedResumeToDraft(parsed)
    reviewStep.dataset.mapper = draft.mapping.mapper
    if ((import.meta as ImportMeta & { env?: Record<string, unknown> }).env?.DEV) {
      console.info('[onboarding] Review UI populated', { mapper: draft.mapping.mapper })
    }
    populateReview(draft)
    showStep(reviewStep)
  } catch (error) {
    inputError.textContent = error instanceof Error ? error.message : 'The resume could not be processed.'
    inputError.hidden = false
    showStep(inputStep)
  }
})

document.querySelector('#startOverButton')!.addEventListener('click', () => {
  draft = null
  fileInput.value = ''
  textInput.value = ''
  showStep(inputStep)
})

document.querySelector<HTMLFormElement>('#reviewForm')!.addEventListener('submit', (event) => {
  event.preventDefault()
  try {
    draft = readReview()
    const result = validateProfileDraft(draft)
    renderIssues(result)
    if (!result.valid) return
    saveTemporaryProfile(draftToProfileDocument(draft))
    window.location.assign('/preview')
  } catch (error) {
    inputError.textContent = error instanceof Error ? error.message : 'The profile could not be previewed.'
    inputError.hidden = false
  }
})
