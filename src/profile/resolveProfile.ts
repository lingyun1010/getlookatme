import { profileRegistry } from './registry.ts'
import type { ProfileDocument } from './types.ts'

export function profileSlugFromPath(pathnameOrSlug: string): string {
  return pathnameOrSlug.split('/').filter(Boolean)[0] ?? 'lingyun'
}

export function resolveProfile(pathnameOrSlug: string): ProfileDocument | null {
  return profileRegistry.get(profileSlugFromPath(pathnameOrSlug)) ?? null
}
