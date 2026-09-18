import { requireAuthenticatedUser } from '../auth/session.ts'
import { getOwnedProfile } from '../profile/repository.ts'
import type { ProfileDocument } from '../profile/types.ts'
import { mountDashboardShell } from '../dashboard/DashboardShell.ts'

const user=await requireAuthenticatedUser('/dashboard/create')
const profile=await getOwnedProfile(user)
const profileDocument=profile.document as ProfileDocument
const content=document.querySelector<HTMLTemplateElement>('#createWorkspaceTemplate')!.content.firstElementChild!.cloneNode(true) as HTMLElement
mountDashboardShell(content,{active:'profile',user,name:profileDocument?.identity?.preferredName??user.email?.split('@')[0]??'Your account',published:profile.is_published})
const status=document.querySelector<HTMLElement>('#profileStatus')!
status.textContent=profile.is_published?'Published':'Draft'
status.classList.toggle('published',profile.is_published)
await import('./createApp.ts')
