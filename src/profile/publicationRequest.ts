import { authenticateBearer } from '../auth/server.ts'
import { checkSlugAvailability, PublicationError, publishProfile, unpublishProfile, updateProfileSlug } from './publication.ts'
import { createPublicationRepository } from './publicationServer.ts'

export async function handlePublicationRequest(authorization: string | undefined, body: unknown): Promise<{ status: number; body: unknown }> {
  const user = await authenticateBearer(authorization)
  if (!user) return { status: 401, body: { error: 'Authentication required.' } }
  if (!body || typeof body !== 'object') return { status: 400, body: { error: 'Invalid publication request.' } }
  const { action, slug } = body as { action?: unknown; slug?: unknown }
  const repository = createPublicationRepository()
  try {
    if (action === 'availability' && typeof slug === 'string') return { status: 200, body: await checkSlugAvailability(user.id, slug, repository) }
    if (action === 'save-slug' && typeof slug === 'string') return { status: 200, body: { profile: await updateProfileSlug(user.id, slug, repository) } }
    if (action === 'publish' && typeof slug === 'string') {
      const profile = await publishProfile(user.id, slug, repository)
      return { status: 200, body: { profile, publicUrl: `/${profile.slug}` } }
    }
    if (action === 'unpublish') return { status: 200, body: { profile: await unpublishProfile(user.id, repository) } }
    return { status: 400, body: { error: 'Unsupported publication action.' } }
  } catch (error) {
    if (error instanceof PublicationError) return { status: error.code === 'not_found' ? 404 : error.code === 'unavailable' ? 409 : 400, body: { error: error.message } }
    if ((error as { code?: string })?.code === '23505') return { status: 409, body: { error: 'This URL is already taken.' } }
    throw error
  }
}
