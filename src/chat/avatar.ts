import type { ProfileDocument } from '../profile/types.ts'

export type ChatAvatar =
  | { kind: 'image'; src: string; alt: string }
  | { kind: 'initials'; initials: string; alt: string }

export function resolveChatAvatar(profile: ProfileDocument): ChatAvatar {
  const alt = profile.avatar.alt || `Avatar for ${profile.identity.fullName}`
  const generatedCenter = profile.avatarFrameSet?.center.src
  if (generatedCenter) return { kind: 'image', src: generatedCenter, alt }
  if (profile.avatarImageUrl) return { kind: 'image', src: profile.avatarImageUrl, alt }
  if (profile.avatar.mode === 'directional' && profile.avatar.centerFrame.src) {
    return { kind: 'image', src: profile.avatar.centerFrame.src, alt }
  }
  return { kind: 'initials', initials: profile.avatar.mode === 'placeholder' ? profile.avatar.initials : profile.identity.preferredName.slice(0, 1), alt }
}

export function renderChatAvatar(container: HTMLElement, profile: ProfileDocument): void {
  const avatar = resolveChatAvatar(profile)
  container.replaceChildren()
  if (avatar.kind === 'image') {
    const image = document.createElement('img')
    image.src = avatar.src
    image.alt = avatar.alt
    container.append(image)
    return
  }
  container.textContent = avatar.initials
  container.setAttribute('aria-label', avatar.alt)
}
