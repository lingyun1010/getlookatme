import { createLookAtMeAvatar } from 'lookatme-avatar/vanilla'
import { lingyunAvatar } from '../avatar/lingyun.ts'
import { currentUser } from '../auth/session.ts'
import { isSupabaseConfigured } from '../auth/supabase.ts'
import { AuthModal } from '../auth/AuthModal.ts'
import { formatPlanPrice, PLAN_CONFIG, PUBLIC_PLAN_IDS } from '../monetisation/plans.ts'
import { trackFunnelEvent } from '../analytics/client.ts'
import '../auth/auth.css'

const pricingPlans = document.querySelector<HTMLElement>('#pricingPlans')
if (pricingPlans) {
  pricingPlans.replaceChildren(...PUBLIC_PLAN_IDS.map((planId) => {
    const plan = PLAN_CONFIG[planId]
    const article = document.createElement('article')
    if (planId === 'pro') article.classList.add('featured-plan')
    const suffix = plan.price?.amount ? ` <small>/${plan.price.interval}</small>` : ''
    article.innerHTML = `
      ${planId === 'pro' ? '<span class="plan-label">More capacity</span>' : ''}
      <h3>${plan.name}</h3>
      <p class="plan-price">${formatPlanPrice(plan)}${suffix}</p>
      <p class="plan-description">${plan.description}</p>
      <ul>${plan.highlights.map((highlight) => `<li>${highlight}</li>`).join('')}</ul>
      <a class="button auth-cta" data-auth-mode="sign-up" href="/signup">Create my profile</a>
    `
    return article
  }))
}

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
document.querySelectorAll<HTMLAnchorElement>('[data-auth-mode="sign-up"]').forEach((link) => {
  link.addEventListener('click', () => { void trackFunnelEvent('create_profile_clicked') })
})
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
document.querySelectorAll('.reveal, .steps li, .value-grid article, .profile-preview, .pricing-grid article').forEach((element) => observer.observe(element))
