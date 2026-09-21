import { askProfile } from './client.ts'
import { createEvidenceCard } from './evidence.ts'
import { consumeTransferredConversation } from './transfer.ts'
import { isSupabaseConfigured } from '../auth/supabase.ts'
import { loadCurrentUserProfileDocument, loadPublicProfile } from '../profile/repository.ts'
import { resolveProfile } from '../profile/resolveProfile.ts'
import { CHAT_LIMITS } from '../rag/limits.ts'
import type { ChatHistoryMessage, ChatMessage } from '../rag/types.ts'
import type { ProfileDocument } from '../profile/types.ts'
import { renderChatAvatar } from './avatar.ts'

const root = document.querySelector<HTMLElement>('#chatApp')!
const parts = window.location.pathname.split('/').filter(Boolean)
const slug = decodeURIComponent(parts[0] ?? '')
let profile: ProfileDocument | null = resolveProfile(slug)
let requiresAuthorization = false
if (!profile && isSupabaseConfigured && slug) {
  profile = await loadPublicProfile(slug)
  if (!profile) {
    const owned = await loadCurrentUserProfileDocument()
    if (owned?.slug === slug) { profile = owned; requiresAuthorization = true }
  }
}

if (!profile || parts[1] !== 'chat') {
  root.innerHTML = '<section class="chat-status"><h1>Profile not found</h1><p>This chat is unavailable or the profile is not published.</p></section>'
  throw new Error('Profile chat not found')
}

const suggested = profile.suggestedQuestions.slice(0, 5)
let messages: ChatMessage[] = consumeTransferredConversation(slug)
let pending = false

const shell = document.createElement('section')
shell.className = 'chat-shell'
shell.innerHTML = `
  <header class="chat-header">
    <a class="back-link" href="/${encodeURIComponent(slug)}">← Profile</a>
    <div class="chat-identity"><span class="identity-avatar"></span><div><small>Chatting about</small><h1></h1><p></p></div></div>
    <button class="clear-button" type="button">New conversation</button>
  </header>
  <div class="message-scroll" aria-live="polite"><div class="message-list"></div></div>
  <footer class="composer-wrap"><p class="chat-error" role="alert"></p><form class="composer"><textarea rows="1" maxlength="${CHAT_LIMITS.maximumQuestionLength}" placeholder="Ask a follow-up…" aria-label="Message"></textarea><button type="submit">Send</button></form><small>Answers are grounded in this profile. This conversation disappears when you refresh.</small></footer>`
root.append(shell)

shell.querySelector<HTMLHeadingElement>('.chat-identity h1')!.textContent = profile.identity.fullName
shell.querySelector<HTMLParagraphElement>('.chat-identity p')!.textContent = profile.identity.headline
const avatar = shell.querySelector<HTMLElement>('.identity-avatar')!
renderChatAvatar(avatar, profile)
const list = shell.querySelector<HTMLElement>('.message-list')!
const scroll = shell.querySelector<HTMLElement>('.message-scroll')!
const form = shell.querySelector<HTMLFormElement>('.composer')!
const input = form.querySelector<HTMLTextAreaElement>('textarea')!
const send = form.querySelector<HTMLButtonElement>('button')!
const error = shell.querySelector<HTMLElement>('.chat-error')!

function render(): void {
  list.replaceChildren()
  if (!messages.length) {
    const empty = document.createElement('section')
    empty.className = 'chat-empty'
    const eyebrow = document.createElement('span'); eyebrow.textContent = 'Grounded profile chat'
    const heading = document.createElement('h2'); heading.textContent = `Ask about ${profile!.identity.preferredName}'s work`
    const copy = document.createElement('p'); copy.textContent = 'Explore projects, experience and skills, then ask natural follow-up questions.'
    const prompts = document.createElement('div'); prompts.className = 'example-questions'
    suggested.forEach((question) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = question; button.addEventListener('click', () => void submit(question)); prompts.append(button) })
    empty.append(eyebrow, heading, copy, prompts); list.append(empty)
  } else {
    messages.forEach((message) => {
      const article = document.createElement('article'); article.className = `message message-${message.role}`
      const label = document.createElement('span'); label.textContent = message.role === 'user' ? 'You' : profile!.identity.preferredName
      const bubble = document.createElement('div'); bubble.className = 'message-bubble'; bubble.textContent = message.content
      article.append(label, bubble)
      if (message.role === 'assistant' && message.evidence?.length) {
        const sources = document.createElement('div'); sources.className = 'chat-evidence'; sources.setAttribute('aria-label', 'Answer evidence')
        message.evidence.slice(0, 3).forEach((item) => sources.append(createEvidenceCard(slug, item)))
        article.append(sources)
      }
      list.append(article)
    })
  }
  requestAnimationFrame(() => scroll.scrollTo({ top: scroll.scrollHeight, behavior: messages.length > 2 ? 'smooth' : 'auto' }))
}

async function submit(value: string): Promise<void> {
  const content = value.trim()
  if (!content || pending || !profile!.ai.enabled) return
  error.textContent = ''; pending = true; input.disabled = true; send.disabled = true
  const history: ChatHistoryMessage[] = messages.map(({ role, content }) => ({ role, content })).slice(-CHAT_LIMITS.maximumHistoryMessages)
  messages.push({ id: crypto.randomUUID(), role: 'user', content }); input.value = ''; render()
  const thinking = document.createElement('div'); thinking.className = 'thinking'; thinking.textContent = `${profile!.identity.preferredName} is thinking…`; list.append(thinking); scroll.scrollTop = scroll.scrollHeight
  try {
    const answer = await askProfile(slug, content, history, requiresAuthorization)
    messages.push({ id: crypto.randomUUID(), role: 'assistant', content: answer.answer, evidence: answer.evidence, sources: answer.sources, relatedIds: answer.relatedIds })
  } catch (cause) {
    messages.pop()
    error.textContent = cause instanceof Error ? cause.message : 'Unable to answer right now.'
  } finally {
    pending = false; input.disabled = false; send.disabled = false; render(); input.focus()
  }
}

form.addEventListener('submit', (event) => { event.preventDefault(); void submit(input.value) })
input.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submit(input.value) } })
shell.querySelector('.clear-button')!.addEventListener('click', () => { messages = []; error.textContent = ''; render(); input.focus() })
if (!profile.ai.enabled) { input.disabled = true; send.disabled = true; error.textContent = profile.ai.unavailableMessage ?? 'AI profile chat is not available yet.' }
render()
