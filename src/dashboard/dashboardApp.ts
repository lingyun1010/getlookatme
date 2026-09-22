import { requireAuthenticatedUser } from '../auth/session.ts'
import { getOwnedProfile, loadOnboardingState } from '../profile/repository.ts'
import type { ProfileDocument } from '../profile/types.ts'
import { getCreateWorkspace, startCreateWorkspace } from '../onboarding/createWorkspaceApp.ts'
import { mountDashboardShell, type DashboardSection } from './DashboardShell.ts'
import { createAvatarPage } from '../avatar/avatarPage.ts'
import '../avatar/avatar.css'
import { effectivePlan } from '../monetisation/entitlements.ts'
import { formatPlanPrice, PLAN_CONFIG, PUBLIC_PLAN_IDS } from '../monetisation/plans.ts'
import { getSubscription } from '../monetisation/subscription.ts'
import { requestMockBilling } from '../billing/client.ts'
import { trackFunnelEvent } from '../analytics/client.ts'

const initialRoute=`${location.pathname}${location.hash}`
const user=await requireAuthenticatedUser(initialRoute)
const [profile,subscription]=await Promise.all([getOwnedProfile(user),getSubscription(user)])
const plan=effectivePlan(subscription),planConfig=PLAN_CONFIG[plan]
let state=await loadOnboardingState(profile)
const profileDocument=profile.document as ProfileDocument
const hasProfile=profileDocument?.profileId===profile.id,name=hasProfile?profileDocument.identity.preferredName:(user.email?.split('@')[0]??'Your account')
const shell=mountDashboardShell({user,name,published:profile.is_published,slug:profile.slug})
let activeAvatarPage:ReturnType<typeof createAvatarPage>|null=null
const overview=document.querySelector<HTMLTemplateElement>('#dashboardContentTemplate')!.content.firstElementChild!.cloneNode(true) as HTMLElement
const text=(root:ParentNode,id:string,value:string)=>{const element=root.querySelector<HTMLElement>(`#${id}`);if(element)element.textContent=value}
async function initialiseOverview(){
  const hasAvatar=Boolean(profile.active_avatar_id||state?.original_photo_path),hasCv=Boolean(state?.cv_path)
  const published=profile.is_published
  text(overview,'welcomeTitle',`Welcome back, ${name}`)
  const checks=[
    {label:'Upload your CV',done:hasCv,href:'/dashboard/create'},
    {label:'Review your profile',done:hasProfile,href:'/dashboard/profile'},
    {label:'Add an Avatar',done:hasAvatar,href:'/dashboard/avatar'},
    {label:'Publish your profile',done:published,href:'/dashboard'},
  ]
  const completion=Math.round(checks.filter(x=>x.done).length/checks.length*100)
  text(overview,'completionPercent',String(completion))
  text(overview,'ringPercent',`${completion}%`)
  overview.querySelector<HTMLElement>('#progressBar')!.style.width=`${completion}%`
  overview.querySelector<HTMLElement>('#completionRing')!.style.setProperty('--progress',`${completion*3.6}deg`)
  const list=overview.querySelector<HTMLUListElement>('#setupChecklist')!
  list.replaceChildren(...checks.map(item=>{
    const li=document.createElement('li')
    li.textContent=item.label
    if(item.done)li.classList.add('complete')
    return li
  }))
  const continueSetup=overview.querySelector<HTMLAnchorElement>('#continueSetup')!
  const next=checks.find(item=>!item.done)
  if(next){continueSetup.href=next.href;continueSetup.textContent='Continue setup →'}
  else{continueSetup.href='/preview';continueSetup.textContent='Preview profile →'}
  const live=overview.querySelector<HTMLAnchorElement>('#liveProfileAction')!
  if(published&&profile.slug){live.hidden=false;live.href=`/${profile.slug}`}
  else live.hidden=true
  text(overview,'pageTitle',published?'Published':'Draft')
  text(overview,'pageCopy',published?'Your profile is live and ready to share.':'Your profile stays private until you publish.')
  const actions=overview.querySelector<HTMLElement>('#pageActions')!
  const preview=document.createElement('a')
  preview.textContent='Preview'
  preview.href='/preview'
  actions.replaceChildren(preview)
}
await initialiseOverview()
const simpleView=(title:string,copy:string,action:string,href:string)=>{const main=document.createElement('main');main.className='dashboard-content';const card=document.createElement('section');card.className='card route-placeholder';const h=document.createElement('h1');h.textContent=title;const p=document.createElement('p');p.textContent=copy;const a=document.createElement('a');a.className='primary-action';a.href=href;a.dataset.dashboardRoute='';a.textContent=action;card.append(h,p,a);main.append(card);return main}
const pagesView=simpleView('Pages','Preview the profile recruiters will see. Publishing controls will appear here when supported.','Preview profile ↗','/preview')
function createPricingView(){const main=document.createElement('main');main.className='dashboard-content';const heading=document.createElement('header');heading.className='dashboard-heading';const headingCopy=document.createElement('div');const title=document.createElement('h1');title.textContent='Plans';const copy=document.createElement('p');copy.textContent='Publish on Free, then upgrade only when you need more Avatar and AI usage.';headingCopy.append(title,copy);heading.append(headingCopy);const grid=document.createElement('section');grid.className='overview-grid';for(const planId of PUBLIC_PLAN_IDS){const item=PLAN_CONFIG[planId],card=document.createElement('article');card.className='card';card.id=planId;const label=document.createElement('p');label.className='label';label.textContent=planId===plan?'Current plan':'Plan';const name=document.createElement('h2');name.textContent=item.name;const price=document.createElement('p');price.textContent=`${formatPlanPrice(item)}${item.price&&item.price.amount>0?' / month':''}`;const description=document.createElement('p');description.textContent=item.description;const list=document.createElement('ul');for(const feature of item.highlights){const row=document.createElement('li');row.textContent=feature;list.append(row)}const action=document.createElement('a');action.className='primary-action';action.textContent=planId===plan?'Current plan':item.ctaLabel;action.href=planId==='pro'&&plan==='free'?'/dashboard/upgrade':'/dashboard';if(planId===plan){action.setAttribute('aria-disabled','true');action.addEventListener('click',event=>event.preventDefault())}else if(planId==='pro'){action.addEventListener('click',()=>void trackFunnelEvent('upgrade_clicked'))}card.append(label,name,price,description,list,action);grid.append(card)}main.append(heading,grid);return main}
const pricingView=createPricingView()
function createUpgradeView(){const main=document.createElement('main');main.className='dashboard-content';const heading=document.createElement('header');heading.className='dashboard-heading';const headingCopy=document.createElement('div');const title=document.createElement('h1');title.textContent='Mock checkout';const copy=document.createElement('p');copy.textContent='Development-only billing simulation. No payment details are collected.';headingCopy.append(title,copy);heading.append(headingCopy);const card=document.createElement('section');card.className='card';const feedback=document.createElement('p');const button=document.createElement('button');button.type='button';button.className='primary-action';const run=async(action:'start'|'complete'|'cancel'|'reactivate',sessionId?:string)=>{button.disabled=true;feedback.textContent='Updating…';try{const result=await requestMockBilling(action,sessionId);if(action==='start'&&result.session){feedback.textContent='Mock checkout is ready. Simulate payment success to activate Pro.';button.textContent='Simulate successful payment';button.disabled=false;button.onclick=()=>void run('complete',result.session!.id);return}location.assign('/dashboard')}catch(error){feedback.textContent=error instanceof Error?error.message:'Mock billing failed.';button.disabled=false}};if(subscription.plan==='pro'&&subscription.status==='cancelled'){feedback.textContent='Your mock Pro subscription is cancelled.';button.textContent='Reactivate mock subscription';button.onclick=()=>void run('reactivate')}else if(plan==='pro'){feedback.textContent='Your mock Pro subscription is active.';button.textContent='Cancel mock subscription';button.onclick=()=>void run('cancel')}else{feedback.textContent='Start a mock checkout to test the Free → Pro entitlement refresh.';button.textContent='Start mock checkout';button.onclick=()=>void run('start')}card.append(feedback,button);main.append(heading,card);return main}
const upgradeView=createUpgradeView()
async function renderRoute(){activeAvatarPage?.stop();activeAvatarPage=null;const path=location.pathname;let section:DashboardSection='dashboard',view=overview;if(path==='/dashboard/avatar'){section='avatar';state=await loadOnboardingState(profile);activeAvatarPage=createAvatarPage(profile,state);view=activeAvatarPage.view}else if(path==='/dashboard/create'||path==='/dashboard/profile'){section='profile';view=await getCreateWorkspace()}else if(path==='/dashboard/pages'){section='pages';view=pagesView}else if(path==='/dashboard/pricing'){section='pricing';view=pricingView}else if(path==='/dashboard/upgrade'){section='pricing';view=upgradeView}shell.content.replaceChildren(view);shell.setActive(section);if(activeAvatarPage)await activeAvatarPage.start();else if(view!==overview&&view!==pagesView&&view!==pricingView&&view!==upgradeView)await startCreateWorkspace()}
function navigate(url:string){const target=new URL(url,location.href);history.pushState({},'',`${target.pathname}${target.search}${target.hash}`);void renderRoute()}
document.addEventListener('click',event=>{const anchor=(event.target as Element).closest<HTMLAnchorElement>('a[href^="\/dashboard"]');if(!anchor||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const target=new URL(anchor.href);if(!target.pathname.startsWith('/dashboard'))return;event.preventDefault();navigate(`${target.pathname}${target.search}${target.hash}`)})
window.addEventListener('popstate',()=>void renderRoute())
await renderRoute()
