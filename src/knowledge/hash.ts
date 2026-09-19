import { createHash } from 'node:crypto'

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalize(item)]),
    )
  }
  return typeof value === 'string' ? value.replace(/\r\n?/g, '\n').trim() : value
}

export function stableSerialize(value: unknown): string {
  return JSON.stringify(normalize(value))
}

export function contentHash(value: unknown): string {
  return createHash('sha256').update(stableSerialize(value)).digest('hex')
}
