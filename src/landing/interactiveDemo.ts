import { createLookAtMeAvatar } from 'lookatme-avatar/vanilla'
import { lingyunAvatar } from '../avatar/lingyun.ts'
import { askProfile } from '../chat/client.ts'

const questions = [
  'What does she specialise in?',
  'Which project best shows her AI experience?',
  'What kind of roles is she suited for?',
  'What has she built?',
]

const fallbackAnswers: Record<string, string> = {
  'What does she specialise in?': 'Lingyun specialises in applied AI products: grounded RAG, tool-using agents, evaluation, computer vision, and the full-stack systems that make them useful.',
  'Which project best shows her AI experience?': 'Her e-commerce RAG support agent is a strong example: it combines retrieval, intent routing, tool calls, citations, controlled fallbacks, and human escalation.',
  'What kind of roles is she suited for?': 'She is well suited to applied AI engineering, AI product engineering, and senior full-stack roles where research needs to become reliable production software.',
  'What has she built?': 'Her work includes RAG assistants, agent workflows, content intelligence tools, scientific data platforms, and this pointer-responsive avatar experience.',
}

function localDemoFrames() {
  const src = (path: string) => `/landing/interactive-demo/${path.split('/').pop()}`
  return {
    version: 2 as const,
    center: { ...lingyunAvatar.centerFrame, src: src(lingyunAvatar.centerFrame.src) },
    directions: lingyunAvatar.directionalFrames.map((frame) => ({ ...frame, src: src(frame.src) })),
  }
}

export function mountInteractiveDemo(host: HTMLElement): void {
  host.innerHTML = `
    <article class="demo-profile">
      <div class="demo-identity">
        <span class="demo-status"><i></i> Available to explore</span>
        <div class="demo-avatar-stage"><div class="demo-avatar" data-demo-avatar></div></div>
        <div class="demo-person"><p>Lingyun Zhao</p><span>Applied AI Engineer · Computer Vision PhD</span></div>
      </div>
      <div class="demo-conversation">
        <p class="demo-kicker">Ask this profile</p>
        <h3>Explore the work behind the title.</h3>
        <div class="demo-questions" role="group" aria-label="Suggested profile questions"></div>
        <div class="demo-answer" aria-live="polite">
          <span class="demo-answer-label">Profile answer</span>
          <p>Select a question to see how this profile turns professional experience into a useful answer.</p>
          <a href="/lingyun#projects">View supporting profile information <span aria-hidden="true">→</span></a>
        </div>
      </div>
    </article>
  `

  const avatarHost = host.querySelector<HTMLElement>('[data-demo-avatar]')
  if (avatarHost) {
    createLookAtMeAvatar({
      container: avatarHost,
      frames: localDemoFrames(),
      alt: 'Interactive generated avatar of Lingyun Zhao',
      deadZone: lingyunAvatar.centerDeadZone,
      objectFit: 'contain',
      tracking: 'viewport',
    })
  }

  const questionHost = host.querySelector<HTMLElement>('.demo-questions')
  const answer = host.querySelector<HTMLElement>('.demo-answer p')
  if (!questionHost || !answer) return

  questions.forEach((question) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = question
    button.addEventListener('click', async () => {
      questionHost.querySelectorAll('button').forEach((item) => item.classList.toggle('is-active', item === button))
      answer.textContent = 'Looking through Lingyun’s profile…'
      questionHost.querySelectorAll<HTMLButtonElement>('button').forEach((item) => { item.disabled = true })
      try {
        const response = await askProfile('lingyun', question)
        answer.textContent = response.answer
      } catch {
        answer.textContent = fallbackAnswers[question]
      } finally {
        questionHost.querySelectorAll<HTMLButtonElement>('button').forEach((item) => { item.disabled = false })
      }
    })
    questionHost.append(button)
  })
}
