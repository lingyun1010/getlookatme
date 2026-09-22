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
import { requestBilling, requestMockBilling } from '../billing/client.ts'
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
function greetingForNow(){
  const hour=new Date().getHours()
  if(hour<12)return 'Good morning'
  if(hour<18)return 'Good afternoon'
  return 'Good evening'
}
async function initialiseOverview(){
  const hasAvatar=Boolean(profile.active_avatar_id||state?.original_photo_path),hasCv=Boolean(state?.cv_path)
  text(overview,'welcomeTitle',`${greetingForNow()}, ${name}`)
  const status=overview.querySelector<HTMLElement>('#overviewStatus')!
  status.textContent=published?'Published':'Draft'
  status.classList.toggle('published',published)
  const checks=[
    {label:'CV uploaded',done:hasCv,href:'/dashboard/create'},
    {label:'Profile reviewed',done:hasProfile,href:'/dashboard/profile'},
    {label:'Avatar added',done:hasAvatar,href:'/dashboard/avatar'},
    {label:'Publish profile',done:published,href:'/dashboard/pages'},
  ]
  const completion=Math.round(checks.filter(x=>x.done).length/checks.length*100)
  text(overview,'completionPercent',String(completion))
  text(overview,'ringPercent',`${completion}%`)
  text(overview,'welcomeSubtitle',completion>=100
    ? (published?'Your profile is live.':'Your profile is ready to publish.')
    : 'Your profile is almost ready.')
  overview.querySelector<HTMLElement>('#progressBar')!.style.width=`${completion}%`
  overview.querySelector<HTMLElement>('#completionRing')!.style.setProperty('--progress',`${completion*3.6}deg`)
  overview.querySelector<HTMLUListElement>('#setupChecklist')!.replaceChildren(...checks.map(item=>{
    const li=document.createElement('li');li.textContent=item.label;if(item.done)li.classList.add('complete');return li
  }))
  const continueSetup=overview.querySelector<HTMLAnchorElement>('#continueSetup')!
  const next=checks.find(item=>!item.done)
  if(next){continueSetup.href=next.href;continueSetup.textContent='Continue setup'}
  else{continueSetup.href='/dashboard/pages';continueSetup.textContent=published?'Manage page':'Continue setup'}
}
await initialiseOverview()

