import { authenticateBearer, createAuthenticatedServerClient, createServiceRoleServerClient } from '../auth/server.ts'
import { effectivePlan, getUsageLimit } from '../monetisation/entitlements.ts'
import type { Subscription } from '../monetisation/subscription.ts'
import { isOwnedAssetPath } from '../profile/repository.ts'
import { isAvatarPreset } from './types.ts'

const styles = new Set(['felt@1', 'cartoon@1', 'cinematic-3d@1', 'anime@1'])

export async function handleAvatarJobRequest(authorization: string | undefined, input: unknown): Promise<{ status: number; body: unknown }> {
  const user = await authenticateBearer(authorization)
  const ownerClient = createAuthenticatedServerClient(authorization)
  const serviceClient = createServiceRoleServerClient()
  if (!user || !ownerClient) return { status: 401, body: { error: 'Authentication required.' } }
  if (!serviceClient) return { status: 503, body: { error: 'Avatar generation is unavailable.' } }

  const body = input as { profileId?: unknown; sourcePhotoPath?: unknown; style?: unknown; preset?: unknown } | null
  if (!body || typeof body.profileId !== 'string' || typeof body.sourcePhotoPath !== 'string' || typeof body.style !== 'string' || !isAvatarPreset(body.preset)) {
    return { status: 400, body: { error: 'profileId, sourcePhotoPath, style, and preset are required.' } }
  }
  if (!styles.has(body.style)) return { status: 400, body: { error: 'Unsupported avatar style.' } }
  if (!isOwnedAssetPath(body.sourcePhotoPath, user.id, body.profileId) || !body.sourcePhotoPath.includes('/original-photo/')) {
    return { status: 403, body: { error: 'The source photo is not owned by this profile.' } }
  }

  const [{ data: profile }, { data: subscription, error: subscriptionError }] = await Promise.all([
    ownerClient.from('profiles').select('id').eq('id', body.profileId).eq('user_id', user.id).maybeSingle(),
    ownerClient.from('subscriptions').select('*').eq('user_id', user.id).single(),
  ])
  if (!profile) return { status: 404, body: { error: 'Profile not found.' } }
  if (subscriptionError) return { status: 503, body: { error: 'Plan information is unavailable.' } }

  const limit = getUsageLimit(effectivePlan(subscription as Subscription), 'avatar.generate')
  const { data, error } = await serviceClient.rpc('create_metered_avatar_job', {
    requested_user_id: user.id,
    requested_profile_id: profile.id,
    requested_source_photo_path: body.sourcePhotoPath,
    requested_style: body.style,
    requested_preset: body.preset,
    monthly_limit: limit ?? 2147483647,
  })
  if (error?.message.includes('AVATAR_LIMIT_REACHED')) {
    return { status: 402, body: { code: 'avatar_limit_reached', error: 'Your monthly Avatar limit has been reached. Upgrade to Pro for more generations.' } }
  }
  if (error?.code === '23505') return { status: 409, body: { error: 'This profile already has a queued or generating avatar.' } }
  if (error) return { status: 400, body: { error: 'Could not queue avatar generation.' } }
  const job = Array.isArray(data) ? data[0] : data
  return { status: 202, body: { job } }
}
