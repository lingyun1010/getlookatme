import { createClient } from '@supabase/supabase-js'
import { OpenAIEmbeddingClient, SupabaseKnowledgeRepository, syncProfileKnowledge } from '../src/knowledge/index.ts'

function serverClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Knowledge tooling requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

const [command, profileId] = process.argv.slice(2)
if (!profileId || !['sync', 'inspect'].includes(command ?? '')) {
  throw new Error('Usage: pnpm knowledge:sync <profile-id> or pnpm knowledge:inspect <profile-id>')
}

const repository = new SupabaseKnowledgeRepository(serverClient())
if (command === 'inspect') {
  const status = await repository.getStatus(profileId)
  console.log(`Profile: ${status.profileId}`)
  console.log(`Sources: ${status.sourceCount}`)
  console.log(`Chunks: ${status.chunkCount}`)
  console.log(`Failed sources: ${status.failedSourceCount}`)
  console.log(`Last indexed: ${status.lastIndexedAt ?? 'never'}`)
} else {
  const result = await syncProfileKnowledge(profileId, repository, new OpenAIEmbeddingClient())
  console.log(`Profile: ${result.profileId}`)
  console.log(`Sources: ${result.sourceCount}`)
  console.log(`Chunks: ${result.chunkCount}`)
  console.log(`New: ${result.newSources}`)
  console.log(`Changed: ${result.changedSources}`)
  console.log(`Unchanged: ${result.unchangedSources}`)
  console.log(`Deleted: ${result.deletedSources}`)
  console.log(`Embeddings generated: ${result.embeddingsGenerated}`)
}
