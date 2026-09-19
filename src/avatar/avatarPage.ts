import { createLookAtMeAvatar } from 'lookatme-avatar/vanilla'
import type { OwnedProfile, OnboardingState } from '../profile/repository.ts'
import { saveOnboardingState } from '../profile/repository.ts'
import { activateAvatar, avatarAssetFrameSet, avatarPreviewUrl, cancelAvatarJob, createAvatarJob, deleteAvatar, listAvatarAssets, listAvatarJobs, originalPhotoUrl, retryAvatarJob, uploadOriginalPhoto } from './repository.ts'
import { avatarAssetsKey, avatarJobsKey, hasActiveGeneration, transitionedToReady } from './pageState.ts'
import type { AvatarAsset, AvatarGenerationJob, AvatarPreset } from './types.ts'

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node
}

export function createAvatarPage(profile: OwnedProfile, initialState: OnboardingState | null): { view: HTMLElement; start(): Promise<void>; stop(): void } {
  const view = element('main', 'dashboard-content avatar-page')
  view.innerHTML = `<header class="dashboard-heading"><div><h1>Avatar</h1><p>Manage your profile photo and generated mouse-follow avatars.</p></div></header><p class="avatar-page-message" role="status" aria-live="polite"></p><section class="card avatar-current"><p class="label">Current avatar</p><div id="currentAvatar"></div></section><section class="card avatar-create"><p class="label">Create avatar</p><div class="avatar-source"><div id="originalPreview" class="avatar-preview"></div><div><label class="avatar-upload">Upload or change original photo<input id="avatarPhoto" type="file" accept="image/jpeg,image/png,image/webp"></label><button id="useOriginal" class="text-action" type="button">Use original photo</button></div></div><div class="avatar-controls"><label>Style<select id="avatarStyle"><option value="felt@1">Handmade felt</option><option value="cartoon@1">Graphic cartoon</option><option value="cinematic-3d@1">Cinematic 3D</option><option value="anime@1">Modern anime</option></select></label><label>Preset<select id="avatarPreset"><option value="fast">Fast</option><option value="balanced">Balanced</option><option value="smooth">Smooth</option></select></label><button id="queueAvatar" class="primary-action" type="button">Generate avatar</button></div></section><section class="card"><p class="label">Generation status</p><div id="avatarJobs" class="avatar-jobs"></div></section><section class="card"><p class="label">Your avatars</p><div id="avatarGallery" class="avatar-gallery"></div></section>`
  let state = initialState
  let assets: AvatarAsset[] = []
  let jobs: AvatarGenerationJob[] = []
  let poll: number | null = null
  let stopped = false
  let originalPathRendered: string | null | undefined
  let originalUrlCached: string | null = null
  let currentAvatarKey: string | null = null
  let galleryKey = ''
  let jobsKey = ''
  let activePreview: { destroy(): void } | null = null
  const message = view.querySelector<HTMLElement>('.avatar-page-message')!
  const originalHost = view.querySelector<HTMLElement>('#originalPreview')!
  const currentHost = view.querySelector<HTMLElement>('#currentAvatar')!
  const generateButton = view.querySelector<HTMLButtonElement>('#queueAvatar')!
  const setMessage = (value: string, error = false) => { message.textContent = value; message.classList.toggle('error', error) }

  async function cachedOriginalUrl(): Promise<string | null> {
    const path = state?.original_photo_path ?? null
    if (path === originalPathRendered) return originalUrlCached
    originalPathRendered = path
    originalUrlCached = await originalPhotoUrl(path)
    return originalUrlCached
  }

  async function renderOriginalIfChanged(): Promise<void> {
    const path = state?.original_photo_path ?? null
    if (path === originalPathRendered) return
    const url = await cachedOriginalUrl()
    originalHost.replaceChildren()
    if (!url) { originalHost.textContent = 'No original photo uploaded'; return }
    const image = element('img'); image.src = url; image.alt = 'Original profile photo'; originalHost.append(image)
  }

  async function renderCurrentIfChanged(force = false): Promise<void> {
    const key = profile.active_avatar_id ? `generated:${profile.active_avatar_id}` : state?.original_photo_path ? `original:${state.original_photo_path}` : 'initials'
    if (!force && key === currentAvatarKey) return
    currentAvatarKey = key
    activePreview?.destroy(); activePreview = null; currentHost.replaceChildren()
    const active = assets.find(({ id }) => id === profile.active_avatar_id)
    if (active) {
      const host = element('div', 'avatar-live-preview'); currentHost.append(host)
      activePreview = createLookAtMeAvatar({ container: host, frames: avatarAssetFrameSet(active), width: '220px', height: '220px', objectFit: 'contain', alt: 'Active generated avatar' })
      currentHost.append(element('strong', '', 'Generated avatar · Active')); return
    }
    const url = await cachedOriginalUrl()
    if (url) { const image = element('img', 'avatar-current-image'); image.src = url; image.alt = 'Current original profile photo'; currentHost.append(image, element('strong', '', 'Original photo · Active')); return }
    const name = (profile.document as { identity?: { fullName?: string } }).identity?.fullName ?? '?'
    currentHost.append(element('div', 'avatar-initials', name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()), element('strong', '', 'No avatar'))
  }

  function syncGenerateButton(): void {
    const active = jobs.find(({ status }) => status === 'queued' || status === 'generating')
    generateButton.disabled = Boolean(active)
    generateButton.textContent = active?.status === 'queued' ? 'Generation queued' : active?.status === 'generating' ? 'Generation in progress' : 'Generate avatar'
  }

  function renderJobsIfChanged(force = false): void {
    const nextKey = avatarJobsKey(jobs)
    if (!force && nextKey === jobsKey) return
    jobsKey = nextKey
    const host = view.querySelector<HTMLElement>('#avatarJobs')!; host.replaceChildren()
    if (!jobs.length) { host.textContent = 'No generation jobs yet.'; syncGenerateButton(); return }
    jobs.slice(0, 4).forEach((job) => {
      const row = element('div', 'avatar-job')
      const detail = element('div')
      const title = job.status === 'ready' ? 'Ready' : job.status === 'generating' ? 'Generating…' : job.status === 'queued' ? 'Queued…' : job.status === 'cancelled' ? 'Cancelled' : 'Failed'
      const description = job.status === 'queued' ? 'Waiting for generation capacity.' : job.status === 'generating' ? 'Creating your avatar…' : job.status === 'cancelled' ? 'Generation cancelled.' : job.status === 'failed' ? (job.error ?? 'Generation failed.') : `${job.style} · ${job.preset}`
      detail.append(element('strong', '', title), element('small', '', description)); row.append(detail)
      if (job.status === 'queued') {
        const cancel = element('button', 'text-action', 'Cancel generation'); cancel.type = 'button'
        cancel.addEventListener('click', async () => {
          try { const cancelled = await cancelAvatarJob(job.id); if (!cancelled) setMessage('Generation has already started and can no longer be cancelled.', true); await pollJobsOnce() } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not cancel generation.', true) }
        }); row.append(cancel)
      } else if (job.status === 'failed') {
        const retry = element('button', 'text-action', 'Retry'); retry.type = 'button'; retry.addEventListener('click', async () => { try { await retryAvatarJob(job.id); await pollJobsOnce() } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not retry generation.', true) } }); row.append(retry)
      } else if (job.status === 'ready') {
        const actions = element('div', 'avatar-card-actions')
        const preview = element('button', 'text-action', 'Preview'); preview.type = 'button'; preview.addEventListener('click', () => view.querySelector<HTMLElement>('#avatarGallery')?.scrollIntoView({ behavior: 'smooth' }))
        const use = element('button', 'primary-action', 'Use this avatar'); use.type = 'button'; use.disabled = !job.avatar_id || profile.active_avatar_id === job.avatar_id
        use.addEventListener('click', async () => { if (!job.avatar_id) return; await activateAvatar(profile, job.avatar_id); profile.active_avatar_id = job.avatar_id; if (!assets.some(({ id }) => id === job.avatar_id)) assets = await listAvatarAssets(profile); await renderCurrentIfChanged(); renderGalleryIfChanged(true); renderJobsIfChanged(true) })
        actions.append(preview, use); row.append(actions)
      }
      host.append(row)
    })
    syncGenerateButton()
  }

  function renderGalleryIfChanged(force = false): void {
    const nextKey = avatarAssetsKey(assets)
    if (!force && nextKey === galleryKey) return
    galleryKey = nextKey
    const host = view.querySelector<HTMLElement>('#avatarGallery')!; host.replaceChildren()
    if (!assets.length) { host.textContent = 'Generated avatars will appear here.'; return }
    assets.forEach((asset) => {
      const card = element('article', 'avatar-card'); const image = element('img'); image.src = avatarPreviewUrl(asset); image.alt = `${asset.style} avatar preview`
      const meta = element('div'); meta.append(element('strong', '', asset.style), element('small', '', `${asset.preset} · ${new Date(asset.created_at).toLocaleDateString()}`)); if (profile.active_avatar_id === asset.id) meta.append(element('span', 'active-avatar-badge', 'Active'))
      const actions = element('div', 'avatar-card-actions')
      const preview = element('button', 'text-action', 'Preview'); preview.type = 'button'; preview.addEventListener('click', () => { currentHost.scrollIntoView({ behavior: 'smooth' }); const old = profile.active_avatar_id; profile.active_avatar_id = asset.id; void renderCurrentIfChanged(true).finally(() => { profile.active_avatar_id = old; currentAvatarKey = null }) })
      const use = element('button', 'primary-action', 'Use this avatar'); use.type = 'button'; use.disabled = profile.active_avatar_id === asset.id; use.addEventListener('click', async () => { await activateAvatar(profile, asset.id); profile.active_avatar_id = asset.id; await renderCurrentIfChanged(); renderGalleryIfChanged(true) })
      const remove = element('button', 'text-action', 'Delete'); remove.type = 'button'; remove.disabled = profile.active_avatar_id === asset.id; remove.addEventListener('click', async () => { try { await deleteAvatar(profile, asset); assets = await listAvatarAssets(profile); renderGalleryIfChanged(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not delete avatar.', true) } })
      actions.append(preview, use, remove); card.append(image, meta, actions); host.append(card)
    })
  }

  function syncPolling(): void {
    const pending = hasActiveGeneration(jobs)
    if (pending && poll === null && !stopped) poll = window.setInterval(() => void pollJobsOnce(), 5000)
    if (!pending && poll !== null) { window.clearInterval(poll); poll = null }
  }

  async function pollJobsOnce(): Promise<void> {
    const previous = jobs
    const next = await listAvatarJobs(profile)
    const becameReady = transitionedToReady(previous, next)
    jobs = next; renderJobsIfChanged(); syncPolling()
    if (becameReady) { assets = await listAvatarAssets(profile); renderGalleryIfChanged() }
  }

  async function start(): Promise<void> {
    ;[assets, jobs] = await Promise.all([listAvatarAssets(profile), listAvatarJobs(profile)])
    await renderOriginalIfChanged(); await renderCurrentIfChanged(); renderJobsIfChanged(true); renderGalleryIfChanged(true); syncPolling()
  }

  view.querySelector<HTMLInputElement>('#avatarPhoto')!.addEventListener('change', async (event) => {
    const file = (event.currentTarget as HTMLInputElement).files?.[0]; if (!file) return
    try {
      const path = await uploadOriginalPhoto(profile, file)
      state = { ...(state ?? { profile_id: profile.id, user_id: profile.user_id, draft: null, cv_path: null, avatar_frame_paths: [], avatar_metadata: {}, selected_avatar_mode: 'original' }), original_photo_path: path }
      await saveOnboardingState(profile, { original_photo_path: path }); originalPathRendered = undefined; currentAvatarKey = null
      setMessage('Original photo updated.'); await renderOriginalIfChanged(); await renderCurrentIfChanged()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Photo upload failed.', true) }
  })
  view.querySelector<HTMLButtonElement>('#useOriginal')!.addEventListener('click', async () => { if (!state?.original_photo_path) return setMessage('Upload an original photo first.', true); await activateAvatar(profile, null); profile.active_avatar_id = null; currentAvatarKey = null; setMessage('Original photo is now active.'); await renderCurrentIfChanged(); renderGalleryIfChanged(true) })
  generateButton.addEventListener('click', async () => {
    if (!state?.original_photo_path) return setMessage('Upload an original photo first.', true)
    if (hasActiveGeneration(jobs)) return
    generateButton.disabled = true; generateButton.textContent = 'Queueing…'
    const style = view.querySelector<HTMLSelectElement>('#avatarStyle')!.value; const preset = view.querySelector<HTMLSelectElement>('#avatarPreset')!.value as AvatarPreset
    try { const job = await createAvatarJob(profile, state.original_photo_path, style, preset); jobs = [job, ...jobs]; setMessage('Generation queued. You can safely leave this page.'); renderJobsIfChanged(); syncPolling() } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not queue generation.', true); syncGenerateButton() }
  })

  return { view, start, stop() { stopped = true; if (poll !== null) window.clearInterval(poll); poll = null; activePreview?.destroy(); activePreview = null } }
}
