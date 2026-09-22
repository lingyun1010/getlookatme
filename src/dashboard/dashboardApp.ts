import { requireAuthenticatedUser } from '../auth/session.ts'
import { sendPasswordReset } from '../auth/authActions.ts'
import { getOwnedProfile, loadOnboardingState } from '../profile/repository.ts'
import type { ProfileDocument } from '../profile/types.ts'
import { getCreateWorkspace, startCreateWorkspace } from '../onboarding/createWorkspaceApp.ts'
import { mountDashboardShell, type DashboardSection } from './DashboardShell.ts'
import { createAvatarPage } from '../avatar/avatarPage.ts'
import '../avatar/avatar.css'
import { requestPublication } from '../profile/publicationClient.ts'
import { effectivePlan } from '../monetisation/entitlements.ts'
import { formatPlanPrice, PLAN_CONFIG, PUBLIC_PLAN_IDS } from '../monetisation/plans.ts'
import { getSubscription } from '../monetisation/subscription.ts'
import { getCurrentUserMonthlyUsage } from '../monetisation/usage.ts'
import { requestMockBilling } from '../billing/client.ts'
import { trackFunnelEvent } from '../analytics/client.ts'
import { bindBetaFeedbackForm } from '../feedback/form.ts'

const initialRoute=`${location.pathname}${location.hash}`
const user=await requireAuthenticatedUser(initialRoute)
const [profile,subscription,initialMonthlyUsage]=await Promise.all([getOwnedProfile(user),getSubscription(user),getCurrentUserMonthlyUsage(user)])
let monthlyUsage=initialMonthlyUsage
const plan=effectivePlan(subscription),planConfig=PLAN_CONFIG[plan]
let state=await loadOnboardingState(profile)
const profileDocument=profile.document as ProfileDocument
const hasProfile=profileDocument?.profileId===profile.id,name=hasProfile?profileDocument.identity.preferredName:(user.email?.split('@')[0]??'Your account')
let published=profile.is_published,currentSlug=profile.slug
const shell=mountDashboardShell({user,name,published,slug:currentSlug})
bindBetaFeedbackForm(shell.feedbackRoot,user.id,profile.id)
let activeAvatarPage:ReturnType<typeof createAvatarPage>|null=null
const overview=document.querySelector<HTMLTemplateElement>('#dashboardContentTemplate')!.content.firstElementChild!.cloneNode(true) as HTMLElement
const text=(root:ParentNode,id:string,value:string)=>{const element=root.querySelector<HTMLElement>(`#${id}`);if(element)element.textContent=value}
function renderUsage(){const avatarLimit=planConfig.entitlements['avatar.generate'].limit,ragLimit=planConfig.entitlements['rag.query'].limit;text(overview,'usageSummary',`This month: ${monthlyUsage.avatar_generation}${avatarLimit===null?'':` / ${avatarLimit}`} Avatars · ${monthlyUsage.rag_query}${ragLimit===null?'':` / ${ragLimit}`} AI questions`)}
async function initialiseOverview(){
  const hasAvatar=Boolean(profile.active_avatar_id||state?.original_photo_path),hasCv=Boolean(state?.cv_path)
  text(overview,'welcomeTitle',`Welcome back, ${name}`)
  text(overview,'currentPlanTitle',planConfig.name)
  text(overview,'planDescription',planConfig.description)
  renderUsage()
  const upgradeAction=overview.querySelector<HTMLAnchorElement>('#upgradeAction')!
  upgradeAction.textContent=plan==='free'?'Upgrade to Pro':'View plan details'
  if(plan==='free')upgradeAction.addEventListener('click',()=>void trackFunnelEvent('upgrade_clicked'))
  overview.querySelector<HTMLButtonElement>('#openFeedbackFromOverview')!.onclick=()=>shell.feedbackRoot.showModal()
  const checks=[
    {label:'Upload your CV',done:hasCv,href:'/dashboard/create'},
    {label:'Review your profile',done:hasProfile,href:'/dashboard/profile'},
    {label:'Add an Avatar',done:hasAvatar,href:'/dashboard/avatar'},
    {label:'Publish your profile',done:published,href:'/dashboard/pages'},
  ]
  const completion=Math.round(checks.filter(x=>x.done).length/checks.length*100)
  text(overview,'completionPercent',String(completion))
  text(overview,'ringPercent',`${completion}%`)
  overview.querySelector<HTMLElement>('#progressBar')!.style.width=`${completion}%`
  overview.querySelector<HTMLElement>('#completionRing')!.style.setProperty('--progress',`${completion*3.6}deg`)
  overview.querySelector<HTMLUListElement>('#setupChecklist')!.replaceChildren(...checks.map(item=>{
    const li=document.createElement('li');li.textContent=item.label;if(item.done)li.classList.add('complete');return li
  }))
  const continueSetup=overview.querySelector<HTMLAnchorElement>('#continueSetup')!
  const next=checks.find(item=>!item.done)
  if(next){continueSetup.href=next.href;continueSetup.textContent='Continue setup →'}
  else{continueSetup.href='/dashboard/pages';continueSetup.textContent='Manage public page →'}
}
await initialiseOverview()

