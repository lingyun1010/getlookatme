import { createLookAtMeAvatar } from 'lookatme-avatar/vanilla'
import { lingyunAvatar } from '../avatar/lingyun.ts'
import { currentUser } from '../auth/session.ts'
import { isSupabaseConfigured } from '../auth/supabase.ts'
import { AuthModal } from '../auth/AuthModal.ts'
import '../auth/auth.css'

const avatarHost = document.querySelector<HTMLElement>('#heroAvatar')
if (avatarHost) {
  createLookAtMeAvatar({
    container: avatarHost,
    frames: { version: 2, center: lingyunAvatar.centerFrame, directions: [...lingyunAvatar.directionalFrames] },
    alt: lingyunAvatar.alt,
    deadZone: lingyunAvatar.centerDeadZone,
    objectFit: 'contain',
    tracking: 'viewport',
  })
}

const authModal = new AuthModal(() => window.location.assign('/dashboard/create'))
async function bindAuth(): Promise<void> {
  const user = isSupabaseConfigured ? await currentUser() : null
  document.querySelectorAll<HTMLAnchorElement>('[data-auth-mode]').forEach(link => link.addEventListener('click', event => {
    if (user) { event.preventDefault(); window.location.assign('/dashboard/create'); return }
    if (!isSupabaseConfigured) return
    event.preventDefault(); authModal.open(link.dataset.authMode === 'sign-up' ? 'sign-up' : 'sign-in', link)
  }))
}
void bindAuth()

const menuButton = document.querySelector<HTMLButtonElement>('.menu-button')
const navigation = document.querySelector<HTMLElement>('.site-header nav')
menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true'
  menuButton.setAttribute('aria-expanded', String(open))
  navigation?.classList.toggle('open', open)
})

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => { if (entry.isIntersecting) entry.target.classList.add('is-visible') })
}, { threshold: 0.12 })
document.querySelectorAll('.reveal, .steps li, .value-grid article, .profile-preview, .testimonial-grid figure').forEach((element) => observer.observe(element))