function createPagesView(){
  const main=document.createElement('main')
  main.className='dashboard-content pages-workspace'
  const heading=document.createElement('header')
  heading.className='dashboard-heading'
  const headingCopy=document.createElement('div')
  const title=document.createElement('h1')
  title.textContent='Pages'
  const copy=document.createElement('p')
  copy.textContent='Manage where and how your profile appears online.'
  headingCopy.append(title,copy)
  heading.append(headingCopy)

  const card=document.createElement('article')
  card.className='card pages-manage-card'
  const label=document.createElement('p')
  label.className='label'
  label.textContent='Public profile'
  const titleRow=document.createElement('div')
  titleRow.className='title-row'
  const pageTitle=document.createElement('h2')
  pageTitle.id='pageTitle'
  pageTitle.className='panel-title'
  pageTitle.textContent=name
  const status=document.createElement('span')
  status.className='status-badge'
  status.id='profileStatus'
  titleRow.append(pageTitle,status)
  const pageCopy=document.createElement('p')
  pageCopy.id='pageCopy'

  const urlBlock=document.createElement('div')
  urlBlock.className='pages-url-block'
  const urlLabel=document.createElement('p')
  urlLabel.className='choice-label'
  urlLabel.textContent='Public URL'
  const url=document.createElement('div')
  url.id='profileUrl'
  url.className='pages-url-row'
  const editUrl=document.createElement('button')
  editUrl.type='button'
  editUrl.className='btn btn-tertiary'
  editUrl.textContent='Edit URL'
  urlBlock.append(urlLabel,url,editUrl)

  const actions=document.createElement('div')
  actions.className='action-row'
  actions.id='pageActions'
  card.append(label,titleRow,pageCopy,urlBlock,actions)

  const future=document.createElement('section')
  future.className='pages-future'
  future.innerHTML='<p class="label">Coming later</p><p class="settings-note">SEO, social preview, and custom domain controls will live here.</p>'

  main.append(heading,card,future)

  const slugInput=document.createElement('input')
  slugInput.value=currentSlug
  slugInput.className='slug-input'
  slugInput.ariaLabel='Public profile URL slug'
  slugInput.hidden=true
  const feedback=document.createElement('small')
  feedback.className='slug-feedback'
  const hostSpan=document.createElement('span')
  hostSpan.className='pages-url-host'
  hostSpan.textContent=`${location.host}/`
  const slugText=document.createElement('strong')
  slugText.textContent=currentSlug
  url.append(hostSpan,slugText,slugInput,feedback)

  editUrl.onclick=()=>{
    slugInput.hidden=false
    slugText.hidden=true
    editUrl.hidden=true
    slugInput.focus()
    slugInput.select()
  }

  const button=(labelText:string,run:()=>Promise<void>,kind:'secondary'|'primary'|'tertiary'='secondary')=>{const item=document.createElement('button');item.type='button';item.className=`btn btn-${kind}`;item.textContent=labelText;item.onclick=()=>void run();return item}
  const link=(labelText:string,href:string,kind:'secondary'|'primary'|'tertiary'='secondary')=>{const item=document.createElement('a');item.className=`btn btn-${kind}`;item.textContent=labelText;item.href=href;return item}

  async function run(action:'availability'|'save-slug'|'publish'|'unpublish'){
    feedback.textContent='Checking…'
    try{
      const result=await requestPublication(action,slugInput.value)
      if(result.slug){slugInput.value=result.slug;slugText.textContent=result.slug;feedback.textContent=`✓ /${result.slug} is available`;return}
      const next=result.profile as {slug:string;isPublished:boolean}|undefined
      if(next){
        currentSlug=next.slug
        published=next.isPublished
        slugInput.value=currentSlug
        slugText.textContent=currentSlug
        feedback.textContent=action==='unpublish'?'Profile unpublished.':action==='save-slug'?'URL saved.':'Saved.'
        shell.setPublication({published,slug:currentSlug})
        slugInput.hidden=true
        slugText.hidden=false
        editUrl.hidden=false
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
    pageTitle.textContent=name
    pageCopy.textContent=published
      ?'Your profile is live. Recruiters can open and explore it.'
      :'Your profile is currently private while it is in draft.'
    actions.replaceChildren(
      link('Preview page','/preview','secondary'),
      button('Save URL',()=>run('save-slug'),'secondary'),
    )
    if(published)actions.append(link('View live page',`/${currentSlug}`,'tertiary'),button('Copy link',copyLink,'tertiary'),button('Unpublish',()=>run('unpublish'),'tertiary'))
    else actions.append(button('Publish profile',()=>run('publish'),'primary'))
  }
  renderPublication()
  return main
}
const pagesView=createPagesView()

function formatPeriodEnd(value:string|null|undefined){
  if(!value)return null
  const date=new Date(value)
  if(Number.isNaN(date.getTime()))return null
  return new Intl.DateTimeFormat('en-AU',{dateStyle:'medium'}).format(date)
}
function createPricingView(){
  let cancelAtPeriodEnd=Boolean(subscription.cancel_at_period_end)
  let periodEnd=subscription.current_period_end
  const main=document.createElement('main');main.className='dashboard-content'
  const heading=document.createElement('header');heading.className='dashboard-heading'
  const headingCopy=document.createElement('div')
  const title=document.createElement('h1');title.textContent='Plans'
  const copy=document.createElement('p');copy.textContent='Compare Free and Pro. Upgrade only when you need more Avatar and AI usage.'
  headingCopy.append(title,copy);heading.append(headingCopy)
  const statusNote=document.createElement('p');statusNote.className='settings-note';statusNote.hidden=true
  const grid=document.createElement('section');grid.className='overview-grid'
  const stripePro=plan==='pro'&&subscription.provider==='stripe'&&Boolean(subscription.provider_customer_id)
  const founding=plan==='founding'

  function renderCancelNote(){
    if(!(stripePro&&cancelAtPeriodEnd)){statusNote.hidden=true;statusNote.textContent='';return}
    const when=formatPeriodEnd(periodEnd)
    statusNote.hidden=false
    statusNote.textContent=when
      ?`Your subscription is scheduled to cancel at the end of the current billing period (${when}).`
      :'Your subscription is scheduled to cancel at the end of the current billing period.'
  }

  for(const planId of PUBLIC_PLAN_IDS){
    const item=PLAN_CONFIG[planId],card=document.createElement('article');card.className='card';card.id=planId
    const label=document.createElement('p');label.className='label'
    if(planId===plan)label.textContent='Current plan'
    else if(planId==='free'&&plan==='pro')label.textContent='Included in Pro'
    else if(planId==='free'&&plan==='founding')label.textContent='Included in Founding'
    else if(planId==='pro'&&plan==='founding')label.textContent='Included in Founding'
    else label.textContent='Plan'
    const name=document.createElement('h2');name.className='panel-title';name.textContent=item.name
    const price=document.createElement('p');price.textContent=`${formatPlanPrice(item)}${item.price&&item.price.amount>0?' / month':''}`
    const description=document.createElement('p');description.textContent=item.description
    const list=document.createElement('ul');for(const feature of item.highlights){const row=document.createElement('li');row.textContent=feature;list.append(row)}
    card.append(label,name,price,description,list)

    if(planId==='free'){
      const action=document.createElement('a');action.className='btn btn-primary'
      if(plan==='free'){action.className='btn btn-secondary';action.textContent='Current plan';action.href='/dashboard';action.setAttribute('aria-disabled','true');action.addEventListener('click',event=>event.preventDefault())}
      else {action.className='btn btn-secondary';action.textContent=plan==='founding'?'Included in Founding':'Included in Pro';action.href='/dashboard';action.setAttribute('aria-disabled','true');action.addEventListener('click',event=>event.preventDefault())}
      card.append(action)
    }else if(planId==='pro'){
      if(plan==='pro'){
        const action=document.createElement('a');action.className='btn btn-secondary';action.textContent='Current plan';action.href='/dashboard/pricing';action.setAttribute('aria-disabled','true');action.addEventListener('click',event=>event.preventDefault());card.append(action)
        if(stripePro&&!founding){
          const actions=document.createElement('div');actions.className='card-actions';actions.style.marginTop='14px';actions.style.flexWrap='wrap'
          const manage=document.createElement('button');manage.type='button';manage.className='btn btn-tertiary';manage.textContent='Manage subscription'
          manage.onclick=()=>void (async()=>{
            manage.disabled=true
            try{const result=await requestBilling('portal');if(!result.session?.url)throw new Error('Stripe Customer Portal is unavailable.');location.assign(result.session.url)}
            catch(error){statusNote.hidden=false;statusNote.textContent=error instanceof Error?error.message:'Could not open the customer portal.';manage.disabled=false}
          })()
          actions.append(manage)
          const cancelOrResume=document.createElement('button');cancelOrResume.type='button';cancelOrResume.className='btn btn-tertiary'
          const syncCancelButton=()=>{cancelOrResume.textContent=cancelAtPeriodEnd?'Resume subscription':'Cancel subscription'}
          syncCancelButton()
          cancelOrResume.onclick=()=>void (async()=>{
            if(!cancelAtPeriodEnd){
              const when=formatPeriodEnd(periodEnd)
              const confirmed=window.confirm(when
                ?`Cancel Pro at the end of the current billing period (${when})? You keep Pro access until then.`
                :'Cancel Pro at the end of the current billing period? You keep Pro access until then.')
              if(!confirmed)return
              cancelOrResume.disabled=true
              try{
                const result=await requestBilling('cancel-subscription')
                cancelAtPeriodEnd=Boolean(result.cancel_at_period_end)
                periodEnd=result.current_period_end ?? periodEnd
                subscription.cancel_at_period_end=cancelAtPeriodEnd
                if(periodEnd)subscription.current_period_end=periodEnd
                syncCancelButton();renderCancelNote();cancelOrResume.disabled=false
              }catch(error){statusNote.hidden=false;statusNote.textContent=error instanceof Error?error.message:'Could not cancel the subscription.';cancelOrResume.disabled=false}
              return
            }
            cancelOrResume.disabled=true
            try{
              const result=await requestBilling('reactivate-subscription')
              cancelAtPeriodEnd=Boolean(result.cancel_at_period_end)
              periodEnd=result.current_period_end ?? periodEnd
              subscription.cancel_at_period_end=cancelAtPeriodEnd
              if(periodEnd)subscription.current_period_end=periodEnd
              syncCancelButton();renderCancelNote();cancelOrResume.disabled=false
            }catch(error){statusNote.hidden=false;statusNote.textContent=error instanceof Error?error.message:'Could not resume the subscription.';cancelOrResume.disabled=false}
          })()
          actions.append(cancelOrResume)
          card.append(actions)
        }
      }else if(plan==='founding'){
        const action=document.createElement('a');action.className='btn btn-secondary';action.textContent='Included in Founding';action.href='/dashboard';action.setAttribute('aria-disabled','true');action.addEventListener('click',event=>event.preventDefault());card.append(action)
      }else{
        const action=document.createElement('a');action.className='btn btn-primary';action.textContent=item.ctaLabel;action.href='/dashboard/upgrade';action.addEventListener('click',()=>void trackFunnelEvent('upgrade_clicked'));card.append(action)
      }
    }
    grid.append(card)
  }
  renderCancelNote()
  main.append(heading,statusNote,grid);return main
}
const pricingView=createPricingView()
;(function applyCheckoutReturnState(){
  const params=new URLSearchParams(location.search)
  const checkout=params.get('checkout')
  const portal=params.get('portal')
  if(!checkout&&!portal)return
  const note=document.createElement('p')
  note.className='settings-note'
  if(checkout==='success')note.textContent='Payment received. Your Pro entitlements appear after Stripe confirms the subscription—refresh this page in a moment if the plan has not updated yet.'
  else if(checkout==='cancelled')note.textContent='Checkout was cancelled. No charge was made.'
  else if(portal==='return')note.textContent='Returned from Stripe Customer Portal. Refresh if your plan status has changed.'
  else return
  pricingView.insertBefore(note, pricingView.children[1] ?? null)
})()
function createUpgradeView(){
  const useMockBilling=Boolean((import.meta as ImportMeta & {env?:Record<string,string>}).env?.DEV) && ((import.meta as ImportMeta & {env?:Record<string,string>}).env?.VITE_MOCK_BILLING_ENABLED==='true')
  const main=document.createElement('main');main.className='dashboard-content'
  const heading=document.createElement('header');heading.className='dashboard-heading'
  const headingCopy=document.createElement('div')
  const title=document.createElement('h1');title.textContent=useMockBilling?'Mock checkout':'Upgrade to Pro'
  const copy=document.createElement('p');copy.textContent=useMockBilling?'Development-only billing simulation. No payment details are collected.':'Secure checkout is handled by Stripe. Your plan updates after payment confirms.'
  headingCopy.append(title,copy);heading.append(headingCopy)
  const card=document.createElement('section');card.className='card'
  const feedback=document.createElement('p')
  const button=document.createElement('button');button.type='button';button.className='btn btn-primary'
  if(useMockBilling){
    const run=async(action:'start'|'complete'|'cancel'|'reactivate',sessionId?:string)=>{
      button.disabled=true;feedback.textContent='Updating…'
      try{
        const result=await requestMockBilling(action,sessionId)
        if(action==='start'&&result.session){
          feedback.textContent='Mock checkout is ready. Simulate payment success to activate Pro.'
          button.textContent='Simulate successful payment';button.disabled=false
          button.onclick=()=>void run('complete',result.session!.id);return
        }
        location.assign('/dashboard')
      }catch(error){feedback.textContent=error instanceof Error?error.message:'Mock billing failed.';button.disabled=false}
    }
    if(subscription.plan==='pro'&&subscription.status==='cancelled'){
      feedback.textContent='Your mock Pro subscription is cancelled.';button.textContent='Reactivate mock subscription';button.onclick=()=>void run('reactivate')
    }else if(plan==='pro'){
      feedback.textContent='Your mock Pro subscription is active.';button.textContent='Cancel mock subscription';button.onclick=()=>void run('cancel')
    }else{
      feedback.textContent='Start a mock checkout to test the Free → Pro entitlement refresh.';button.textContent='Start mock checkout';button.onclick=()=>void run('start')
    }
  }else{
    const openPortal=()=>void (async()=>{
      button.disabled=true;feedback.textContent='Opening Stripe…'
      try{
        const result=await requestBilling('portal')
        if(!result.session?.url)throw new Error('Stripe Customer Portal is unavailable.')
        location.assign(result.session.url)
      }catch(error){feedback.textContent=error instanceof Error?error.message:'Could not open the customer portal.';button.disabled=false}
    })()
    if(subscription.provider==='stripe'&&subscription.provider_customer_id&&plan==='pro'){
      let cancelAtPeriodEnd=Boolean(subscription.cancel_at_period_end)
      const when=formatPeriodEnd(subscription.current_period_end)
      feedback.textContent=cancelAtPeriodEnd
        ?(when?`Pro is scheduled to cancel on ${when}.`:'Pro is scheduled to cancel at period end.')
        :'Manage billing in Stripe, or cancel directly in Get Look At Me. Access continues until the period ends.'
      button.textContent='Manage subscription'
      button.onclick=openPortal
      const cancelBtn=document.createElement('button');cancelBtn.type='button';cancelBtn.className='btn btn-tertiary';cancelBtn.style.marginTop='12px'
      const sync=()=>{cancelBtn.textContent=cancelAtPeriodEnd?'Resume subscription':'Cancel subscription'}
      sync()
      cancelBtn.onclick=()=>void (async()=>{
        if(!cancelAtPeriodEnd){
          const confirmed=window.confirm(when
            ?`Cancel Pro at the end of the current billing period (${when})? You keep Pro access until then.`
            :'Cancel Pro at the end of the current billing period? You keep Pro access until then.')
          if(!confirmed)return
        }
        cancelBtn.disabled=true;button.disabled=true
        try{
          const result=await requestBilling(cancelAtPeriodEnd?'reactivate-subscription':'cancel-subscription')
          cancelAtPeriodEnd=Boolean(result.cancel_at_period_end)
          subscription.cancel_at_period_end=cancelAtPeriodEnd
          if(result.current_period_end)subscription.current_period_end=result.current_period_end
          feedback.textContent=cancelAtPeriodEnd
            ?`Your subscription is scheduled to cancel${result.current_period_end?` on ${formatPeriodEnd(result.current_period_end)}`:''}.`
            :'Your Pro subscription will renew at the end of the billing period.'
          sync();cancelBtn.disabled=false;button.disabled=false
        }catch(error){feedback.textContent=error instanceof Error?error.message:'Could not update the subscription.';cancelBtn.disabled=false;button.disabled=false}
      })()
      card.append(cancelBtn)
    }else if(plan==='pro'){
      feedback.textContent='Your Pro plan is active.'
      button.textContent='Back to dashboard'
      button.onclick=()=>location.assign('/dashboard')
    }else{
      feedback.textContent='Continue to Stripe Checkout to activate Pro. Entitlements update after the payment webhook confirms.'
      button.textContent='Continue to Stripe Checkout'
      button.onclick=()=>void (async()=>{
        button.disabled=true;feedback.textContent='Starting Checkout…'
        try{
          void trackFunnelEvent('upgrade_clicked')
          const result=await requestBilling('checkout')
          if(!result.session?.url)throw new Error('Stripe Checkout is unavailable.')
          location.assign(result.session.url)
        }catch(error){feedback.textContent=error instanceof Error?error.message:'Could not start Stripe Checkout.';button.disabled=false}
      })()
    }
  }
  card.append(feedback,button);main.append(heading,card);return main
}
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
  copy.textContent='Account, billing, and privacy for this signed-in profile.'
  headingCopy.append(title,copy)
  heading.append(headingCopy)
  const grid=document.createElement('section')
  grid.className='settings-grid'
  function card(labelText:string,titleText:string){
    const article=document.createElement('article')
    article.className='card'
    const kicker=document.createElement('p');kicker.className='label';kicker.textContent=labelText
    const h=document.createElement('h2');h.className='panel-title';h.textContent=titleText
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
  const pagesNote=document.createElement('p');pagesNote.className='settings-note'
  pagesNote.textContent='Public URL and publish controls live on Pages.'
  const pagesLink=document.createElement('a');pagesLink.className='btn btn-tertiary';pagesLink.href='/dashboard/pages';pagesLink.dataset.dashboardRoute='';pagesLink.textContent='Open Pages'
  account.append(pagesNote,pagesLink)
  grid.append(account)
  const billing=card('Billing',planConfig.name)
  const planCopy=document.createElement('p');planCopy.textContent=planConfig.description
  const planLink=document.createElement('a');planLink.className='btn btn-secondary';planLink.href='/dashboard/pricing';planLink.dataset.dashboardRoute='';planLink.textContent='View plans'
  billing.append(planCopy,planLink)
  if(subscription.provider==='stripe'&&subscription.provider_customer_id&&plan==='pro'){
    let cancelAtPeriodEnd=Boolean(subscription.cancel_at_period_end)
    const manage=document.createElement('button');manage.type='button';manage.className='btn btn-tertiary';manage.textContent='Manage subscription'
    const cancelBtn=document.createElement('button');cancelBtn.type='button';cancelBtn.className='btn btn-tertiary'
    const manageNote=document.createElement('p');manageNote.className='settings-note'
    const syncCancel=()=>{
      cancelBtn.textContent=cancelAtPeriodEnd?'Resume subscription':'Cancel subscription'
      if(cancelAtPeriodEnd){
        const when=formatPeriodEnd(subscription.current_period_end)
        manageNote.textContent=when
          ?`Your subscription is scheduled to cancel at the end of the current billing period (${when}).`
          :'Your subscription is scheduled to cancel at the end of the current billing period.'
      }
    }
    syncCancel()
    manage.onclick=()=>void (async()=>{
      manage.disabled=true;manageNote.textContent='Opening Stripe…'
      try{
        const result=await requestBilling('portal')
        if(!result.session?.url)throw new Error('Stripe Customer Portal is unavailable.')
        location.assign(result.session.url)
      }catch(error){manageNote.textContent=error instanceof Error?error.message:'Could not open the customer portal.';manage.disabled=false}
    })()
    cancelBtn.onclick=()=>void (async()=>{
      if(!cancelAtPeriodEnd){
        const when=formatPeriodEnd(subscription.current_period_end)
        const confirmed=window.confirm(when
          ?`Cancel Pro at the end of the current billing period (${when})? You keep Pro access until then.`
          :'Cancel Pro at the end of the current billing period? You keep Pro access until then.')
        if(!confirmed)return
      }
      cancelBtn.disabled=true;manage.disabled=true
      try{
        const result=await requestBilling(cancelAtPeriodEnd?'reactivate-subscription':'cancel-subscription')
        cancelAtPeriodEnd=Boolean(result.cancel_at_period_end)
        subscription.cancel_at_period_end=cancelAtPeriodEnd
        if(result.current_period_end)subscription.current_period_end=result.current_period_end
        if(!cancelAtPeriodEnd)manageNote.textContent='Your Pro subscription will renew at the end of the billing period.'
        syncCancel();cancelBtn.disabled=false;manage.disabled=false
      }catch(error){manageNote.textContent=error instanceof Error?error.message:'Could not update the subscription.';cancelBtn.disabled=false;manage.disabled=false}
    })()
    billing.append(manage,cancelBtn,manageNote)
  }
  grid.append(billing)
  const legal=card('Privacy','Policies')
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
  else{monthlyUsage=await getCurrentUserMonthlyUsage(user)}
  shell.content.replaceChildren(view);shell.setActive(section)
  if(activeAvatarPage)await activeAvatarPage.start()
  else if(view!==overview&&view!==pagesView&&view!==pricingView&&view!==upgradeView&&view!==settingsView)await startCreateWorkspace()
}
function navigate(url:string){const target=new URL(url,location.href);history.pushState({},'',`${target.pathname}${target.search}${target.hash}`);void renderRoute()}
document.addEventListener('click',event=>{const anchor=(event.target as Element).closest<HTMLAnchorElement>('a[href^="\/dashboard"]');if(!anchor||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const target=new URL(anchor.href);if(!target.pathname.startsWith('/dashboard'))return;event.preventDefault();navigate(`${target.pathname}${target.search}${target.hash}`)})
window.addEventListener('popstate',()=>void renderRoute())
await renderRoute()