function createPagesView(){
  const main=document.createElement('main')
  main.className='dashboard-content'
  const heading=document.createElement('header')
  heading.className='dashboard-heading'
  const headingCopy=document.createElement('div')
  const title=document.createElement('h1')
  title.textContent='Pages'
  const copy=document.createElement('p')
  copy.textContent='Manage your public profile page, URL, and publication status.'
  headingCopy.append(title,copy)
  heading.append(headingCopy)

  const card=document.createElement('article')
  card.className='card profile-card pages-manage-card'
  const body=document.createElement('div')
  const label=document.createElement('p')
  label.className='label'
  label.textContent='Public profile'
  const pageTitle=document.createElement('h2')
  pageTitle.id='pageTitle'
  const pageCopy=document.createElement('p')
  pageCopy.id='pageCopy'
  const status=document.createElement('span')
  status.className='status-badge'
  status.id='profileStatus'
  const url=document.createElement('code')
  url.id='profileUrl'
  body.append(label,status,pageTitle,pageCopy,url)

  const actions=document.createElement('div')
  actions.className='card-actions'
  actions.id='pageActions'
  card.append(body,actions)
  main.append(heading,card)

  const slugInput=document.createElement('input')
  slugInput.value=currentSlug
  slugInput.className='slug-input'
  slugInput.ariaLabel='Public profile URL slug'
  const feedback=document.createElement('small')
  feedback.className='slug-feedback'
  url.replaceChildren(document.createTextNode(`${location.host}/`),slugInput,feedback)

  const button=(labelText:string,run:()=>Promise<void>)=>{const item=document.createElement('button');item.type='button';item.textContent=labelText;item.onclick=()=>void run();return item}
  const link=(labelText:string,href:string)=>{const item=document.createElement('a');item.textContent=labelText;item.href=href;return item}

  async function run(action:'availability'|'save-slug'|'publish'|'unpublish'){
    feedback.textContent='Checking…'
    try{
      const result=await requestPublication(action,slugInput.value)
      if(result.slug){slugInput.value=result.slug;feedback.textContent=`✓ /${result.slug} is available`;return}
      const next=result.profile as {slug:string;isPublished:boolean}|undefined
      if(next){
        currentSlug=next.slug
        published=next.isPublished
        slugInput.value=currentSlug
        feedback.textContent=action==='unpublish'?'Profile unpublished.':'Saved.'
        shell.setPublication({published,slug:currentSlug})
        renderPublication()
      }
    }catch(error){
      feedback.textContent=error instanceof Error?error.message:'Could not update publication.'
    }
  }

  let availabilityTimer=0
  slugInput.addEventListener('input',()=>{
    window.clearTimeout(availabilityTimer)
    availabilityTimer=window.setTimeout(()=>void run('availability'),350)
  })

  async function copyLink(){
    await navigator.clipboard.writeText(`${location.origin}/${currentSlug}`)
    feedback.textContent='Public link copied.'
  }

  function renderPublication(){
    status.textContent=published?'Published':'Draft'
    status.classList.toggle('published',published)
    pageTitle.textContent=published?'Your profile is live':'Draft profile'
    pageCopy.textContent=published?'Recruiters can open and explore your public profile.':'Your profile is private while it is in draft.'
    actions.replaceChildren(link('Preview','/preview'),button('Save URL',()=>run('save-slug')))
    if(published)actions.append(link('View profile ↗',`/${currentSlug}`),button('Copy link',copyLink),button('Unpublish',()=>run('unpublish')))
    else actions.append(button('Publish',()=>run('publish')))
  }
  renderPublication()
  return main
}
const pagesView=createPagesView()

