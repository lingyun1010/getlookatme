import { createClient } from '@supabase/supabase-js'
import type { AvatarImageStorage, GeneratedImage, AvatarFramePreset, AvatarStyleId } from 'lookatme-avatar'
import { OpenAIImageGenerationProvider, PhotoAIFrameProducer, SharpGeneratedImageValidator } from 'lookatme-avatar/server'
import type { AvatarGenerationJob } from './types.ts'
import { recordFunnelEventSafely } from '../analytics/events.ts'

function workerClient() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Avatar worker requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

class SupabaseAvatarStorage implements AvatarImageStorage {
  readonly paths = new Map<string, string>()
  private readonly job: AvatarGenerationJob
  private readonly client: ReturnType<typeof workerClient>

  constructor(job: AvatarGenerationJob, client: ReturnType<typeof workerClient>) {
    this.job = job
    this.client = client
  }
  createFrameSetId(): string { return this.job.id }
  private path(key: string, mimeType: GeneratedImage['mimeType']): string {
    const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png'
    return `${this.job.user_id}/${this.job.profile_id}/avatar-frames/${this.job.id}/${key}.${extension}`
  }
  async put(_frameSetId: string, key: string, image: GeneratedImage): Promise<{ src: string }> {
    const path = this.path(key, image.mimeType)
    const { error } = await this.client.storage.from('profile-public-assets').upload(path, image.data, { contentType: image.mimeType, upsert: true })
    if (error) throw error
    this.paths.set(key, path)
    return { src: this.client.storage.from('profile-public-assets').getPublicUrl(path).data.publicUrl }
  }
  async read(_frameSetId: string, key: string): Promise<GeneratedImage> {
    const path = this.paths.get(key)
    if (!path) throw new Error(`Generated frame ${key} was not found.`)
    const { data, error } = await this.client.storage.from('profile-public-assets').download(path)
    if (error) throw error
    return { data: new Uint8Array(await data.arrayBuffer()), mimeType: (data.type || 'image/png') as GeneratedImage['mimeType'] }
  }
}

export async function processNextAvatarJob(): Promise<{ processed: boolean; jobId?: string; status?: 'ready' | 'failed' }> {
  const client = workerClient()
  const { data, error } = await client.rpc('claim_avatar_generation_job', { stale_after: '15 minutes' })
  if (error) throw error
  const job = (Array.isArray(data) ? data[0] : data) as AvatarGenerationJob | null
  if (!job?.id) return { processed: false }
  try {
    if (!process.env.OPENAI_API_KEY) throw new Error('Avatar generation service is not configured.')
    const { data: source, error: downloadError } = await client.storage.from('profile-private-assets').download(job.source_photo_path)
    if (downloadError) throw downloadError
    const storage = new SupabaseAvatarStorage(job, client)
    const producer = new PhotoAIFrameProducer({
      provider: new OpenAIImageGenerationProvider({ apiKey: process.env.OPENAI_API_KEY }),
      storage,
      validator: new SharpGeneratedImageValidator(),
    })
    const frames = await producer.produce({
      image: new Uint8Array(await source.arrayBuffer()), mimeType: source.type || 'image/jpeg',
      style: job.style as AvatarStyleId, preset: job.preset as AvatarFramePreset,
    })
    const centerPath = storage.paths.get(frames.center.key || 'center')
    if (!centerPath) throw new Error('Avatar generation did not produce a center frame.')
    const directions = frames.directions.map((frame) => {
      const path = storage.paths.get(frame.key)
      if (!path) throw new Error(`Avatar generation did not persist ${frame.key}.`)
      return { key: frame.key, angle: frame.angle, path }
    })
    const { data: avatar, error: avatarError } = await client.from('avatars').upsert({
      user_id: job.user_id, profile_id: job.profile_id, generation_job_id: job.id,
      source_photo_path: job.source_photo_path, style: job.style, preset: job.preset,
      preview_path: centerPath, center_frame_path: centerPath,
      frame_paths: directions.map(({ path }) => path), frame_metadata: { directions },
    }, { onConflict: 'generation_job_id' }).select('id').single()
    if (avatarError) throw avatarError
    const { error: readyError } = await client.from('avatar_generation_jobs').update({
      status: 'ready', avatar_id: avatar.id, error: null, completed_at: new Date().toISOString(),
    }).eq('id', job.id).eq('status', 'generating')
    if (readyError) throw readyError
    await recordFunnelEventSafely(client, { userId: job.user_id, profileId: job.profile_id, eventType: 'avatar_generated' })
    return { processed: true, jobId: job.id, status: 'ready' }
  } catch (cause) {
    const errorName = cause instanceof Error ? cause.name : 'UnknownError'
    const errorMessage = cause instanceof Error ? cause.message : String(cause)
    console.error(`[avatar-worker] Job ${job.id} failed: ${errorName}: ${errorMessage}`)
    const safeError = cause instanceof Error && /configured/.test(cause.message) ? cause.message : 'Avatar generation failed. You can retry this job.'
    await client.from('avatar_generation_jobs').update({ status: 'failed', error: safeError, completed_at: new Date().toISOString() }).eq('id', job.id).eq('status', 'generating')
    return { processed: true, jobId: job.id, status: 'failed' }
  }
}
