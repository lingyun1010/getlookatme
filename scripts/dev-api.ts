import { statSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AvatarFramePreset, AvatarStyleId } from 'lookatme-avatar'
import {
  LocalAvatarImageStorage,
  OpenAIImageGenerationProvider,
  PhotoAIFrameProducer,
  SharpGeneratedImageValidator,
} from 'lookatme-avatar/server'
import { RAG_CONFIG } from '../src/rag/config.ts'
import { InvalidAuthenticationError, ProfileAccessError } from '../src/rag/chatService.ts'
import { createServerChatService } from '../src/rag/serverChat.ts'
import { mapResumeOnServer, ResumeMappingInputError, ResumeMappingOutputError } from '../src/onboarding/server/service.ts'
import { ONBOARDING_MAPPING_CONFIG } from '../src/onboarding/config.ts'
import { authenticateBearer, createAuthenticatedServerClient } from '../src/auth/server.ts'
import { isAvatarPreset } from '../src/avatar/types.ts'
import { isOwnedAssetPath } from '../src/profile/repository.ts'
import { processNextAvatarJob } from '../src/avatar/worker.ts'
import { handlePublicationRequest } from '../src/profile/publicationRequest.ts'

const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174')
    .split(',').map((origin) => origin.trim()).filter(Boolean),
)

const LOOKATME_STORAGE_DIR = fileURLToPath(new URL('../tmp/lookatme-avatar-generated', import.meta.url))
const LOOKATME_STORAGE_BASE = '/generated/lookatme'

const baseCorsHeaders = {
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
}