function createPricingView(){const main=document.createElement('main');main.className='dashboard-content';const heading=document.createElement('header');heading.className='dashboard-heading';const headingCopy=document.createElement('div');const title=document.createElement('h1');title.textContent='Plans';const copy=document.createElement('p');copy.textContent='Publish on Free, then upgrade only when you need more Avatar and AI usage.';headingCopy.append(title,copy);heading.append(headingCopy);const grid=document.createElement('section');grid.className='overview-grid';for(const planId of PUBLIC_PLAN_IDS){const item=PLAN_CONFIG[planId],card=document.createElement('article');card.className='card';card.id=planId;const label=document.createElement('p');label.className='label';label.textContent=planId===plan?'Current plan':'Plan';const name=document.createElement('h2');name.textContent=item.name;const price=document.createElement('p');price.textContent=`${formatPlanPrice(item)}${item.price&&item.price.amount>0?' / month':''}`;const description=document.createElement('p');description.textContent=item.description;const list=document.createElement('ul');for(const feature of item.highlights){const row=document.createElement('li');row.textContent=feature;list.append(row)}const action=document.createElement('a');action.className='primary-action';action.textContent=planId===plan?'Current plan':item.ctaLabel;action.href=planId==='pro'&&plan==='free'?'/dashboard/upgrade':'/dashboard';if(planId===plan){action.setAttribute('aria-disabled','true');action.addEventListener('click',event=>event.preventDefault())}else if(planId==='pro'){action.addEventListener('click',()=>void trackFunnelEvent('upgrade_clicked'))}card.append(label,name,price,description,list,action);grid.append(card)}main.append(heading,grid);return main}
const pricingView=createPricingView()
function createUpgradeView(){const main=document.createElement('main');main.className='dashboard-content';const heading=document.createElement('header');heading.className='dashboard-heading';const headingCopy=document.createElement('div');const title=document.createElement('h1');title.textContent='Mock checkout';const copy=document.createElement('p');copy.textContent='Development-only billing simulation. No payment details are collected.';headingCopy.append(title,copy);heading.append(headingCopy);const card=document.createElement('section');card.className='card';const feedback=document.createElement('p');const button=document.createElement('button');button.type='button';button.className='primary-action';const run=async(action:'start'|'complete'|'cancel'|'reactivate',sessionId?:string)=>{button.disabled=true;feedback.textContent='Updating…';try{const result=await requestMockBilling(action,sessionId);if(action==='start'&&result.session){feedback.textContent='Mock checkout is ready. Simulate payment success to activate Pro.';button.textContent='Simulate successful payment';button.disabled=false;button.onclick=()=>void run('complete',result.session!.id);return}location.assign('/dashboard')}catch(error){feedback.textContent=error instanceof Error?error.message:'Mock billing failed.';button.disabled=false}};if(subscription.plan==='pro'&&subscription.status==='cancelled'){feedback.textContent='Your mock Pro subscription is cancelled.';button.textContent='Reactivate mock subscription';button.onclick=()=>void run('reactivate')}else if(plan==='pro'){feedback.textContent='Your mock Pro subscription is active.';button.textContent='Cancel mock subscription';button.onclick=()=>void run('cancel')}else{feedback.textContent='Start a mock checkout to test the Free → Pro entitlement refresh.';button.textContent='Start mock checkout';button.onclick=()=>void run('start')}card.append(feedback,button);main.append(heading,card);return main}
const upgradeView=createUpgradeView()

