import { createServer } from 'node:http'
import { answerPortfolioQuestion } from '../src/rag/answerQuestion.ts'
import { RAG_CONFIG } from '../src/rag/config.ts'
import { mapResumeOnServer, ResumeMappingInputError, ResumeMappingOutputError } from '../src/onboarding/server/service.ts'
import { ONBOARDING_MAPPING_CONFIG } from '../src/onboarding/config.ts'

const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174')
    .split(',').map((origin) => origin.trim()).filter(Boolean),
)

const baseCorsHeaders = {
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

console.info('Local onboarding mapper configuration', {
  apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
  onboardingEnabled: process.env.ONBOARDING_LLM_ENABLED,
  model: ONBOARDING_MAPPING_CONFIG.model,
})

createServer(async (request, response) => {
  const send = (status: number, body: unknown) => {
    const origin = request.headers.origin
    const corsHeaders = origin && allowedOrigins.has(origin)
      ? { ...baseCorsHeaders, 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
      : baseCorsHeaders
    response.writeHead(status, corsHeaders)
    response.end(JSON.stringify(body))
  }

  if (request.method === 'OPTIONS') return send(204, null)
  if (request.method !== 'POST') return send(404, { error: 'Not found' })

  try {
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(chunk)
    const body = JSON.parse(Buffer.concat(chunks).toString()) as { message?: unknown; text?: unknown; sourceType?: unknown }
    if (request.url === '/api/onboarding/map-resume') {
      try {
        const parsedResume = await mapResumeOnServer(
          { text: body.text, sourceType: body.sourceType },
          { diagnostic: (event, details) => console.info('Local onboarding provider diagnostic', { event, ...details }) },
        )
        console.info('Local onboarding mapping response', { mapper: 'llm', status: 200 })
        return send(200, { parsedResume, mapper: 'llm' })
      } catch (error) {
        const category = error instanceof ResumeMappingInputError ? 'input_validation' : error instanceof ResumeMappingOutputError ? 'output_validation' : 'provider'
        const status = error instanceof ResumeMappingInputError ? 400 : 503
        console.error('Local onboarding mapping failed', { mapper: 'llm', category, fallback: 'client_deterministic', status })
        return send(status, { error: error instanceof ResumeMappingInputError ? error.message : 'AI-assisted resume mapping is unavailable', category })
      }
    }
    if (request.url !== '/api/chat') return send(404, { error: 'Not found' })
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    if (!message) return send(400, { error: 'Message cannot be empty' })
    if (message.length > RAG_CONFIG.maximumQuestionLength) {
      return send(400, { error: `Message must be ${RAG_CONFIG.maximumQuestionLength} characters or fewer` })
    }
    send(200, await answerPortfolioQuestion(message))
  } catch (error) {
    console.error('Local portfolio API request failed', error instanceof SyntaxError ? 'Invalid JSON' : 'Request failed')
    send(error instanceof SyntaxError ? 400 : 500, {
      error: error instanceof SyntaxError ? 'Request body must be valid JSON' : 'Unable to answer the question right now',
    })
  }
}).listen(3001, '127.0.0.1', () => console.log('Local portfolio API listening on http://localhost:3001'))
