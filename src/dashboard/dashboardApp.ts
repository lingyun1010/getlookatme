import { requireAuthenticatedUser, signOut } from '../auth/session.ts'
import { getOwnedProfile, loadOnboardingState } from '../profile/repository.ts'
import type { ProfileDocument } from '../profile/types.ts'

const user = await requireAuthenticatedUser('/dashboard')
const profile = await getOwnedProfile(user)
const state = await loadOnboardingState(profile)
const profileDocument = profile.document as ProfileDocument
const hasProfile = profileDocument?.profileId === profile.id
const hasCv = Boolean(state?.cv_path)
const hasAvatar = Boolean(state?.original_photo_path || state?.avatar_frame_paths.length || (hasProfile && profileDocument.avatarMode === 'dynamic'))
const published = profile.is_published
const checks = [{label:'Add your CV or professional background',done:hasCv},{label:'Review your profile details',done:hasProfile},{label:'Create or choose your avatar',done:hasAvatar},{label:'Publish your profile',done:published}]
const completion = Math.round(checks.filter(({done})=>done).length / checks.length * 100)
const text=(id:string,value:string)=>{documentQuery<HTMLElement>(id).textContent=value}
function documentQuery<T extends Element>(id:string):T{return document.getElementById(id) as unknown as T}

const name = hasProfile ? profileDocument.identity.preferredName : (user.email?.split('@')[0] ?? 'there')
text('welcomeTitle',`Welcome, ${name}`);text('accountName',name);text('accountEmail',user.email??'');text('accountInitial',name.charAt(0).toUpperCase())
text('completionPercent',String(completion));text('ringPercent',`${completion}%`);documentQuery<HTMLElement>('progressBar').style.width=`${completion}%`;documentQuery<HTMLElement>('completionRing').style.setProperty('--progress',`${completion * 3.6}deg`)
const remaining=documentQuery<HTMLUListElement>('remainingItems');remaining.replaceChildren(...checks.filter(({done})=>!done).map(({label})=>{const li=document.createElement('li');li.textContent=label;return li}))
if(!remaining.children.length){const li=document.createElement('li');li.textContent='Your profile setup is complete';li.className='complete';remaining.append(li)}
text('avatarTitle',hasAvatar?'Avatar ready':'No avatar yet');text('avatarCopy',hasAvatar?'Your current avatar is connected to your profile.':'Add a portrait, then keep it natural or generate a living avatar.');text('avatarAction',hasAvatar?'Manage avatar →':'Create avatar →')
text('knowledgeTitle',hasProfile?'Profile data ready':'Not set up');text('knowledgeCopy',hasProfile?'Your structured profile data is ready. Persistent per-profile RAG is coming next.':'Complete your profile to prepare structured experience and project data.')
text('profileStatus',published?'Published':'Draft');documentQuery('profileStatus').classList.toggle('published',published)
const actions=documentQuery<HTMLElement>('pageActions');const action=(label:string,href:string,primary=false)=>{const a=document.createElement('a');a.textContent=label;a.href=href;if(primary)a.className='primary-action';return a}
if(published){text('pageTitle','Your profile is live');text('pageCopy','Recruiters can open and explore your public profile.');const url=`/${profile.slug}`;const code=documentQuery<HTMLElement>('profileUrl');code.hidden=false;code.textContent=url;actions.append(action('View live ↗',url,true),action('Edit','/create'));const live=documentQuery<HTMLAnchorElement>('liveProfileAction');live.hidden=false;live.href=url}else{text('pageTitle','Draft profile');text('pageCopy','Preview your work while you finish setting up. Publishing is not available yet.');actions.append(action('Preview','/preview',true));const disabled=document.createElement('button');disabled.disabled=true;disabled.textContent='Publish · Coming soon';disabled.className='disabled-action';actions.append(disabled)}
documentQuery<HTMLButtonElement>('signOutButton').onclick=()=>void signOut()
const menu=documentQuery<HTMLButtonElement>('menuButton'),sidebar=documentQuery<HTMLElement>('dashboardSidebar');menu.onclick=()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));sidebar.classList.toggle('open',open)}
