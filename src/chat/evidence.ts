import type { PortfolioAnswerEvidence, PortfolioAnswerSource } from '../rag/types.ts'

export function evidenceProfileId(source: PortfolioAnswerSource): string | null {
  const prefix = `${source.type}-`
  return source.id.startsWith(prefix) ? source.id.slice(prefix.length) : null
}

export function navigateToEvidence(profileId: string): boolean {
  const target = document.querySelector<HTMLElement>(`[data-profile-id="${CSS.escape(profileId)}"]`)
  if (!target) return false
  target.scrollIntoView({ behavior: 'smooth', block: 'center' })
  target.classList.remove('profile-highlight')
  requestAnimationFrame(() => target.classList.add('profile-highlight'))
  window.setTimeout(() => target.classList.remove('profile-highlight'), 1900)
  return true
}

export function evidenceHref(profileSlug: string, evidence: PortfolioAnswerEvidence): string {
  const anchor = evidence.section === 'profile' ? 'about' : evidence.section
  return `/${encodeURIComponent(profileSlug)}#${encodeURIComponent(anchor)}`
}

export function createEvidenceCard(profileSlug: string, evidence: PortfolioAnswerEvidence): HTMLAnchorElement {
  const link = document.createElement('a')
  link.className = 'chat-evidence-card'
  link.href = evidenceHref(profileSlug, evidence)
  const type = document.createElement('span')
  type.textContent = evidence.sourceType
  const title = document.createElement('strong')
  title.textContent = evidence.title ?? evidence.section
  const action = document.createElement('span')
  action.textContent = 'View in profile →'
  link.append(type, title, action)
  return link
}

export function renderEvidenceChips(
  container: HTMLElement,
  sources: PortfolioAnswerSource[],
  relatedIds: string[],
): void {
  container.replaceChildren()
  sources.slice(0, 3).forEach((source, index) => {
    const profileId = relatedIds[index] ?? evidenceProfileId(source)
    const hasTarget = profileId && document.querySelector(`[data-profile-id="${CSS.escape(profileId)}"]`)
    const chip = document.createElement(hasTarget ? 'button' : 'span')
    chip.className = 'source-chip'
    chip.textContent = source.title
    if (chip instanceof HTMLButtonElement && profileId) {
      chip.type = 'button'
      chip.addEventListener('click', () => navigateToEvidence(profileId))
    }
    container.append(chip)
  })
}