function createSettingsView(){
  const main=document.createElement('main')
  main.className='dashboard-content settings-content'
  const heading=document.createElement('header')
  heading.className='dashboard-heading'
  const headingCopy=document.createElement('div')
  const title=document.createElement('h1')
  title.textContent='Settings'
  const copy=document.createElement('p')
  copy.textContent='Account details already available for this signed-in profile.'
  headingCopy.append(title,copy)
  heading.append(headingCopy)
  const grid=document.createElement('section')
  grid.className='settings-grid'
  function card(labelText:string,titleText:string){
    const article=document.createElement('article')
    article.className='card'
    const kicker=document.createElement('p');kicker.className='label';kicker.textContent=labelText
    const h=document.createElement('h2');h.textContent=titleText
    article.append(kicker,h);return article
  }
  function row(labelText:string,value:string){
    const item=document.createElement('div');item.className='settings-row'
    const dt=document.createElement('span');dt.textContent=labelText
    const dd=document.createElement('strong');dd.textContent=value||'—'
    item.append(dt,dd);return item
  }
  const account=card('Account','Your account')
  account.append(row('Display name',name),row('Email',user.email??''))
  const provider=(user.app_metadata as {provider?:string}|undefined)?.provider||user.identities?.[0]?.provider
  if(provider)account.append(row('Sign-in provider',provider))
  if(user.email){
    const reset=document.createElement('button');reset.type='button';reset.className='text-action';reset.textContent='Send password reset email'
    const note=document.createElement('p');note.className='settings-note'
    reset.onclick=()=>void (async()=>{
      reset.disabled=true;note.textContent='Sending…'
      try{const {error}=await sendPasswordReset(user.email!,`${location.origin}/login?recovery=1`);if(error)throw error;note.textContent='Check your inbox for a secure reset link.'}
      catch(error){note.textContent=error instanceof Error?error.message:'Could not send reset email.'}
      finally{reset.disabled=false}
    })()
    account.append(reset,note)
  }
  grid.append(account)
  const identity=card('Profile identity','Public profile')
  identity.append(row('Username',currentSlug||'Not set yet'))
  if(currentSlug){
    const link=document.createElement('a');link.className='text-action';link.href=`/${currentSlug}`;link.textContent=`${location.host}/${currentSlug}`
    identity.append(link)
  }
  grid.append(identity)
  const billing=card('Plan / Billing',planConfig.name)
  const planCopy=document.createElement('p');planCopy.textContent=planConfig.description
  const planLink=document.createElement('a');planLink.className='primary-action';planLink.href='/dashboard/pricing';planLink.dataset.dashboardRoute='';planLink.textContent='View plans'
  billing.append(planCopy,planLink);grid.append(billing)
  const legal=card('Privacy / legal','Policies')
  const links=document.createElement('div');links.className='settings-links'
  for(const [labelText,href] of [['Privacy','/privacy'],['Terms','/terms'],['Refunds','/refunds']] as const){
    const a=document.createElement('a');a.href=href;a.textContent=labelText;links.append(a)
  }
  legal.append(links);grid.append(legal)
  main.append(heading,grid);return main
}
const settingsView=createSettingsView()

async function renderRoute(){
  activeAvatarPage?.stop();activeAvatarPage=null
  const path=location.pathname
  let section:DashboardSection='dashboard',view=overview
  if(path==='/dashboard/avatar'){section='avatar';state=await loadOnboardingState(profile);activeAvatarPage=createAvatarPage(profile,state);view=activeAvatarPage.view}
  else if(path==='/dashboard/create'||path==='/dashboard/profile'){section='profile';view=await getCreateWorkspace()}
  else if(path==='/dashboard/pages'){section='pages';view=pagesView}
  else if(path==='/dashboard/pricing'){section='pricing';view=pricingView}
  else if(path==='/dashboard/upgrade'){section='pricing';view=upgradeView}
  else if(path==='/dashboard/settings'){section='settings';view=settingsView}
  else{monthlyUsage=await getCurrentUserMonthlyUsage(user);renderUsage()}
  shell.content.replaceChildren(view);shell.setActive(section)
  if(activeAvatarPage)await activeAvatarPage.start()
  else if(view!==overview&&view!==pagesView&&view!==pricingView&&view!==upgradeView&&view!==settingsView)await startCreateWorkspace()
}
function navigate(url:string){const target=new URL(url,location.href);history.pushState({},'',`${target.pathname}${target.search}${target.hash}`);void renderRoute()}
document.addEventListener('click',event=>{const anchor=(event.target as Element).closest<HTMLAnchorElement>('a[href^="\/dashboard"]');if(!anchor||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const target=new URL(anchor.href);if(!target.pathname.startsWith('/dashboard'))return;event.preventDefault();navigate(`${target.pathname}${target.search}${target.hash}`)})
window.addEventListener('popstate',()=>void renderRoute())
await renderRoute()
