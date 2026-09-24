import { createLookAtMeAvatar } from 'lookatme-avatar/vanilla'
import { lingyunAvatar } from '../avatar/lingyun.ts'
import { currentUser } from '../auth/session.ts'
import { isSupabaseConfigured } from '../auth/supabase.ts'
import { AuthModal } from '../auth/AuthModal.ts'
import { formatPlanPrice, PLAN_CONFIG, PUBLIC_PLAN_IDS } from '../monetisation/plans.ts'
import { trackFunnelEvent } from '../analytics/client.ts'
import { requestBilling } from '../billing/client.ts'
import { mountStyleShowcase } from './styleShowcase.ts'
import '../auth/auth.css'

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

const avatarHost = document.querySelector<HTMLElement>('#heroAvatar')
if (avatarHost) {
  createLookAtMeAvatar({
    container: avatarHost,
    frames: { version: 2, center: lingyunAvatar.centerFrame, directions: [...lingyunAvatar.directionalFrames] },
    alt: lingyunAvatar.alt,
    deadZone: lingyunAvatar.centerDeadZone,
    objectFit: 'contain',
    tracking: 'avatar',
  })
}

const heroQuestions = [...document.querySelectorAll<HTMLButtonElement>('.avatar-experience .question')]
const answerCard = document.querySelector<HTMLElement>('.answer-card')
const answerCopy = answerCard?.querySelector<HTMLElement>('.answer-copy')
const answerHelper = answerCard?.querySelector<HTMLElement>('.answer-helper')
const answerEvidence = answerCard?.querySelector<HTMLElement>('.answer-evidence')
const capabilityList = document.querySelector<HTMLElement>('.hero .capability-list')
const avatarExperience = document.querySelector<HTMLElement>('.hero .avatar-experience')

function alignAnswerPanelToChips(): void {
  if (!answerCard || !capabilityList || !avatarExperience) return
  if (!window.matchMedia('(min-width: 981px)').matches) {
    answerCard.style.removeProperty('bottom')
    return
  }
  const chipsRect = capabilityList.getBoundingClientRect()
  const demoRect = avatarExperience.getBoundingClientRect()
  answerCard.style.bottom = `${demoRect.bottom - chipsRect.bottom}px`
}

if (answerCard && capabilityList && avatarExperience) {
  const alignmentObserver = new ResizeObserver(alignAnswerPanelToChips)
  alignmentObserver.observe(capabilityList)
  alignmentObserver.observe(avatarExperience)
  alignmentObserver.observe(answerCard)
  window.addEventListener('resize', alignAnswerPanelToChips)
  void document.fonts.ready.then(alignAnswerPanelToChips)
}

const heroDemoQuestions = [
  {
    question: 'What AI projects has Lingyun built?',
    answer: 'Lingyun has built AI products including RAG assistants, ecommerce agents and interactive professional-profile experiences.',
    ctaLabel: 'View AI projects →',
    target: '/lingyun#projects',
  },
  {
    question: 'Show me her RAG experience',
    answer: 'She has built profile-grounded RAG systems with retrieval isolation, evidence mapping and multi-turn chat experiences.',
    ctaLabel: 'See RAG work →',
    target: '/lingyun#projects',
  },
  {
    question: 'Why is she a fit for this role?',
    answer: 'Her background combines full-stack software engineering, computer vision research and hands-on AI product development.',
    ctaLabel: 'View experience →',
    target: '/lingyun#experience',
  },
  {
    question: 'What did she do before AI?',
    answer: 'Before focusing on AI products, Lingyun worked as a full-stack software engineer and completed a PhD in Computer Vision.',
    ctaLabel: 'View career history →',
    target: '/lingyun#experience',
  },
] as const

function askHeroQuestion(button: HTMLButtonElement): void {
  if (!answerCard || !answerCopy || !answerHelper || !answerEvidence) return
  const selected = heroDemoQuestions.find(({ question }) => question === button.textContent?.trim())
  if (!selected) return
  heroQuestions.forEach((question) => {
    question.setAttribute('aria-pressed', String(question === button))
  })
  answerCard.dataset.state = 'success'
  answerCopy.textContent = selected.answer
  answerHelper.textContent = ''
  const link = document.createElement('a')
  link.className = 'chat-evidence-card'
  link.href = selected.target
  link.textContent = selected.ctaLabel
  answerEvidence.replaceChildren(link)
  alignAnswerPanelToChips()
}

heroQuestions.forEach((button) => button.addEventListener('click', () => askHeroQuestion(button)))

const styleShowcase = document.querySelector<HTMLElement>('#styleShowcase')
if (styleShowcase) mountStyleShowcase(styleShowcase)

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
document.querySelectorAll('.reveal, .steps li, .value-grid article, .profile-preview, .pricing-grid article').forEach((element) => observer.observe(element))
