import { requireAuthenticatedUser } from '../auth/session.ts'
import { getOwnedProfile, loadOnboardingState } from '../profile/repository.ts'
import type { ProfileDocument } from '../profile/types.ts'
import { getCreateWorkspace, startCreateWorkspace } from '../onboarding/createWorkspaceApp.ts'
import { mountDashboardShell, type DashboardSection } from './DashboardShell.ts'
import { createAvatarPage } from '../avatar/avatarPage.ts'
import { listAvatarAssets, listAvatarJobs } from '../avatar/repository.ts'
import '../avatar/avatar.css'
import { requestPublication } from '../profile/publicationClient.ts'
import { requestAiLifecycle } from '../profile/aiLifecycleClient.ts'

const initialRoute=`${location.pathname}${location.hash}`
const user=await requireAuthenticatedUser(initialRoute)
const profile=await getOwnedProfile(user)
let state=await loadOnboardingState(profile)
const profileDocument=profile.document as ProfileDocument
const hasProfile=profileDocument?.profileId===profile.id,name=hasProfile?profileDocument.identity.preferredName:(user.email?.split('@')[0]??'Your account')
const shell=mountDashboardShell({user,name,published:profile.is_published,slug:profile.slug})
let activeAvatarPage:ReturnType<typeof createAvatarPage>|null=null
const overview=document.querySelector<HTMLTemplateElement>('#dashboardContentTemplate')!.content.firstElementChild!.cloneNode(true) as HTMLElement
const text=(root:ParentNode,id:string,value:string)=>{const element=root.querySelector<HTMLElement>(`#${id}`);if(element)element.textContent=value}
async function initialiseOverview(){
  const [avatars,jobs]=await Promise.all([listAvatarAssets(profile),listAvatarJobs(profile)])
  const generating=jobs.some(job=>job.status==='queued'||job.status==='generating'),ready=jobs.some(job=>job.status==='ready')
  const hasAvatar=Boolean(profile.active_avatar_id||state?.original_photo_path),hasCv=Boolean(state?.cv_path)
  text(overview,'welcomeTitle',`Welcome, ${name}`)
  text(overview,'avatarTitle',profile.active_avatar_id?'Active generated avatar':generating?'Generating…':ready||avatars.length?'Avatar ready':state?.original_photo_path?'Original photo':'No avatar yet')
  text(overview,'avatarCopy',hasAvatar?'Your current avatar is connected to your profile.':'Add a portrait, then keep it natural or generate a living avatar.')
  let aiEnabled=profile.ai_enabled,aiStatus=profile.ai_status
  const aiCard=overview.querySelector<HTMLElement>('#knowledgeTitle')!.closest<HTMLElement>('.card')!,aiAction=aiCard.querySelector<HTMLButtonElement>('button')!
  async function runAi(action:'enable'|'disable'|'retry') { aiAction.disabled=true;text(overview,'knowledgeTitle',action==='disable'?'Updating…':'Preparing…');try{const result=await requestAiLifecycle(action);const next=result.profile as {enabled:boolean;status:string};aiEnabled=next.enabled;aiStatus=next.status as typeof aiStatus;renderAi()}catch(error){text(overview,'knowledgeTitle','Setup failed');text(overview,'knowledgeCopy',error instanceof Error?error.message:'AI setup failed.');aiAction.disabled=false} }
  function renderAi(){const labels={off:'Off',indexing:'Preparing…',ready:'Ready',stale:'Updating…',failed:'Setup failed'} as const;text(overview,'knowledgeTitle',labels[aiStatus]);text(overview,'knowledgeCopy',aiStatus==='ready'?'Visitors can ask grounded questions about this profile.':aiStatus==='failed'?(profile.ai_last_error??'AI setup failed. Retry when ready.'):'Let visitors ask questions based on your profile.');aiAction.hidden=aiStatus==='indexing'||aiStatus==='stale';aiAction.disabled=false;aiAction.textContent=aiStatus==='failed'?'Retry':aiEnabled?'Disable AI':'Enable AI Profile';aiAction.onclick=()=>void runAi(aiStatus==='failed'?'retry':aiEnabled?'disable':'enable')}
  renderAi()
  let published=profile.is_published,currentSlug=profile.slug
  const actions=overview.querySelector<HTMLElement>('#pageActions')!,url=overview.querySelector<HTMLElement>('#profileUrl')!
  const slugInput=document.createElement('input');slugInput.value=currentSlug;slugInput.className='slug-input';slugInput.ariaLabel='Public profile URL slug'
  const feedback=document.createElement('small');feedback.className='slug-feedback';url.hidden=false;url.replaceChildren(document.createTextNode(`${location.host}/`),slugInput,feedback)
  const button=(label:string,run:()=>Promise<void>)=>{const item=document.createElement('button');item.type='button';item.textContent=label;item.onclick=()=>void run();return item}
  const link=(label:string,href:string)=>{const item=document.createElement('a');item.textContent=label;item.href=href;return item}
  async function run(action:'availability'|'save-slug'|'publish'|'unpublish'){
    feedback.textContent='Checking…'
    try{const result=await requestPublication(action,slugInput.value);if(result.slug){slugInput.value=result.slug;feedback.textContent=`✓ /${result.slug} is available`;return}const next=result.profile as {slug:string;isPublished:boolean}|undefined;if(next){currentSlug=next.slug;published=next.isPublished;slugInput.value=currentSlug;feedback.textContent=action==='unpublish'?'Profile unpublished.':'Saved.';renderPublication()}}catch(error){feedback.textContent=error instanceof Error?error.message:'Could not update publication.'}
  }
  let availabilityTimer=0;slugInput.addEventListener('input',()=>{window.clearTimeout(availabilityTimer);availabilityTimer=window.setTimeout(()=>void run('availability'),350)})
  async function copyLink(){await navigator.clipboard.writeText(`${location.origin}/${currentSlug}`);feedback.textContent='Public link copied.'}
  function renderPublication(){
    text(overview,'profileStatus',published?'Published':'Draft');overview.querySelector('#profileStatus')?.classList.toggle('published',published);text(overview,'pageTitle',published?'Your profile is live':'Draft profile');text(overview,'pageCopy',published?'Recruiters can open and explore your public profile.':'Your profile is private while it is in draft.')
    actions.replaceChildren(link('Preview','/preview'),button('Save URL',()=>run('save-slug')));if(published)actions.append(link('View profile ↗',`/${currentSlug}`),button('Copy link',copyLink),button('Unpublish',()=>run('unpublish')));else actions.append(button('Publish',()=>run('publish')))
    const checks=[{label:'Add your CV or professional background',done:hasCv},{label:'Review your profile details',done:hasProfile},{label:'Create or choose your avatar',done:hasAvatar},{label:'Publish your profile',done:published}],completion=Math.round(checks.filter(x=>x.done).length/checks.length*100);text(overview,'completionPercent',String(completion));text(overview,'ringPercent',`${completion}%`);overview.querySelector<HTMLElement>('#progressBar')!.style.width=`${completion}%`;overview.querySelector<HTMLElement>('#completionRing')!.style.setProperty('--progress',`${completion*3.6}deg`);overview.querySelector<HTMLUListElement>('#remainingItems')!.replaceChildren(...checks.filter(x=>!x.done).map(x=>{const li=document.createElement('li');li.textContent=x.label;return li}))
  }
  renderPublication()
}
await initialiseOverview()
const simpleView=(title:string,copy:string,action:string,href:string)=>{const main=document.createElement('main');main.className='dashboard-content';const card=document.createElement('section');card.className='card route-placeholder';const h=document.createElement('h1');h.textContent=title;const p=document.createElement('p');p.textContent=copy;const a=document.createElement('a');a.className='primary-action';a.href=href;a.dataset.dashboardRoute='';a.textContent=action;card.append(h,p,a);main.append(card);return main}
const pagesView=simpleView('Pages','Preview the profile recruiters will see. Publishing controls will appear here when supported.','Preview profile ↗','/preview')
async function renderRoute(){activeAvatarPage?.stop();activeAvatarPage=null;const path=location.pathname;let section:DashboardSection='dashboard',view=overview;if(path==='/dashboard/avatar'){section='avatar';state=await loadOnboardingState(profile);activeAvatarPage=createAvatarPage(profile,state);view=activeAvatarPage.view}else if(path==='/dashboard/create'||path==='/dashboard/profile'){section='profile';view=await getCreateWorkspace()}else if(path==='/dashboard/pages'){section='pages';view=pagesView}shell.content.replaceChildren(view);shell.setActive(section);if(activeAvatarPage)await activeAvatarPage.start();else if(view!==overview&&view!==pagesView)await startCreateWorkspace()}
function navigate(url:string){const target=new URL(url,location.href);history.pushState({},'',`${target.pathname}${target.search}${target.hash}`);void renderRoute()}
document.addEventListener('click',event=>{const anchor=(event.target as Element).closest<HTMLAnchorElement>('a[href^="\/dashboard"]');if(!anchor||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const target=new URL(anchor.href);if(!target.pathname.startsWith('/dashboard'))return;event.preventDefault();navigate(`${target.pathname}${target.search}${target.hash}`)})
window.addEventListener('popstate',()=>void renderRoute())
await renderRoute()
