import type { User } from '@supabase/supabase-js'
import type { EmbeddingClient, KnowledgeRepository, KnowledgeSearchResult } from '../knowledge/types.ts'
import type { ProfileDocument } from '../profile/types.ts'
import { RAG_CONFIG } from './config.ts'
import { answerProfileQuestion, type GroundedAnswerGenerator, NO_ANSWER } from './profileAnswer.ts'
import type { PortfolioAnswer } from './types.ts'

export interface ChatTargetProfile {
  id: string
  userId: string
  slug: string
  isPublished: boolean
  document: ProfileDocument
}

export interface ChatServiceDependencies {
  authenticate(authorization: string): Promise<User | null>
  resolveProfile(slug: string): Promise<ChatTargetProfile | null>
  embeddings: Pick<EmbeddingClient, 'embedText'>
  knowledge: Pick<KnowledgeRepository, 'search'>
  generateAnswer: GroundedAnswerGenerator
}

export class InvalidAuthenticationError extends Error {}
export class ProfileAccessError extends Error {}

export class ProfileChatService {
  private readonly dependencies: ChatServiceDependencies
  constructor(dependencies: ChatServiceDependencies) { this.dependencies = dependencies }

  async ask(message: string, profileSlug: string, authorization?: string): Promise<PortfolioAnswer> {
    const normalizedSlug = profileSlug.trim()
    const profile = normalizedSlug ? await this.dependencies.resolveProfile(normalizedSlug) : null
    if (!profile) throw new ProfileAccessError('Profile not found')

    let user: User | null = null
    if (authorization?.trim()) {
      user = await this.dependencies.authenticate(authorization)
      if (!user) throw new InvalidAuthenticationError('Invalid authentication')
    }
    if (!profile.isPublished && user?.id !== profile.userId) throw new ProfileAccessError('Profile not found')

    // No provider work occurs until target resolution and authorization are complete.
    const queryEmbedding = await this.dependencies.embeddings.embedText(message)
    const retrieved = await this.dependencies.knowledge.search(profile.id, queryEmbedding, RAG_CONFIG.profileSearchLimit)
    const results = retrieved.filter((result) => {
      if (result.profileId && result.profileId !== profile.id) return false
      return result.similarity >= RAG_CONFIG.minimumProfileSimilarity
    })
    if (!results.length) return structuredClone(NO_ANSWER)
    return answerProfileQuestion(message, profile.document, results, this.dependencies.generateAnswer)
  }
}
