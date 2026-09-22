import { submitBetaFeedback, type FeedbackCategory } from './client.ts'

export function bindBetaFeedbackForm(root: ParentNode, userId: string, profileId?: string): void {
  const form = root.querySelector<HTMLFormElement>('#betaFeedbackForm')
  if (!form || form.dataset.bound) return
  form.dataset.bound = 'true'
  const message = form.querySelector<HTMLTextAreaElement>('#feedbackMessage')!
  const category = form.querySelector<HTMLSelectElement>('#feedbackCategory')!
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
  const status = form.querySelector<HTMLElement>('#feedbackStatus')!
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    submit.disabled = true
    status.textContent = 'Sending…'
    status.dataset.kind = ''
    void submitBetaFeedback({ userId, profileId, category: category.value as FeedbackCategory, message: message.value })
      .then(() => {
        form.reset()
        status.textContent = 'Thanks—your feedback was sent.'
        status.dataset.kind = 'success'
      })
      .catch((error) => {
        status.textContent = error instanceof Error ? error.message : 'Feedback could not be sent. Please try again later.'
        status.dataset.kind = 'error'
      })
      .finally(() => { submit.disabled = false })
  })
}
