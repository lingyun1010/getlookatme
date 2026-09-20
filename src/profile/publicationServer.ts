import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { ProfileDocument } from './types.ts'
import type { PublicationProfile, PublicationRepository } from './publication.ts'

function serverClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Profile publication requires Supabase server configuration.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}

const mapped = (row: Record<string, unknown>): PublicationProfile => ({
  id: row.id as string, userId: row.user_id as string, slug: row.slug as string,
  document: row.document as ProfileDocument, isPublished: row.is_published as boolean,
})

export class SupabasePublicationRepository implements PublicationRepository {
  private readonly client: SupabaseClient
  constructor(client: SupabaseClient) { this.client = client }
  async findOwnedProfile(userId: string) {
    const { data, error } = await this.client.from('profiles').select('id,user_id,slug,document,is_published').eq('user_id', userId).order('created_at').limit(1).maybeSingle()
    if (error) throw error
    return data ? mapped(data) : null
  }
  async findProfileIdBySlug(slug: string) {
    const { data, error } = await this.client.from('profiles').select('id').eq('slug', slug).maybeSingle()
    if (error) throw error
    return data?.id ?? null
  }
  async updateProfile(profileId: string, userId: string, values: { slug?: string; document?: ProfileDocument; isPublished?: boolean }) {
    const update: Record<string, unknown> = {}
    if (values.slug !== undefined) update.slug = values.slug
    if (values.document !== undefined) update.document = values.document
    if (values.isPublished !== undefined) update.is_published = values.isPublished
    const { data, error } = await this.client.from('profiles').update(update).eq('id', profileId).eq('user_id', userId).select('id,user_id,slug,document,is_published').single()
    if (error?.code === '23505') throw Object.assign(new Error('This URL is already taken.'), { code: '23505' })
    if (error) throw error
    return mapped(data)
  }
}

export const createPublicationRepository = () => new SupabasePublicationRepository(serverClient())