function buildDemoAvatarFrameSet() {
  const withSvg = (label: string, fill: string, accent: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect width="200" height="200" rx="30" fill="${fill}"/>
      <circle cx="100" cy="82" r="42" fill="#f8fafc"/>
      <circle cx="84" cy="74" r="5" fill="${accent}"/>
      <circle cx="116" cy="74" r="5" fill="${accent}"/>
      <path d="M80 100 Q100 118 120 100" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round"/>
      <text x="100" y="170" text-anchor="middle" font-size="18" fill="${accent}" font-family="sans-serif" font-weight="700">${label}</text>
    </svg>
  `)}`

  return {
    version: 2,
    center: { key: 'center', src: withSvg('center', '#1f2937', '#7dd3fc') },
    directions: [
      { key: 'left', angle: 180, src: withSvg('left', '#111827', '#f9a8d4') },
      { key: 'right', angle: 0, src: withSvg('right', '#111827', '#fcd34d') },
      { key: 'up', angle: 270, src: withSvg('up', '#111827', '#86efac') },
      { key: 'down', angle: 90, src: withSvg('down', '#111827', '#c4b5fd') },
    ],
    metadata: { source: { type: 'manual' } },
  }
}

function parseMultipartFormData(body: Buffer, contentType: string) {
  const match = contentType.match(/boundary=(?:(?:"([^"]+)")|([^;]+))/i)
  const boundary = match ? (match[1] ?? match[2]).trim() : null
  if (!boundary) {
    return { fields: {}, files: [] as Array<{ name: string; filename: string; mimeType: string; buffer: Buffer }> }
  }

  const delimiter = `--${boundary}`
  const parts = body.toString('binary').split(delimiter)
  const files: Array<{ name: string; filename: string; mimeType: string; buffer: Buffer }> = []
  const fields: Record<string, string> = {}

  for (const part of parts) {
    const trimmed = part.replace(/^\r\n/, '').replace(/\r\n$/, '')
    if (!trimmed || trimmed === '--') continue

    const segments = trimmed.split('\r\n\r\n')
    if (segments.length < 2) continue

    const headerBlock = segments[0]
    const content = Buffer.from(segments.slice(1).join('\r\n\r\n'), 'binary')
    const disposition = headerBlock.match(/Content-Disposition: form-data; name="([^"]+)"(?:; filename="([^"]*)")?/i)
    if (!disposition) continue

    const name = disposition[1]
    const fileName = disposition[2]
    if (fileName) {
      const mimeType = headerBlock.match(/Content-Type:\s*([^\r\n]+)/i)?.[1]?.trim() ?? 'application/octet-stream'
      files.push({ name, filename: fileName, mimeType, buffer: content })
      continue
    }

    fields[name] = content.toString('utf8').replace(/\r\n$/, '')
  }

  return { fields, files }
}

function createPhotoProducer() {
  return new PhotoAIFrameProducer({
    provider: new OpenAIImageGenerationProvider({ apiKey: process.env.OPENAI_API_KEY }),
    storage: new LocalAvatarImageStorage(LOOKATME_STORAGE_DIR, LOOKATME_STORAGE_BASE),
    validator: new SharpGeneratedImageValidator(),
  })
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

  const url = request.url ?? '/'

  if (request.method === 'OPTIONS') return send(204, null)

  if (request.method === 'GET' && url.startsWith('/generated/lookatme/')) {
    const relativePath = decodeURIComponent(url.replace('/generated/lookatme/', ''))
    const safePath = resolve(LOOKATME_STORAGE_DIR, relativePath)
    if (!safePath.startsWith(LOOKATME_STORAGE_DIR)) return send(403, { error: 'Invalid storage path' })
    try {
      const file = readFileSync(safePath)
      const extension = extname(safePath).toLowerCase()
      const mimeType = extension === '.png' ? 'image/png' : extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg' : 'application/octet-stream'
      response.writeHead(200, { 'Content-Type': mimeType })
      response.end(file)
      return
    } catch {
      return send(404, { error: 'Generated avatar asset was not found' })
    }
  }

  if (request.method === 'GET' && url === '/api/lookatme/health') {
    return send(200, {
      ok: true,
      openAiConfigured: Boolean(process.env.OPENAI_API_KEY),
      storageBase: LOOKATME_STORAGE_BASE,
      storageDir: LOOKATME_STORAGE_DIR,
      browserServerSeparation: 'Frontend uses lookatme-avatar/react; generation stays in getlookatme server code via lookatme-avatar/server.',
      requiresManualConfirmation: true,
    })
  }

  if (request.method !== 'POST') return send(404, { error: 'Not found' })

  try {
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(chunk)
    const requestBody = Buffer.concat(chunks)

    if (request.url === '/api/onboarding/map-resume') {
      if (!await authenticateBearer(request.headers.authorization)) return send(401, { error: 'Authentication required' })
      const body = JSON.parse(requestBody.toString()) as { message?: unknown; text?: unknown; sourceType?: unknown }
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

    if (request.url === '/api/chat') {
      const body = JSON.parse(requestBody.toString()) as { message?: unknown; profileSlug?: unknown }
      const message = typeof body.message === 'string' ? body.message.trim() : ''
      const profileSlug = typeof body.profileSlug === 'string' ? body.profileSlug.trim() : ''
      if (!message) return send(400, { error: 'Message cannot be empty' })
      if (!profileSlug) return send(400, { error: 'Profile slug cannot be empty' })
      if (message.length > RAG_CONFIG.maximumQuestionLength) {
        return send(400, { error: `Message must be ${RAG_CONFIG.maximumQuestionLength} characters or fewer` })
      }
      try {
        return send(200, await createServerChatService().ask(message, profileSlug, request.headers.authorization))
      } catch (error) {
        if (error instanceof InvalidAuthenticationError) return send(401, { error: 'Invalid authentication' })
        if (error instanceof ProfileAccessError) return send(404, { error: 'Profile not found' })
        throw error
      }
    }

    if (request.url === '/api/profile-publication') {
      const result = await handlePublicationRequest(request.headers.authorization, JSON.parse(requestBody.toString()))
      return send(result.status, result.body)
    }

    if (request.url === '/api/avatar-jobs') {
      const user = await authenticateBearer(request.headers.authorization)
      const client = createAuthenticatedServerClient(request.headers.authorization)
      if (!user || !client) return send(401, { error: 'Authentication required' })
      const body = JSON.parse(requestBody.toString()) as { profileId?: unknown; sourcePhotoPath?: unknown; style?: unknown; preset?: unknown }
      if (typeof body.profileId !== 'string' || typeof body.sourcePhotoPath !== 'string' || typeof body.style !== 'string' || !isAvatarPreset(body.preset)) return send(400, { error: 'Invalid avatar job request' })
      if (!isOwnedAssetPath(body.sourcePhotoPath, user.id, body.profileId)) return send(403, { error: 'Source photo is not owned by this profile' })
      const { data: job, error } = await client.from('avatar_generation_jobs').insert({ user_id: user.id, profile_id: body.profileId, source_photo_path: body.sourcePhotoPath, style: body.style, preset: body.preset }).select('*').single()
      if (error?.code === '23505') return send(409, { error: 'This profile already has a queued or generating avatar.' })
      return error ? send(400, { error: 'Could not queue avatar generation' }) : send(202, { job })
    }

    if (request.url === '/api/avatar-worker') {
      if (!process.env.CRON_SECRET || request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return send(401, { error: 'Worker authorization required' })
      return send(200, await processNextAvatarJob())
    }

    return send(404, { error: 'Not found' })
  } catch (error) {
    const isJsonError = error instanceof SyntaxError
    console.error('Local portfolio API request failed', isJsonError ? 'Invalid JSON' : 'Request failed')
    return send(isJsonError ? 400 : 500, {
      error: isJsonError ? 'Request body must be valid JSON or multipart/form-data' : 'Unable to process the request right now',
    })
  }
}).listen(3001, '127.0.0.1', () => console.log('Local portfolio API listening on http://localhost:3001'))
