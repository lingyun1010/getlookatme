import { friendlyAuthError, sendPasswordReset, signIn, signInWithOAuth, signUp, updatePassword, type SocialAuthProvider } from './authActions.ts'
import './socialAuth.css'

export type AuthFormMode = 'sign-in' | 'sign-up' | 'forgot' | 'reset' | 'confirmation'

type Options = {
  initialMode: AuthFormMode
  onAuthenticated: () => void
  oauthRedirectUrl?: string
  recoveryRedirectUrl?: string
  onModeChange?: (mode: AuthFormMode) => void
}

const socialProviders: Array<{ provider: SocialAuthProvider; label: string; mark: string }> = [
  { provider: 'google', label: 'Continue with Google', mark: 'G' },
  { provider: 'linkedin_oidc', label: 'Continue with LinkedIn', mark: 'in' },
  { provider: 'github', label: 'Continue with GitHub', mark: 'GH' },
]

const node = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => {
  const element = document.createElement(tag)
  element.className = cls
  element.textContent = text
  return element
}

export class AuthForm {
  private mode: AuthFormMode
  private busy = false

  constructor(private host: HTMLElement, private options: Options) {
    this.mode = options.initialMode
    this.render()
  }

  setMode(mode: AuthFormMode) {
    this.mode = mode
    this.options.onModeChange?.(mode)
    this.render()
  }

  focus() {
    this.host.querySelector<HTMLElement>('input,button')?.focus()
  }

  private message(text: string, kind = 'error') {
    const element = this.host.querySelector<HTMLElement>('[data-status]')!
    element.textContent = text
    element.dataset.kind = kind
    element.hidden = false
  }

  private loading(value: boolean) {
    this.busy = value
    this.host.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input,button').forEach((element) => { element.disabled = value })
    const submit = this.host.querySelector<HTMLButtonElement>('[data-submit]')
    if (submit) submit.textContent = value ? 'Please wait…' : submit.dataset.label!
  }

  private field(name: string, labelText: string, type: string, autocomplete: HTMLInputElement['autocomplete']) {
    const label = node('label', 'auth-field')
    const span = node('span', '', labelText)
    const input = node('input')
    input.name = name
    input.type = type
    input.autocomplete = autocomplete
    input.required = true
    if (type === 'password') input.minLength = 8
    label.append(span, input)
    return label
  }

  private switch(copy: string, action: string, mode: AuthFormMode) {
    const paragraph = node('p', 'auth-switch', `${copy} `)
    const button = node('button', 'auth-link', action)
    button.type = 'button'
    button.onclick = () => this.setMode(mode)
    paragraph.append(button)
    return paragraph
  }

  private socialLogin() {
    const group = node('div', 'auth-social')
    group.setAttribute('aria-label', 'Social sign in options')
    socialProviders.forEach(({ provider, label, mark }) => {
      const button = node('button', 'auth-social-button')
      button.type = 'button'
      button.dataset.provider = provider
      const icon = node('span', 'auth-social-mark', mark)
      icon.setAttribute('aria-hidden', 'true')
      button.append(icon, document.createTextNode(label))
      button.onclick = () => { void this.oauth(provider) }
      group.append(button)
    })
    return group
  }

  private async oauth(provider: SocialAuthProvider) {
    if (this.busy) return
    this.loading(true)
    try {
      const redirectTo = this.options.oauthRedirectUrl ?? `${location.origin}/login?next=${encodeURIComponent('/dashboard')}`
      const { error } = await signInWithOAuth(provider, redirectTo)
      if (error) throw error
    } catch (error) {
      this.message(friendlyAuthError(error))
      this.loading(false)
    }
  }

