export const RESERVED_PROFILE_SLUGS = new Set([
  'api', 'auth', 'create', 'dashboard', 'edit', 'login', 'preview', 'settings', 'signup',
  'lingyun', 'aaron',
])

export const PROFILE_SLUG_MIN_LENGTH = 3
export const PROFILE_SLUG_MAX_LENGTH = 63

export function normalizeProfileSlug(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-')
}

export function validateProfileSlug(input: string): { valid: true; slug: string } | { valid: false; error: string } {
  const slug = normalizeProfileSlug(input)
  if (!slug) return { valid: false, error: 'Enter a public profile URL.' }
  if (slug.length < PROFILE_SLUG_MIN_LENGTH || slug.length > PROFILE_SLUG_MAX_LENGTH) {
    return { valid: false, error: `Use between ${PROFILE_SLUG_MIN_LENGTH} and ${PROFILE_SLUG_MAX_LENGTH} characters.` }
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { valid: false, error: 'Use lowercase letters, numbers, and single hyphens only.' }
  }
  if (RESERVED_PROFILE_SLUGS.has(slug)) return { valid: false, error: 'This URL is reserved by GetLookAtMe.' }
  return { valid: true, slug }
}
