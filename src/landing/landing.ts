import { createLookAtMeAvatar } from 'lookatme-avatar/vanilla'
import { lingyunAvatar } from '../avatar/lingyun.ts'
import { currentUser } from '../auth/session.ts'
import { isSupabaseConfigured } from '../auth/supabase.ts'
import { AuthModal } from '../auth/AuthModal.ts'
import { formatPlanPrice, PLAN_CONFIG, PUBLIC_PLAN_IDS } from '../monetisation/plans.ts'
import { trackFunnelEvent } from '../analytics/client.ts'
import { askProfile } from '../chat/client.ts'
import { createEvidenceCard } from '../chat/evidence.ts'
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
      ${planId === 'pro' ? '<a class="button auth-cta" data-auth-mode="sign-up" href="/signup">Upgrade to Pro →</a>' : 
        '<a class="button auth-cta" data-auth-mode="sign-up" href="/signup">Start free →</a>'}
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

const heroQuestions = [...document.querySelectorAll<HTMLButtonElement>('.avatar-experience .question')]
const answerCard = document.querySelector<HTMLElement>('.answer-card')
const answerCopy = answerCard?.querySelector<HTMLElement>('.answer-copy')
const answerHelper = answerCard?.querySelector<HTMLElement>('.answer-helper')
const answerEvidence = answerCard?.querySelector<HTMLElement>('.answer-evidence')
let heroQuestionPending = false

async function askHeroQuestion(button: HTMLButtonElement): Promise<void> {
  if (heroQuestionPending || !answerCard || !answerCopy || !answerHelper || !answerEvidence) return
  heroQuestionPending = true
  heroQuestions.forEach((question) => {
    question.disabled = true
    question.setAttribute('aria-pressed', String(question === button))
  })
  answerCard.setAttribute('aria-busy', 'true')
  answerCard.dataset.state = 'loading'
  answerCopy.textContent = 'Lingyun AI is thinking…'
  answerHelper.textContent = 'Finding a profile-grounded answer.'
  answerEvidence.replaceChildren()

  try {
    const result = await askProfile('lingyun', button.textContent?.trim() ?? '')
    answerCard.dataset.state = 'success'
    answerCopy.textContent = result.answer
    answerHelper.textContent = result.evidence.length ? 'Sources from Lingyun’s profile' : ''
    result.evidence.slice(0, 3).forEach((evidence) => answerEvidence.append(createEvidenceCard('lingyun', evidence)))
  } catch (error) {
    answerCard.dataset.state = 'error'
    answerCopy.textContent = error instanceof Error ? error.message : 'Unable to answer right now.'
    answerHelper.textContent = 'Please choose the question again to retry.'
  } finally {
    heroQuestionPending = false
    answerCard.setAttribute('aria-busy', 'false')
    heroQuestions.forEach((question) => { question.disabled = false })
  }
}

heroQuestions.forEach((button) => button.addEventListener('click', () => { void askHeroQuestion(button) }))

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
