import { requireAuthenticatedUser } from '../auth/session.ts'
import { getOwnedProfile, loadOnboardingState, saveOnboardingState, saveProfileDocument, uploadProfileAsset } from '../profile/repository.ts'
import { extractResumeText } from './extraction.ts'
import { parsedResumeToDraft } from './mapping.ts'
import { createResumeMappingService } from './mappingCoordinator.ts'
import { draftToProfileDocument } from './profileDocument.ts'
import type { ProfileDocumentDraft, ProfileValidationResult } from './types.ts'
import { validateProfileDraft } from './validation.ts'
import { requestAiLifecycle } from '../profile/aiLifecycleClient.ts'
import { trackFunnelEvent } from '../analytics/client.ts'
import { NEUTRAL_PROFILE_DEFAULTS } from './defaults.ts'
import { mountStructuredProfileEditor } from './structuredEditor.ts'

const workspace = document.querySelector<HTMLElement>('.create-workspace')
if (!workspace) throw new Error('The profile workspace is not mounted.')
const required = <T extends Element>(selector: string): T => {
  const element = workspace.querySelector<T>(selector)
  if (!element) throw new Error(`Required profile workspace control is missing: ${selector}`)
  return element
}
const inputStep = required<HTMLElement>('#inputStep')
const buildingStep = required<HTMLElement>('#buildingStep')
const reviewStep = required<HTMLElement>('#reviewStep')
const inputError = required<HTMLElement>('#inputError')
const fileInput = required<HTMLInputElement>('#resumeFile')
const mappingService = createResumeMappingService()
const ownedProfile = await getOwnedProfile(await requireAuthenticatedUser())
let draft: ProfileDocumentDraft | null = null
let cvPath: string | null = null

function showStep(step: HTMLElement): void {
  ;[inputStep, buildingStep, reviewStep].forEach((item) => { item.hidden = item !== step })
  const workspace = reviewStep.closest('.create-workspace')
  if (workspace) workspace.classList.toggle('profile-editor', step === reviewStep)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function renderIssues(result: ProfileValidationResult): void {
  const host = required<HTMLElement>('#reviewIssues')
  host.replaceChildren()
  if (result.blockingErrors.length) {
    const section = document.createElement('section'); section.className = 'issue-group issue-blocking'
    const heading = document.createElement('strong'); heading.textContent = 'Needs attention'
    const list = document.createElement('ul')
    result.blockingErrors.forEach(({ message }) => { const item = document.createElement('li'); item.textContent = message; list.append(item) })
    section.append(heading, list); host.append(section)
  }
  if (result.missingInformation.length) {
    const section = document.createElement('section'); section.className = 'issue-group issue-compact'
    const count = result.missingInformation.length
    const heading = document.createElement('p'); heading.className = 'issue-summary'
    heading.textContent = `${count} optional detail${count === 1 ? '' : 's'} ${count === 1 ? 'is' : 'are'} missing. Adding them can make your profile more complete.`
    const details = document.createElement('details')
    const summary = document.createElement('summary'); summary.textContent = 'Review missing details'
    const list = document.createElement('ul')
    result.missingInformation.forEach(({ message }) => { const item = document.createElement('li'); item.textContent = message; list.append(item) })
    details.append(summary, list)
    section.append(heading, details); host.append(section)
  }
  if (result.warnings.length) {
    const section = document.createElement('section'); section.className = 'issue-group issue-note'
    const heading = document.createElement('p'); heading.className = 'issue-summary'
    heading.textContent = 'Some CV fields may need review.'
    const details = document.createElement('details')
    const summary = document.createElement('summary'); summary.textContent = 'Show parser notes'
    const list = document.createElement('ul')
    result.warnings.forEach(({ message }) => { const item = document.createElement('li'); item.textContent = message; list.append(item) })
    details.append(summary, list)
    section.append(heading, details); host.append(section)
  }
}

function blankDraft():ProfileDocumentDraft{return{identity:{},skills:[],services:[],experience:[],education:[],projects:[],presentation:{servicesIntro:NEUTRAL_PROFILE_DEFAULTS.servicesIntro,contactHeading:NEUTRAL_PROFILE_DEFAULTS.contactHeading},featured:{},missingFields:[],warnings:[],mapping:{mapper:'deterministic',inferredFields:[],lowConfidenceFields:[]}}}
function populateReview(value:ProfileDocumentDraft):void{
  draft=value
  renderIssues(validateProfileDraft(value))
  mountStructuredProfileEditor(required<HTMLElement>('#structuredProfileEditor'),value,async next=>{
    draft=next
    const validation=validateProfileDraft(next);renderIssues(validation)
    await saveOnboardingState(ownedProfile,{draft:next,cv_path:cvPath})
    if(validation.valid){
      await saveProfileDocument(ownedProfile,draftToProfileDocument(next,{profileId:ownedProfile.id,slug:ownedProfile.slug}))
      if(ownedProfile.ai_enabled)await requestAiLifecycle('refresh')
    }
  })
}

required<HTMLButtonElement>('#buildButton').addEventListener('click', async () => {
  inputError.hidden = true
  const file = fileInput.files?.[0]
  if (!file) { inputError.textContent = 'Choose a PDF or DOCX resume.'; inputError.hidden = false; return }
  showStep(buildingStep)
  try {
    const extracted = await extractResumeText(file)
    required<HTMLElement>('#buildingStatus').textContent = 'Mapping structured resume information…'
    draft = parsedResumeToDraft(await mappingService.mapResume(extracted))
    void trackFunnelEvent('cv_parsed')
    cvPath = (await uploadProfileAsset(ownedProfile, 'profile-private-assets', 'cv', file, file.name)).path
    void trackFunnelEvent('cv_uploaded')
    reviewStep.dataset.mapper = draft.mapping.mapper
    populateReview(draft)
    await saveOnboardingState(ownedProfile, { draft, cv_path: cvPath })
    showStep(reviewStep)
  } catch (error) {
    inputError.textContent = error instanceof Error ? error.message : 'The resume could not be processed.'
    inputError.hidden = false; showStep(inputStep)
  }
})

required<HTMLButtonElement>('#manualProfileButton').addEventListener('click',async()=>{
  draft=blankDraft();cvPath=null
  await saveOnboardingState(ownedProfile,{draft,cv_path:null})
  populateReview(draft);showStep(reviewStep)
})

required<HTMLButtonElement>('#startOverButton').addEventListener('click', () => { draft = null; fileInput.value = ''; showStep(inputStep) })

const persisted = await loadOnboardingState(ownedProfile)
if (persisted) {
  cvPath = persisted.cv_path; draft = persisted.draft
  if (draft) { populateReview(draft); showStep(reviewStep) }
}
