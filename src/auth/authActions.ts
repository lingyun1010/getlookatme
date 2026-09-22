import { requireSupabase } from './supabase.ts'

export function safeAuthRedirect(value: string | null | undefined, fallback = '/dashboard', origin = globalThis.location?.origin ?? 'http://localhost'): string {
  if (!value?.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback
  try { const url = new URL(value, origin); return url.origin === origin ? `${url.pathname}${url.search}${url.hash}` : fallback } catch { return fallback }
}
export function authRedirectFromLocation(): string { const p = new URLSearchParams(location.search); return safeAuthRedirect(p.get('redirect') ?? p.get('next')) }
export function friendlyAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (message.includes('invalid login credentials')) return 'That email or password doesn’t look right. Please try again.'
  if (message.includes('email not confirmed')) return 'Please confirm your email before signing in.'
  if (message.includes('already registered')) return 'An account with this email already exists. Try signing in instead.'
  if (message.includes('rate') || message.includes('too many')) return 'Too many attempts. Please wait a moment and try again.'
  if (message.includes('fetch') || message.includes('network')) return 'We couldn’t reach the sign-in service. Check your connection and try again.'
  return 'Something went wrong. Please try again.'
}
export const signIn = (email: string, password: string) => requireSupabase().auth.signInWithPassword({ email, password })
export const signUp = (email: string, password: string) => requireSupabase().auth.signUp({ email, password })
export const sendPasswordReset = (email: string, redirectTo: string) => requireSupabase().auth.resetPasswordForEmail(email, { redirectTo })
export const updatePassword = (password: string) => requireSupabase().auth.updateUser({ password })