  private async submit(event: SubmitEvent) {
    event.preventDefault()
    if (this.busy) return
    const data = new FormData(event.currentTarget as HTMLFormElement)
    const email = String(data.get('email') ?? '').trim()
    const password = String(data.get('password') ?? '')
    const confirm = String(data.get('confirm') ?? '')
    if (this.mode !== 'reset' && (!email || !email.includes('@'))) return this.message('Enter a valid email address.')
    if (this.mode !== 'forgot' && password.length < 8) return this.message('Password must be at least 8 characters.')
    if (['sign-up', 'reset'].includes(this.mode) && password !== confirm) return this.message('The passwords do not match.')
    this.loading(true)
    try {
      if (this.mode === 'sign-in') {
        const { data: result, error } = await signIn(email, password)
        if (error) throw error
        if (!result.session) throw Error()
        this.options.onAuthenticated()
      } else if (this.mode === 'sign-up') {
        const { data: result, error } = await signUp(email, password)
        if (error) throw error
        result.session ? this.options.onAuthenticated() : this.setMode('confirmation')
      } else if (this.mode === 'forgot') {
        const { error } = await sendPasswordReset(email, this.options.recoveryRedirectUrl ?? `${location.origin}/login?recovery=1`)
        if (error) throw error
        this.message('Check your inbox for a secure password-reset link.', 'success')
      } else if (this.mode === 'reset') {
        const { error } = await updatePassword(password)
        if (error) throw error
        this.message('Password updated. Taking you to your profile…', 'success')
        setTimeout(this.options.onAuthenticated, 600)
      }
    } catch (error) {
      this.message(friendlyAuthError(error))
    } finally {
      this.loading(false)
    }
  }

  private render() {
    this.host.replaceChildren()
    const wrap = node('div', 'auth-form-component')
    const kicker = node('p', 'auth-kicker', this.mode === 'sign-up' ? 'Start your profile' : 'Welcome to GetLookAtMe')
    const title = node('h1', 'auth-title')
    const lede = node('p', 'auth-lede')

    if (this.mode === 'confirmation') {
      title.textContent = 'Check your inbox'
      lede.textContent = 'Open the confirmation email from GetLookAtMe, then return here to sign in.'
      const back = node('button', 'auth-primary', 'Back to sign in')
      back.onclick = () => this.setMode('sign-in')
      wrap.append(kicker, title, lede, back)
      this.host.append(wrap)
      return
    }

    title.textContent = this.mode === 'sign-up' ? 'Create your account' : this.mode === 'forgot' ? 'Reset your password' : this.mode === 'reset' ? 'Choose a new password' : 'Sign in to your profile'
    lede.textContent = this.mode === 'sign-up' ? 'Build an AI profile recruiters can actually talk to.' : this.mode === 'forgot' ? 'Enter your email and we’ll send a secure reset link.' : this.mode === 'reset' ? 'Use at least 8 characters for your new password.' : 'Continue building and sharing your interactive profile.'

    const form = node('form', 'auth-form')
    if (this.mode !== 'reset') form.append(this.field('email', 'Email address', 'email', 'email'))
    if (this.mode !== 'forgot') form.append(this.field('password', this.mode === 'reset' ? 'New password' : 'Password', 'password', this.mode === 'sign-in' ? 'current-password' : 'new-password'))
    if (['sign-up', 'reset'].includes(this.mode)) form.append(this.field('confirm', 'Confirm password', 'password', 'new-password'))
    if (this.mode === 'sign-in') {
      const forgot = node('button', 'auth-forgot', 'Forgot password?')
      forgot.type = 'button'
      forgot.onclick = () => this.setMode('forgot')
      form.append(forgot)
    }
    const status = node('p', 'auth-status')
    status.dataset.status = ''
    status.hidden = true
    status.setAttribute('role', 'status')
    status.setAttribute('aria-live', 'polite')
    const label = this.mode === 'sign-up' ? 'Create account' : this.mode === 'forgot' ? 'Send reset link' : this.mode === 'reset' ? 'Update password' : 'Sign in'
    const submit = node('button', 'auth-primary', label)
    submit.type = 'submit'
    submit.dataset.submit = ''
    submit.dataset.label = label
    form.append(status, submit)
    form.onsubmit = (event) => { void this.submit(event as SubmitEvent) }

    wrap.append(kicker, title, lede)
    if (this.mode === 'sign-in' || this.mode === 'sign-up') {
      wrap.append(this.socialLogin(), node('div', 'auth-divider', 'or continue with email'))
    }
    wrap.append(form)
    if (this.mode === 'sign-in') wrap.append(this.switch('New to GetLookAtMe?', 'Create an account', 'sign-up'))
    if (this.mode === 'sign-up') wrap.append(this.switch('Already have an account?', 'Sign in', 'sign-in'))
    if (this.mode === 'forgot') wrap.append(this.switch('Remembered your password?', 'Back to sign in', 'sign-in'))
    this.host.append(wrap)
  }
}
