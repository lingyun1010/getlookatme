import { KNOWLEDGE_CONFIG } from './config.ts'
import { contentHash } from './hash.ts'
import type { BuiltKnowledgeChunk, BuiltKnowledgeSource } from './types.ts'

export interface ChunkOptions { maximumCharacters?: number; overlapCharacters?: number }

function splitLongBlock(block: string, maximum: number, overlap: number): string[] {
  const pieces: string[] = []
  let start = 0
  while (start < block.length) {
    let end = Math.min(start + maximum, block.length)
    if (end < block.length) {
      const boundary = Math.max(block.lastIndexOf('\n', end), block.lastIndexOf(' ', end))
      if (boundary > start + maximum / 2) end = boundary
    }
    pieces.push(block.slice(start, end).trim())
    if (end === block.length) break
    start = Math.max(end - overlap, start + 1)
  }
  return pieces.filter(Boolean)
}

export function chunkKnowledgeSource(source: BuiltKnowledgeSource, options: ChunkOptions = {}): BuiltKnowledgeChunk[] {
  const maximum = options.maximumCharacters ?? KNOWLEDGE_CONFIG.maximumChunkCharacters
  const overlap = Math.min(options.overlapCharacters ?? KNOWLEDGE_CONFIG.chunkOverlapCharacters, Math.floor(maximum / 3))
  if (maximum < 100) throw new Error('Knowledge chunk size must be at least 100 characters.')
  const contents = source.content.length <= maximum ? [source.content] : splitLongBlock(source.content, maximum, overlap)
  return contents.map((content, chunkIndex) => ({
    chunkIndex,
    content,
    metadata: { ...source.metadata, chunkIndex },
    contentHash: contentHash({ content, metadata: source.metadata, chunkIndex }),
  }))
}
