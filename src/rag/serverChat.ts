import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { authenticateBearer } from '../auth/server.ts'
import { OpenAIEmbeddingClient } from '../knowledge/embeddings.ts'
import { SupabaseKnowledgeRepository } from '../knowledge/repository.ts'
import type { ProfileDocument } from '../profile/types.ts'
import { ProfileChatService, type ChatTargetProfile } from './chatService.ts'
import { generateGroundedAnswer } from './profileAnswer.ts'

function serviceRoleClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Profile chat requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}

export function createServerChatService(): ProfileChatService {
  const client = serviceRoleClient()
  return new ProfileChatService({
    authenticate: authenticateBearer,
    resolveProfile: async (slug): Promise<ChatTargetProfile | null> => {
      const { data, error } = await client.from('profiles')
        .select('id,user_id,slug,is_published,document').eq('slug', slug).maybeSingle()
      if (error) throw error
      if (!data) return null
      const document = data.document as ProfileDocument
      if (!document?.profileId || document.profileId !== data.id) throw new Error('Profile document identity is invalid.')
      return { id: data.id, userId: data.user_id, slug: data.slug, isPublished: data.is_published, document }
    },
    embeddings: { embedText: (input) => new OpenAIEmbeddingClient().embedText(input) },
    knowledge: new SupabaseKnowledgeRepository(client),
    generateAnswer: generateGroundedAnswer,
  })
}
