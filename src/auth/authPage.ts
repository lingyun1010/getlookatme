import { AuthForm, type AuthFormMode } from './AuthForm.ts'
import { authRedirectFromLocation } from './authActions.ts'
import { requireSupabase } from './supabase.ts'

const destination = authRedirectFromLocation()
const params = new URLSearchParams(location.search)
let mode: AuthFormMode = location.pathname === '/signup' ? 'sign-up' : params.get('recovery') === '1' ? 'reset' : 'sign-in'
const oauthCallback = `${location.origin}/login?next=${encodeURIComponent(destination)}`

const form = new AuthForm(document.querySelector<HTMLElement>('#authFormRoot')!, {
  initialMode: mode,
  onAuthenticated: () => location.assign(destination),
  onModeChange: (next) => { mode = next },
  oauthRedirectUrl: oauthCallback,
  recoveryRedirectUrl: `${location.origin}/login?recovery=1&redirect=${encodeURIComponent(destination)}`,
})

requireSupabase().auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') form.setMode('reset')
})

requireSupabase().auth.getSession().then(({ data }) => {
  if (data.session && mode !== 'reset') location.replace(destination)
}).catch(() => undefined)
