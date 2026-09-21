import OpenAI from 'openai'
import type { KnowledgeSearchResult } from '../knowledge/types.ts'
import type { ProfileDocument } from '../profile/types.ts'
import { RAG_CONFIG } from './config.ts'
import { buildProfileGroundedPrompt, profileSystemPrompt } from './profilePrompt.ts'
import type { ChatHistoryMessage, PortfolioAnswer, PortfolioAnswerEvidence } from './types.ts'

export const NO_ANSWER: Readonly<PortfolioAnswer> = Object.freeze({
  answer: "This profile doesn't contain enough information to answer that confidently.",
  evidence: [], sources: [], relatedIds: [], confidence: 'low', noAnswer: true,
})

export interface GeneratedGroundedAnswer { answer: string; evidenceIds: string[] }
export type GroundedAnswerGenerator = (
  question: string, profile: ProfileDocument, results: KnowledgeSearchResult[], history?: ChatHistoryMessage[],
) => Promise<GeneratedGroundedAnswer>

export const generateGroundedAnswer: GroundedAnswerGenerator = async (question, profile, results, history = []) => {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required')
  const response = await new OpenAI({ apiKey: process.env.OPENAI_API_KEY }).responses.create({
    model: RAG_CONFIG.answerModel,
    instructions: profileSystemPrompt(profile.identity.fullName),
    input: buildProfileGroundedPrompt(question, results, history),
    text: { format: { type: 'json_schema', name: 'profile_answer', strict: true, schema: {
      type: 'object',
      properties: { answer: { type: 'string' }, evidenceIds: { type: 'array', items: { type: 'string' } } },
      required: ['answer', 'evidenceIds'], additionalProperties: false,
    } } },
  })
  return JSON.parse(response.output_text) as GeneratedGroundedAnswer
}

const confidenceFor = (results: KnowledgeSearchResult[]): PortfolioAnswer['confidence'] =>
  (results[0]?.similarity ?? 0) >= 0.65 ? 'high' : results.length >= 2 ? 'medium' : 'low'

export async function answerProfileQuestion(
  question: string,
  profile: ProfileDocument,
  results: KnowledgeSearchResult[],
  generate: GroundedAnswerGenerator = generateGroundedAnswer,
  history: ChatHistoryMessage[] = [],
): Promise<PortfolioAnswer> {
  if (!results.length) return structuredClone(NO_ANSWER)
  const generated = await generate(question, profile, results, history)
  const allowed = new Map(results.map((result) => [result.chunkId, result]))
  const selectedIds = [...new Set(generated.evidenceIds)].filter((id) => allowed.has(id))
  if (!selectedIds.length) return structuredClone(NO_ANSWER)
  const evidence: PortfolioAnswerEvidence[] = selectedIds.map((id) => {
    const result = allowed.get(id)!
    return {
      chunkId: result.chunkId, sourceId: result.sourceId, sourceType: result.sourceType,
      sourceRef: result.sourceRef, section: result.section, title: result.title,
      metadata: { ...result.metadata },
    }
  })
  return {
    answer: generated.answer,
    evidence,
    sources: evidence.map((item) => ({ id: item.chunkId, type: item.sourceType, title: item.title ?? item.section })),
    relatedIds: [...new Set(evidence.map(({ sourceRef }) => sourceRef))],
    confidence: confidenceFor(results),
    noAnswer: false,
  }
}
