import { currentUser } from '../auth/session.ts'
import { isSupabaseConfigured } from '../auth/supabase.ts'
import { AuthModal } from '../auth/AuthModal.ts'
import { trackFunnelEvent } from '../analytics/client.ts'
import { requestBilling } from '../billing/client.ts'
import { formatPlanPrice, PLAN_CONFIG, PUBLIC_PLAN_IDS } from '../monetisation/plans.ts'
import { mountPeopleShowcase } from './peopleShowcase.ts'
import { mountInteractiveDemo } from './interactiveDemo.ts'
import { mountStyleShowcase } from './styleShowcase.ts'
import { mountSupportingContent } from './supportingContent.ts'
import '../auth/auth.css'

const authModal = new AuthModal(() => window.location.assign('/dashboard/create'))
const proLoginRedirect = `/?checkout=pro#pricing`

function mountPricing(): void {
  const host = document.querySelector<HTMLElement>('#pricingPlans')
  if (!host) return
  host.replaceChildren(...PUBLIC_PLAN_IDS.map((planId) => {
    const plan = PLAN_CONFIG[planId]
    const article = document.createElement('article')
    if (planId === 'pro') article.classList.add('featured-plan')
    const suffix = plan.price?.amount ? ` <small>/${plan.price.interval}</small>` : ''
    const cta = planId === 'pro'
      ? `<a class="button" data-pro-checkout href="/login?redirect=${encodeURIComponent(proLoginRedirect)}">Upgrade to Pro →</a><p class="plan-feedback" data-plan-feedback role="status" aria-live="polite"></p>`
      : '<a class="button auth-cta" data-auth-mode="sign-up" href="/signup">Start free →</a>'
    article.innerHTML = `
      ${planId === 'pro' ? '<span class="plan-label">More capacity</span>' : ''}
      <h3>${plan.name}</h3>
      <p class="plan-price">${formatPlanPrice(plan)}${suffix}</p>
      <p class="plan-description">${plan.description}</p>
      <ul>${plan.highlights.map((highlight) => `<li>${highlight}</li>`).join('')}</ul>
      ${cta}`
    return article
  }))
}
mountPricing()

document.querySelectorAll<HTMLAnchorElement>('[data-auth-mode="sign-up"]').forEach((link) => {
  link.addEventListener('click', () => { void trackFunnelEvent('create_profile_clicked') })
})

async function bindAuth(): Promise<void> {
  const user = isSupabaseConfigured ? await currentUser() : null
  document.querySelectorAll<HTMLAnchorElement>('[data-auth-mode]').forEach((link) => link.addEventListener('click', (event) => {
    if (user) { event.preventDefault(); window.location.assign('/dashboard/create'); return }
    if (!isSupabaseConfigured) return
    event.preventDefault()
    authModal.open(link.dataset.authMode === 'sign-up' ? 'sign-up' : 'sign-in', link)
  }))

  const proCta = document.querySelector<HTMLAnchorElement>('[data-pro-checkout]')
  const feedback = document.querySelector<HTMLElement>('[data-plan-feedback]')
  const startProCheckout = async () => {
    if (!proCta || proCta.getAttribute('aria-disabled') === 'true') return
    proCta.setAttribute('aria-disabled', 'true')
    proCta.textContent = 'Starting checkout…'
    if (feedback) feedback.textContent = ''
    try {
      void trackFunnelEvent('upgrade_clicked')
      const result = await requestBilling('checkout')
      if (!result.session?.url) throw new Error('Stripe Checkout is unavailable.')
      window.location.assign(result.session.url)
    } catch (error) {
      if (feedback) feedback.textContent = error instanceof Error ? error.message : 'Could not start Stripe Checkout.'
      proCta.removeAttribute('aria-disabled')
      proCta.textContent = 'Upgrade to Pro →'
    }
  }

  proCta?.addEventListener('click', (event) => {
    if (!user) return
    event.preventDefault()
    void startProCheckout()
  })

  const params = new URLSearchParams(window.location.search)
  if (user && params.get('checkout') === 'pro') {
    params.delete('checkout')
    const query = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`)
    await startProCheckout()
  }
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
document.querySelectorAll('.reveal, .pricing-grid article').forEach((element) => observer.observe(element))

const peopleShowcase = document.querySelector<HTMLElement>('#peopleShowcase')
if (peopleShowcase) mountPeopleShowcase(peopleShowcase)

const interactiveDemo = document.querySelector<HTMLElement>('#interactiveProfileDemo')
if (interactiveDemo) mountInteractiveDemo(interactiveDemo)

const styleShowcase = document.querySelector<HTMLElement>('#styleShowcase')
if (styleShowcase) mountStyleShowcase(styleShowcase)

mountSupportingContent()
