import { requireSupabase } from './supabase.ts'

const form = document.querySelector<HTMLFormElement>('#authForm')!
const email = document.querySelector<HTMLInputElement>('#email')!
const password = document.querySelector<HTMLInputElement>('#password')!
const status = document.querySelector<HTMLElement>('#authStatus')!
const signInButton = document.querySelector<HTMLButtonElement>('#signInButton')!
const signUpButton = document.querySelector<HTMLButtonElement>('#signUpButton')!

function destination(): string {
  const value = new URLSearchParams(window.location.search).get('next')
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/create'
}

function show(message: string, isError = false): void {
  status.textContent = message
  status.classList.toggle('error', isError)
  status.hidden = false
}

async function authenticate(mode: 'sign-in' | 'sign-up'): Promise<void> {
  const client = requireSupabase()
  signInButton.disabled = true
  signUpButton.disabled = true
  try {
    const credentials = { email: email.value.trim(), password: password.value }
    const result = mode === 'sign-up'
      ? await client.auth.signUp(credentials)
      : await client.auth.signInWithPassword(credentials)
    if (result.error) throw result.error
    if (!result.data.session) {
      show('Check your email to confirm your account, then sign in.')
      return
    }
    window.location.assign(destination())
  } catch (error) {
    show(error instanceof Error ? error.message : 'Authentication failed.', true)
  } finally {
    signInButton.disabled = false
    signUpButton.disabled = false
  }
}

form.addEventListener('submit', (event) => { event.preventDefault(); void authenticate('sign-in') })
signUpButton.addEventListener('click', () => { void authenticate('sign-up') })

requireSupabase().auth.getSession().then(({ data }) => {
  if (data.session) window.location.replace(destination())
}).catch((error: unknown) => show(error instanceof Error ? error.message : 'Unable to restore the session.', true))
