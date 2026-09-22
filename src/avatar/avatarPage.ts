import { createLookAtMeAvatar } from 'lookatme-avatar/vanilla'
import type { OwnedProfile, OnboardingState } from '../profile/repository.ts'
import { saveOnboardingState } from '../profile/repository.ts'
import { activateAvatar, avatarAssetFrameSet, avatarPreviewUrl, cancelAvatarJob, createAvatarJob, deleteAvatar, listAvatarAssets, listAvatarJobs, originalPhotoUrl, retryAvatarJob, uploadOriginalPhoto } from './repository.ts'
import { avatarAssetsKey, avatarJobsKey, hasActiveGeneration, transitionedToReady } from './pageState.ts'
import type { AvatarAsset, AvatarGenerationJob, AvatarPreset } from './types.ts'

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node
}

export function createAvatarPage(profile: OwnedProfile, initialState: OnboardingState | null, usage?: {used:number;limit:number|null}): { view: HTMLElement; start(): Promise<void>; stop(): void } {
  const view = element('main', 'dashboard-content avatar-page')
  view.innerHTML = `<header class="dashboard-heading"><div><h1>Avatar</h1><p>Manage your profile photo and interactive avatar.</p></div></header>
<p class="avatar-page-message" role="status" aria-live="polite"></p>
<section class="card avatar-current">
  <div class="avatar-current-head"><p class="label">Current avatar</p></div>
  <div id="currentAvatar" class="avatar-current-body"></div>
  <div class="avatar-current-actions">
    <label class="btn btn-secondary avatar-upload-btn">Change photo<input id="avatarPhoto" type="file" accept="image/jpeg,image/png,image/webp" hidden></label>
    <button id="useOriginal" class="btn btn-tertiary" type="button">Use original photo</button>
  </div>
</section>
<section class="card avatar-create">
  <p class="label">Create a new avatar</p>
  <h2 class="panel-title">Style &amp; quality</h2>
  <div class="avatar-tool-layout">
    <div id="originalPreview" class="avatar-preview" aria-label="Source photo"></div>
    <div class="avatar-tool-controls">
      <div class="choice-field">
        <span class="choice-label">Style</span>
        <div class="choice-pills" data-for="avatarStyle">
          <button type="button" class="choice-pill is-selected" data-value="felt@1">Felt</button>
          <button type="button" class="choice-pill" data-value="cartoon@1">Cartoon</button>
          <button type="button" class="choice-pill" data-value="anime@1">Anime</button>
          <button type="button" class="choice-pill" data-value="cinematic-3d@1">3D</button>
        </div>
        <select id="avatarStyle" hidden><option value="felt@1" selected>Felt</option><option value="cartoon@1">Cartoon</option><option value="anime@1">Anime</option><option value="cinematic-3d@1">3D</option></select>
      </div>
      <div class="choice-field">
        <span class="choice-label">Generation</span>
        <div class="choice-pills" data-for="avatarPreset">
          <button type="button" class="choice-pill" data-value="fast">Fast</button>
          <button type="button" class="choice-pill is-selected" data-value="balanced">Balanced</button>
          <button type="button" class="choice-pill" data-value="smooth">Smooth</button>
        </div>
        <select id="avatarPreset" hidden><option value="fast">Fast</option><option value="balanced" selected>Balanced</option><option value="smooth">Smooth</option></select>
      </div>
      <div class="avatar-generate-row">
        <span id="avatarUsage" class="avatar-usage"></span>
        <button id="queueAvatar" class="btn btn-primary" type="button">Generate avatar</button>
      </div>
    </div>
  </div>
</section>
<section class="card avatar-jobs-card" id="avatarJobsCard" hidden>
  <p class="label">Generation status</p>
  <div id="avatarJobs" class="avatar-jobs"></div>
</section>
<section class="avatar-gallery-section">
  <h2 class="section-heading">Your avatars</h2>
  <div id="avatarGallery" class="avatar-gallery"></div>
</section>`
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
  const usageText = view.querySelector<HTMLElement>('#avatarUsage')!
  const renderUsage=()=>{
    if(!usage){usageText.hidden=true;return}
    usageText.hidden=false
    usageText.textContent=usage.limit===null?`${usage.used} avatar generations used this month`:`${usage.used} / ${usage.limit} avatar generations used`
  }
  renderUsage()
  const setMessage = (value: string, error = false, upgrade = false) => {
    message.replaceChildren(document.createTextNode(value))
    message.classList.toggle('error', error)
    if (upgrade) { const link = element('a', 'avatar-upgrade-link', 'View plans →'); link.href = '/dashboard/pricing'; message.append(' ', link) }
  }

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
    const card = view.querySelector<HTMLElement>('#avatarJobsCard')!
    const host = view.querySelector<HTMLElement>('#avatarJobs')!; host.replaceChildren()
    if (!jobs.length) { card.hidden = true; syncGenerateButton(); return }
    card.hidden = false
    jobs.slice(0, 4).forEach((job) => {
      const row = element('div', 'avatar-job')
      const detail = element('div')
      const title = job.status === 'ready' ? 'Ready' : job.status === 'generating' ? 'Generating…' : job.status === 'queued' ? 'Queued…' : job.status === 'cancelled' ? 'Cancelled' : 'Failed'
      const description = job.status === 'queued' ? 'Waiting for generation capacity.' : job.status === 'generating' ? 'Creating your avatar…' : job.status === 'cancelled' ? 'Generation cancelled.' : job.status === 'failed' ? (job.error ?? 'Generation failed.') : `${job.style} · ${job.preset}`
      detail.append(element('strong', '', title), element('small', '', description)); row.append(detail)
      if (job.status === 'queued') {
        const cancel = element('button', 'btn btn-tertiary', 'Cancel generation'); cancel.type = 'button'
        cancel.addEventListener('click', async () => {
          try { const cancelled = await cancelAvatarJob(job.id); if (!cancelled) setMessage('Generation has already started and can no longer be cancelled.', true); await pollJobsOnce() } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not cancel generation.', true) }
        }); row.append(cancel)
      } else if (job.status === 'failed') {
        const retry = element('button', 'btn btn-tertiary', 'Retry'); retry.type = 'button'; retry.addEventListener('click', async () => { try { await retryAvatarJob(job.id); await pollJobsOnce() } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not retry generation.', true) } }); row.append(retry)
      } else if (job.status === 'ready') {
        const actions = element('div', 'avatar-card-actions')
        const preview = element('button', 'btn btn-tertiary', 'Preview'); preview.type = 'button'; preview.addEventListener('click', () => view.querySelector<HTMLElement>('#avatarGallery')?.scrollIntoView({ behavior: 'smooth' }))
        const use = element('button', 'btn btn-primary', 'Use this avatar'); use.type = 'button'; use.disabled = !job.avatar_id || profile.active_avatar_id === job.avatar_id
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
    if (!assets.length) { host.replaceChildren(); const empty=element('div','empty-state'); empty.append(element('p','','No generated avatars yet.'), element('p','','New generations will appear here as a gallery.')); host.append(empty); return }
    assets.forEach((asset) => {
      const card = element('article', 'avatar-card'); const image = element('img'); image.src = avatarPreviewUrl(asset); image.alt = `${asset.style} avatar preview`
      const meta = element('div'); meta.append(element('strong', '', asset.style), element('small', '', `${asset.preset} · ${new Date(asset.created_at).toLocaleDateString()}`)); if (profile.active_avatar_id === asset.id) meta.append(element('span', 'active-avatar-badge', 'Active'))
      const actions = element('div', 'avatar-card-actions')
      const preview = element('button', 'btn btn-tertiary', 'Preview'); preview.type = 'button'; preview.addEventListener('click', () => { currentHost.scrollIntoView({ behavior: 'smooth' }); const old = profile.active_avatar_id; profile.active_avatar_id = asset.id; void renderCurrentIfChanged(true).finally(() => { profile.active_avatar_id = old; currentAvatarKey = null }) })
      const use = element('button', 'btn btn-primary', 'Use this avatar'); use.type = 'button'; use.disabled = profile.active_avatar_id === asset.id; use.addEventListener('click', async () => { await activateAvatar(profile, asset.id); profile.active_avatar_id = asset.id; await renderCurrentIfChanged(); renderGalleryIfChanged(true) })
      const remove = element('button', 'btn btn-tertiary', 'Delete'); remove.type = 'button'; remove.disabled = profile.active_avatar_id === asset.id; remove.addEventListener('click', async () => { try { await deleteAvatar(profile, asset); assets = await listAvatarAssets(profile); renderGalleryIfChanged(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not delete avatar.', true) } })
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
    try { const job = await createAvatarJob(profile, state.original_photo_path, style, preset); jobs = [job, ...jobs];if(usage){usage.used+=1;renderUsage()} setMessage('Generation queued. You can safely leave this page.'); renderJobsIfChanged(); syncPolling() } catch (error) { const cause = error as Error & { code?: string }; setMessage(cause instanceof Error ? cause.message : 'Could not queue generation.', true, cause.code === 'avatar_limit_reached'); syncGenerateButton() }
  })


  view.querySelectorAll<HTMLElement>('.choice-pills').forEach((group) => {
    const select = view.querySelector<HTMLSelectElement>(`#${group.dataset.for}`)!
    group.querySelectorAll<HTMLButtonElement>('.choice-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        select.value = pill.dataset.value ?? select.value
        group.querySelectorAll('.choice-pill').forEach((item) => item.classList.toggle('is-selected', item === pill))
      })
    })
  })

  return { view, start, stop() { stopped = true; if (poll !== null) window.clearInterval(poll); poll = null; activePreview?.destroy(); activePreview = null } }
}
