import { createLookAtMeAvatar } from 'lookatme-avatar/vanilla'
import type { OwnedProfile, OnboardingState } from '../profile/repository.ts'
import { saveOnboardingState } from '../profile/repository.ts'
import { activateAvatar, avatarAssetFrameSet, avatarPreviewUrl, createAvatarJob, deleteAvatar, listAvatarAssets, listAvatarJobs, originalPhotoUrl, retryAvatarJob, uploadOriginalPhoto } from './repository.ts'
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
  let previews: Array<{ destroy(): void }> = []
  const message = view.querySelector<HTMLElement>('.avatar-page-message')!
  const setMessage = (value: string, error = false) => { message.textContent = value; message.classList.toggle('error', error) }
  const originalHost = view.querySelector<HTMLElement>('#originalPreview')!
  const currentHost = view.querySelector<HTMLElement>('#currentAvatar')!

  async function renderOriginal(): Promise<void> {
    originalHost.replaceChildren()
    const url = await originalPhotoUrl(state?.original_photo_path ?? null)
    if (!url) { originalHost.textContent = 'No original photo uploaded'; return }
    const image = element('img'); image.src = url; image.alt = 'Original profile photo'; originalHost.append(image)
  }

  async function renderCurrent(): Promise<void> {
    currentHost.replaceChildren(); previews.forEach((preview) => preview.destroy()); previews = []
    const active = assets.find(({ id }) => id === profile.active_avatar_id)
    if (active) {
      const host = element('div', 'avatar-live-preview'); currentHost.append(host)
      previews.push(createLookAtMeAvatar({ container: host, frames: avatarAssetFrameSet(active), width: '220px', height: '220px', objectFit: 'contain', alt: 'Active generated avatar' }))
      currentHost.append(element('strong', '', 'Generated avatar · Active')); return
    }
    const url = await originalPhotoUrl(state?.original_photo_path ?? null)
    if (url) { const image = element('img', 'avatar-current-image'); image.src = url; image.alt = 'Current original profile photo'; currentHost.append(image, element('strong', '', 'Original photo · Active')); return }
    currentHost.append(element('div', 'avatar-initials', ((profile.document as { identity?: { fullName?: string } }).identity?.fullName ?? '?').split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase()), element('strong', '', 'No avatar'))
  }

  function renderJobs(): void {
    const host = view.querySelector<HTMLElement>('#avatarJobs')!; host.replaceChildren()
    if (!jobs.length) { host.textContent = 'No generation jobs yet.'; return }
    jobs.slice(0, 4).forEach((job) => {
      const row = element('div', 'avatar-job')
      const detail = element('div'); detail.append(element('strong', '', job.status === 'ready' ? 'Avatar ready' : job.status === 'generating' ? 'Generating…' : job.status === 'queued' ? 'Queued…' : 'Generation failed'), element('small', '', `${job.style} · ${job.preset}`))
      row.append(detail)
      if (job.status === 'failed') { const retry = element('button', 'text-action', 'Retry'); retry.type = 'button'; retry.addEventListener('click', async () => { await retryAvatarJob(job.id); await refresh() }); row.append(retry) }
      host.append(row)
    })
  }

  function renderGallery(): void {
    const host = view.querySelector<HTMLElement>('#avatarGallery')!; host.replaceChildren()
    if (!assets.length) { host.textContent = 'Generated avatars will appear here.'; return }
    assets.forEach((asset) => {
      const card = element('article', 'avatar-card')
      const image = element('img'); image.src = avatarPreviewUrl(asset); image.alt = `${asset.style} avatar preview`
      const meta = element('div'); meta.append(element('strong', '', asset.style), element('small', '', `${asset.preset} · ${new Date(asset.created_at).toLocaleDateString()}`))
      if (profile.active_avatar_id === asset.id) meta.append(element('span', 'active-avatar-badge', 'Active'))
      const actions = element('div', 'avatar-card-actions')
      const preview = element('button', 'text-action', 'Preview'); preview.type = 'button'; preview.addEventListener('click', () => { currentHost.scrollIntoView({ behavior: 'smooth' }); const old = profile.active_avatar_id; profile.active_avatar_id = asset.id; void renderCurrent().finally(() => { profile.active_avatar_id = old }) })
      const use = element('button', 'primary-action', 'Use this avatar'); use.type = 'button'; use.disabled = profile.active_avatar_id === asset.id; use.addEventListener('click', async () => { await activateAvatar(profile, asset.id); profile.active_avatar_id = asset.id; await refresh() })
      const remove = element('button', 'text-action', 'Delete'); remove.type = 'button'; remove.disabled = profile.active_avatar_id === asset.id; remove.addEventListener('click', async () => { try { await deleteAvatar(profile, asset); await refresh() } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not delete avatar.', true) } })
      actions.append(preview, use, remove); card.append(image, meta, actions); host.append(card)
    })
  }

  async function refresh(): Promise<void> {
    ;[assets, jobs] = await Promise.all([listAvatarAssets(profile), listAvatarJobs(profile)])
    await Promise.all([renderOriginal(), renderCurrent()]); renderJobs(); renderGallery()
    const pending = jobs.some(({ status }) => status === 'queued' || status === 'generating')
    if (pending && poll === null) poll = window.setInterval(() => void refresh(), 5000)
    if (!pending && poll !== null) { window.clearInterval(poll); poll = null }
  }

  view.querySelector<HTMLInputElement>('#avatarPhoto')!.addEventListener('change', async (event) => {
    const file = (event.currentTarget as HTMLInputElement).files?.[0]; if (!file) return
    try { const path = await uploadOriginalPhoto(profile, file); state = { ...(state ?? { profile_id: profile.id, user_id: profile.user_id, draft: null, cv_path: null, avatar_frame_paths: [], avatar_metadata: {}, selected_avatar_mode: 'original' }), original_photo_path: path }; await saveOnboardingState(profile, { original_photo_path: path }); setMessage('Original photo updated.'); await refresh() } catch (error) { setMessage(error instanceof Error ? error.message : 'Photo upload failed.', true) }
  })
  view.querySelector<HTMLButtonElement>('#useOriginal')!.addEventListener('click', async () => { if (!state?.original_photo_path) return setMessage('Upload an original photo first.', true); await activateAvatar(profile, null); profile.active_avatar_id = null; setMessage('Original photo is now active.'); await refresh() })
  view.querySelector<HTMLButtonElement>('#queueAvatar')!.addEventListener('click', async () => {
    if (!state?.original_photo_path) return setMessage('Upload an original photo first.', true)
    const style = view.querySelector<HTMLSelectElement>('#avatarStyle')!.value
    const preset = view.querySelector<HTMLSelectElement>('#avatarPreset')!.value as AvatarPreset
    try { await createAvatarJob(profile, state.original_photo_path, style, preset); setMessage('Generation queued. You can safely leave this page.'); await refresh() } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not queue generation.', true) }
  })

  return { view, start: refresh, stop() { if (poll !== null) window.clearInterval(poll); poll = null; previews.forEach((preview) => preview.destroy()) } }
}
