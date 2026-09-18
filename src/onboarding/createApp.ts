  import type { AvatarFrameSet } from 'lookatme-avatar'
  import { createLookAtMeAvatar } from 'lookatme-avatar/vanilla'
  import { isAvatarFrameSet, normalizeAvatarMode } from '../avatar/generation.ts'
  import { requireAuthenticatedUser } from '../auth/session.ts'
  import { requireSupabase } from '../auth/supabase.ts'
  import { createPrivateAssetUrl, getOwnedProfile, loadOnboardingState, persistAvatarFrames, saveOnboardingState, saveProfileDocument, uploadProfileAsset } from '../profile/repository.ts'
  import type { Education, Experience, Project } from '../profile/types.ts'
  import { extractResumeText, extractedPastedText } from './extraction.ts'
  import { parsedResumeToDraft } from './mapping.ts'
  import { createResumeMappingService } from './mappingCoordinator.ts'
  import { draftToProfileDocument } from './profileDocument.ts'
  import type { ProfileDocumentDraft, ProfileValidationResult } from './types.ts'
  import { validateProfileDraft } from './validation.ts'

  const inputStep = document.querySelector<HTMLElement>('#inputStep')!
  const buildingStep = document.querySelector<HTMLElement>('#buildingStep')!
  const reviewStep = document.querySelector<HTMLElement>('#reviewStep')!
  const inputError = document.querySelector<HTMLElement>('#inputError')!
  const fileInput = document.querySelector<HTMLInputElement>('#resumeFile')!
  const textInput = document.querySelector<HTMLTextAreaElement>('#resumeText')!
  const photoFileInput = document.querySelector<HTMLInputElement>('#photoFile')!
  const photoPreview = document.querySelector<HTMLImageElement>('#photoPreview')!
  const photoPreviewWrap = document.querySelector<HTMLElement>('#photoPreviewWrap')!
  const avatarChoice = document.querySelector<HTMLElement>('#avatarChoice')!
  const avatarStatus = document.querySelector<HTMLElement>('#avatarStatus')!
  const avatarSettings = document.querySelector<HTMLElement>('#avatarSettings')!
  const avatarPresetSelect = document.querySelector<HTMLSelectElement>('#avatarPreset')!
  const avatarStyleSelect = document.querySelector<HTMLSelectElement>('#avatarStyle')!
  const generateAvatarButton = document.querySelector<HTMLButtonElement>('#generateAvatarButton')!
  const buildButton = document.querySelector<HTMLButtonElement>('#buildButton')!
  const mappingService = createResumeMappingService()
  let draft: ProfileDocumentDraft | null = null
  let selectedPhotoUrl: string | null = null
  let selectedPhotoFile: File | null = null
  let generatedFrameSet: AvatarFrameSet | null = null
  let activeAvatarPreview: { destroy: () => void } | null = null
  const authenticatedUser = await requireAuthenticatedUser()
  const ownedProfile = await getOwnedProfile(authenticatedUser)
  let cvPath: string | null = null
  let originalPhotoPath: string | null = null
  let avatarFramePaths: string[] = []

  const field = <T extends HTMLInputElement | HTMLTextAreaElement>(id: string): T => document.querySelector<T>(`#${id}`)!
  const lines = (value: string): string[] => value.split('\n').map((line) => line.trim()).filter(Boolean)
  const parts = (value: string): string[] => value.split('|').map((part) => part.trim())

  function getSelectedAvatarPreset(): 'fast' | 'balanced' | 'smooth' {
    const value = avatarPresetSelect.value
    if (value === 'fast' || value === 'balanced' || value === 'smooth') return value
    return 'fast'
  }

  function getSelectedAvatarStyle(): string {
    return avatarStyleSelect.value
  }

  function updateBuildButtonText(): void {
    if (!selectedPhotoUrl) {
      buildButton.textContent = 'Build temporary profile'
      return
    }
    const mode = document.querySelector<HTMLInputElement>('input[name="avatarMode"]:checked')?.value === 'dynamic' ? 'dynamic' : 'original'
    buildButton.textContent = mode === 'dynamic'
      ? 'Build temporary profile with dynamic avatar'
      : 'Build temporary profile with original photo'
  }

  function updateGenerateButtonText(): void {
    const isDynamic = document.querySelector<HTMLInputElement>('input[name="avatarMode"]:checked')?.value === 'dynamic'
    generateAvatarButton.textContent = isDynamic ? 'Generate dynamic avatar' : 'Use the original photo'
  }

  function destroyAvatarPreview(): void {
    activeAvatarPreview?.destroy()
    activeAvatarPreview = null
    const host = photoPreviewWrap.querySelector<HTMLElement>('.lookatme-avatar-host')
    host?.remove()
  }

  function showSelectedPhotoPreview(): void {
    destroyAvatarPreview()
    photoPreview.hidden = false
    if (selectedPhotoUrl) {
      photoPreview.src = selectedPhotoUrl
    }
  }

  function showGeneratedAvatarPreview(): void {
    if (!generatedFrameSet) {
      showSelectedPhotoPreview()
      return
    }
    destroyAvatarPreview()
    photoPreview.hidden = true
    const host = document.createElement('div')
    host.className = 'lookatme-avatar-host'
    host.setAttribute('aria-label', 'Generated avatar preview')
    photoPreviewWrap.appendChild(host)
    activeAvatarPreview = createLookAtMeAvatar({
      container: host,
      frames: generatedFrameSet,
      width: '100%',
      height: '220px',
      objectFit: 'contain',
      deadZone: 0.12,
      tracking: 'viewport',
      alt: 'Generated avatar preview',
    })
  }

  function syncPreviewForMode(): void {
    if (!selectedPhotoUrl) {
      showSelectedPhotoPreview()
      return
    }
    const mode = document.querySelector<HTMLInputElement>('input[name="avatarMode"]:checked')?.value === 'dynamic' ? 'dynamic' : 'original'
    if (mode === 'dynamic' && generatedFrameSet) {
      showGeneratedAvatarPreview()
      return
    }
    showSelectedPhotoPreview()
  }

  function getEstimatedSeconds(preset: 'fast' | 'balanced' | 'smooth'): number {
    return preset === 'fast' ? 180 : preset === 'balanced' ? 300 : 420
  }

  function setAvatarStatus(message: string, tone: 'info' | 'success' | 'error' = 'info'): void {
    avatarStatus.textContent = message
    avatarStatus.classList.remove('error', 'success')
    if (tone === 'error') avatarStatus.classList.add('error')
    if (tone === 'success') avatarStatus.classList.add('success')
  }

  function syncPhotoDraftState(): void {
    const mode = (document.querySelector<HTMLInputElement>('input[name="avatarMode"]:checked')?.value ?? 'original') as 'original' | 'dynamic'
    const normalizedMode = normalizeAvatarMode(mode)
    if (!draft) return
    draft.avatarMode = normalizedMode
    draft.avatarImageUrl = selectedPhotoUrl ?? draft.avatarImageUrl ?? undefined
    draft.avatarPreset = normalizedMode === 'dynamic' ? getSelectedAvatarPreset() : undefined
    draft.avatarFrameSet = normalizedMode === 'dynamic' ? generatedFrameSet ?? null : null
  }

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
    const updatedDraft: ProfileDocumentDraft = {
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
    syncPhotoDraftState()
    return { ...draft, ...updatedDraft, avatarMode: updatedDraft.avatarMode, avatarPreset: updatedDraft.avatarPreset, avatarImageUrl: updatedDraft.avatarImageUrl, avatarFrameSet: updatedDraft.avatarFrameSet }
  }

  function clearSelectedPhoto(): void {
    selectedPhotoUrl = null
    selectedPhotoFile = null
    generatedFrameSet = null
    photoPreview.src = ''
    destroyAvatarPreview()
    photoPreview.hidden = false
    photoPreviewWrap.hidden = true
    avatarChoice.hidden = true
    avatarSettings.hidden = true
    photoFileInput.value = ''
    document.querySelectorAll<HTMLInputElement>('input[name="avatarMode"]').forEach((input) => {
      input.checked = input.value === 'original'
    })
    setAvatarStatus('', 'info')
    updateBuildButtonText()
    updateGenerateButtonText()
  }

  async function handlePhotoSelection(): Promise<void> {
    const [file] = Array.from(photoFileInput.files ?? [])
    if (!file) {
      clearSelectedPhoto()
      return
    }
    selectedPhotoFile = file
    const reader = new FileReader()
    reader.onload = () => {
      selectedPhotoUrl = typeof reader.result === 'string' ? reader.result : null
      if (!selectedPhotoUrl) {
        clearSelectedPhoto()
        return
      }
      photoPreview.src = selectedPhotoUrl
      photoPreviewWrap.hidden = false
      avatarChoice.hidden = false
      avatarSettings.hidden = true
      generatedFrameSet = null
      destroyAvatarPreview()
      photoPreview.hidden = false
      document.querySelector<HTMLInputElement>('input[name="avatarMode"][value="original"]')!.checked = true
      setAvatarStatus('', 'info')
      updateBuildButtonText()
      updateGenerateButtonText()
      if (draft) {
        draft.avatarMode = 'original'
        draft.avatarImageUrl = selectedPhotoUrl
        draft.avatarPreset = undefined
        draft.avatarFrameSet = null
      }
    }
    reader.readAsDataURL(file)
  }

  async function generateDynamicAvatar(): Promise<void> {
    if (!selectedPhotoFile || !selectedPhotoUrl) {
      setAvatarStatus('Upload a portrait before generating a dynamic avatar.', 'error')
      return
    }
    const preset = getSelectedAvatarPreset()
    const style = getSelectedAvatarStyle()
    const estimatedSeconds = getEstimatedSeconds(preset)
    const apiBaseUrl = ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
    const avatarEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/avatar/generate` : '/api/avatar/generate'
    generateAvatarButton.disabled = true

    const dotCycle = ['...', '....', '.....', '......', '.....', '....', '...']
    let progressTick = 0
    const renderProgress = (): void => {
      progressTick = (progressTick + 1) % dotCycle.length
      const dots = dotCycle[progressTick]
      setAvatarStatus(`Estimated ${estimatedSeconds}s to generate your ${preset} avatar${dots}`, 'info')
    }
    const progressInterval = window.setInterval(renderProgress, 1000)
    renderProgress()
    try {
      const payload = new FormData()
      payload.append('portrait', selectedPhotoFile)
      payload.append('confirmGeneration', 'true')
      payload.append('preset', preset)
      payload.append('style', style)

      const { data: { session } } = await requireSupabase().auth.getSession()
      const response = await fetch(avatarEndpoint, {
        method: 'POST',
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        body: payload,
      })
      const rawText = await response.text()
      let result: { error?: string; frames?: unknown; avatarPreset?: string }
      if (!rawText) {
        throw new Error('The local avatar API is not responding. Start `pnpm dev:api` and confirm the backend is running.')
      }
      try {
        result = JSON.parse(rawText) as { error?: string; frames?: unknown; avatarPreset?: string }
      } catch {
        throw new Error(`The avatar API returned an invalid response. Run \`pnpm dev:api\` and make sure the server is listening on port 3001.`)
      }
      if (!response.ok || !result.frames || !isAvatarFrameSet(result.frames)) {
        throw new Error(result.error ?? 'Dynamic avatar generation could not be completed.')
      }
      const durable = await persistAvatarFrames(ownedProfile, result.frames)
      generatedFrameSet = durable.frames
      avatarFramePaths = durable.paths
      const resolvedPreset = result.avatarPreset === 'fast' || result.avatarPreset === 'balanced' || result.avatarPreset === 'smooth'
        ? result.avatarPreset
        : preset
      document.querySelector<HTMLInputElement>('input[name="avatarMode"][value="dynamic"]')!.checked = true
      avatarSettings.hidden = false
      if (draft) {
        draft.avatarMode = 'dynamic'
        draft.avatarPreset = resolvedPreset
        draft.avatarImageUrl = selectedPhotoUrl
        draft.avatarFrameSet = generatedFrameSet
      }
      setAvatarStatus(`Dynamic avatar ready with the ${resolvedPreset} motion profile.`, 'success')
      await saveOnboardingState(ownedProfile, {
        draft,
        avatar_frame_paths: avatarFramePaths,
        avatar_metadata: { preset: resolvedPreset, style, frameSet: generatedFrameSet },
        selected_avatar_mode: 'dynamic',
      })
      syncPreviewForMode()
      updateBuildButtonText()
      updateGenerateButtonText()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Dynamic avatar generation failed.'
      document.querySelector<HTMLInputElement>('input[name="avatarMode"][value="original"]')!.checked = true
      avatarSettings.hidden = true
      if (draft) {
        draft.avatarMode = 'original'
        draft.avatarPreset = undefined
        draft.avatarFrameSet = null
      }
      setAvatarStatus(message, 'error')
      updateBuildButtonText()
      updateGenerateButtonText()
    } finally {
      window.clearInterval(progressInterval)
      generateAvatarButton.disabled = false
    }
  }

  document.querySelectorAll<HTMLInputElement>('input[name="avatarMode"]').forEach((input) => {
    input.addEventListener('change', () => {
      const value = input.value === 'dynamic' ? 'dynamic' : 'original'
      const dynamicSelected = value === 'dynamic'
      avatarSettings.hidden = !dynamicSelected
      updateBuildButtonText()
      updateGenerateButtonText()
      if (dynamicSelected) {
        if (generatedFrameSet) {
          const preset = getSelectedAvatarPreset()
          if (draft) {
            draft.avatarMode = 'dynamic'
            draft.avatarPreset = preset
            draft.avatarImageUrl = selectedPhotoUrl ?? draft.avatarImageUrl
            draft.avatarFrameSet = generatedFrameSet
          }
          syncPreviewForMode()
          setAvatarStatus('', 'info')
        } else {
          setAvatarStatus('', 'info')
        }
        return
      }
      if (draft) {
        draft.avatarMode = 'original'
        draft.avatarPreset = undefined
        draft.avatarImageUrl = selectedPhotoUrl ?? draft.avatarImageUrl
        draft.avatarFrameSet = null
      }
      syncPreviewForMode()
      setAvatarStatus('', 'info')
    })
  })

  avatarPresetSelect.addEventListener('change', () => {
    if (document.querySelector<HTMLInputElement>('input[name="avatarMode"]:checked')?.value === 'dynamic') {
      updateBuildButtonText()
      updateGenerateButtonText()
    }
  })

  avatarStyleSelect.addEventListener('change', () => {
    if (document.querySelector<HTMLInputElement>('input[name="avatarMode"]:checked')?.value === 'dynamic') {
      setAvatarStatus('', 'info')
    }
  })

  photoFileInput.addEventListener('change', handlePhotoSelection)
  generateAvatarButton.addEventListener('click', generateDynamicAvatar)
  updateBuildButtonText()
  updateGenerateButtonText()

  buildButton.addEventListener('click', async () => {
    inputError.hidden = true
    showStep(buildingStep)
    try {
      const extracted = fileInput.files?.[0]
        ? await extractResumeText(fileInput.files[0])
        : extractedPastedText(textInput.value)
      document.querySelector<HTMLElement>('#buildingStatus')!.textContent = 'Mapping structured resume information…'
      const parsed = await mappingService.mapResume(extracted)
      draft = parsedResumeToDraft(parsed)
      if (fileInput.files?.[0]) {
        cvPath = (await uploadProfileAsset(ownedProfile, 'profile-private-assets', 'cv', fileInput.files[0], fileInput.files[0].name)).path
      }
      if (selectedPhotoFile) {
        const uploadedPhoto = await uploadProfileAsset(ownedProfile, 'profile-private-assets', 'original-photo', selectedPhotoFile, selectedPhotoFile.name)
        originalPhotoPath = uploadedPhoto.path
        selectedPhotoUrl = await createPrivateAssetUrl(uploadedPhoto.path)
      }
      draft.avatarMode = normalizeAvatarMode(document.querySelector<HTMLInputElement>('input[name="avatarMode"]:checked')?.value)
      draft.avatarPreset = draft.avatarMode === 'dynamic' ? getSelectedAvatarPreset() : undefined
      draft.avatarImageUrl = selectedPhotoUrl ?? undefined
      draft.avatarFrameSet = draft.avatarMode === 'dynamic' ? generatedFrameSet ?? null : null
      reviewStep.dataset.mapper = draft.mapping.mapper
      if ((import.meta as ImportMeta & { env?: Record<string, unknown> }).env?.DEV) {
        console.info('[onboarding] Review UI populated', { mapper: draft.mapping.mapper })
      }
      populateReview(draft)
      await saveOnboardingState(ownedProfile, {
        draft,
        cv_path: cvPath,
        original_photo_path: originalPhotoPath,
        avatar_frame_paths: avatarFramePaths,
        avatar_metadata: generatedFrameSet ? { preset: draft.avatarPreset, frameSet: generatedFrameSet } : {},
        selected_avatar_mode: draft.avatarMode,
      })
      showStep(reviewStep)
    } catch (error) {
      inputError.textContent = error instanceof Error ? error.message : 'The resume could not be processed.'
      inputError.hidden = false
      showStep(inputStep)
    }
  })

  document.querySelector('#startOverButton')!.addEventListener('click', () => {
    draft = null
    generatedFrameSet = null
    selectedPhotoUrl = null
    selectedPhotoFile = null
    fileInput.value = ''
    textInput.value = ''
    photoFileInput.value = ''
    clearSelectedPhoto()
    showStep(inputStep)
  })

  document.querySelector<HTMLFormElement>('#reviewForm')!.addEventListener('submit', async (event) => {
    event.preventDefault()
    try {
      draft = readReview()
      const result = validateProfileDraft(draft)
      renderIssues(result)
      if (!result.valid) return
      const document = draftToProfileDocument(draft, { profileId: ownedProfile.id, slug: ownedProfile.slug })
      await saveProfileDocument(ownedProfile, document)
      await saveOnboardingState(ownedProfile, {
        draft,
        cv_path: cvPath,
        original_photo_path: originalPhotoPath,
        avatar_frame_paths: avatarFramePaths,
        avatar_metadata: generatedFrameSet ? { preset: draft.avatarPreset, frameSet: generatedFrameSet } : {},
        selected_avatar_mode: draft.avatarMode,
      })
      window.location.assign('/preview')
    } catch (error) {
      inputError.textContent = error instanceof Error ? error.message : 'The profile could not be previewed.'
      inputError.hidden = false
    }
  })

  const persisted = await loadOnboardingState(ownedProfile)
  if (persisted) {
    cvPath = persisted.cv_path
    originalPhotoPath = persisted.original_photo_path
    avatarFramePaths = persisted.avatar_frame_paths
    draft = persisted.draft
    const persistedFrames = persisted.avatar_metadata.frameSet
    if (isAvatarFrameSet(persistedFrames)) generatedFrameSet = persistedFrames
    if (draft) {
      selectedPhotoUrl = originalPhotoPath && draft.avatarMode === 'original'
        ? await createPrivateAssetUrl(originalPhotoPath)
        : draft.avatarImageUrl ?? null
      draft.avatarImageUrl = selectedPhotoUrl ?? undefined
      if (selectedPhotoUrl) {
        photoPreview.src = selectedPhotoUrl
        photoPreviewWrap.hidden = false
        avatarChoice.hidden = false
      }
      const mode = draft.avatarMode === 'dynamic' ? 'dynamic' : 'original'
      document.querySelector<HTMLInputElement>(`input[name="avatarMode"][value="${mode}"]`)!.checked = true
      avatarSettings.hidden = mode !== 'dynamic'
      populateReview(draft)
      syncPreviewForMode()
      showStep(reviewStep)
    }
  }
