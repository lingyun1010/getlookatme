import type { User } from '@supabase/supabase-js'
import { signOut } from '../auth/session.ts'
import { requestPublication } from '../profile/publicationClient.ts'

export type DashboardSection='dashboard'|'profile'|'avatar'|'pages'|'pricing'|'settings'

const SECTION_TITLE:Record<DashboardSection,string>={
  dashboard:'Dashboard',
  profile:'Dashboard',
  avatar:'Dashboard',
  pages:'Dashboard',
  pricing:'Dashboard',
  settings:'Dashboard',
}

const link=(label:string,icon:string,href:string,section:DashboardSection)=>{
  const a=document.createElement('a')
  a.href=href
  a.dataset.dashboardRoute=''
  a.dataset.section=section
  const mark=document.createElement('span')
  mark.textContent=icon
  a.append(mark,label)
  return a
}

export function mountDashboardShell(options:{user:User;name:string;published:boolean;slug:string;onPublicationChange?:(next:{published:boolean;slug:string})=>void}){
  let published=options.published
  let slug=options.slug
  const root=document.querySelector<HTMLElement>('#dashboardRoot')!
  const shell=document.createElement('div')
  shell.className='dashboard-shell'

  const side=document.createElement('aside')
  side.className='dashboard-sidebar'
  side.id='dashboardSidebar'

  const brand=document.createElement('a')
  brand.className='dashboard-brand'
  brand.href='/'
  brand.append('Get')
  const accent=document.createElement('span')
  accent.textContent='LookAtMe'
  brand.append(accent)

  const nav=document.createElement('nav')
  nav.ariaLabel='Creator navigation'
  const group=(title:string)=>{const p=document.createElement('p');p.className='nav-group';p.textContent=title;return p}
  const soon=(label:string,icon:string)=>{
    const span=document.createElement('span')
    span.className='disabled nav-soon'
    const mark=document.createElement('span')
    mark.textContent=icon
    span.append(mark,document.createTextNode(label))
    const small=document.createElement('small')
    small.textContent='Soon'
    span.append(small)
    return span
  }
  nav.append(
    link('Home','⌂','/dashboard','dashboard'),
    group('Create'),
    link('Profile','◎','/dashboard/profile','profile'),
    link('Avatar','◉','/dashboard/avatar','avatar'),
    link('Pages','▤','/dashboard/pages','pages'),
    group('AI tools'),
    soon('AI Profile','✦'),
    soon('Tailor','⌁'),
    group('Insights'),
    soon('Analytics','⌗'),
    soon('Inbox','□'),
  )

  const bottom=document.createElement('div')
  bottom.className='sidebar-bottom'
  const settings=document.createElement('a')
  settings.href='/dashboard/settings'
  settings.dataset.dashboardRoute=''
  settings.dataset.section='settings'
  settings.textContent='Settings'
  const out=document.createElement('button')
  out.type='button'
  out.textContent='Sign out'
  out.onclick=()=>void signOut()
  bottom.append(settings,out)
  side.append(brand,nav,bottom)

  const main=document.createElement('div')
  main.className='dashboard-main'

  const top=document.createElement('header')
  top.className='dashboard-topbar'

  const menu=document.createElement('button')
  menu.type='button'
  menu.className='sidebar-toggle'
  menu.setAttribute('aria-controls',side.id)
  menu.setAttribute('aria-expanded','false')
  menu.textContent='☰ Menu'
  menu.onclick=()=>{
    const open=menu.getAttribute('aria-expanded')!=='true'
    menu.setAttribute('aria-expanded',String(open))
    side.classList.toggle('open',open)
  }

  const topLeft=document.createElement('div')
  topLeft.className='topbar-left'
  const sectionTitle=document.createElement('h1')
  sectionTitle.className='topbar-title'
  sectionTitle.textContent='Dashboard'
  topLeft.append(sectionTitle)

  const topRight=document.createElement('div')
  topRight.className='topbar-right'

  const preview=document.createElement('a')
  preview.className='btn btn-secondary topbar-action'
  preview.href='/preview'
  preview.textContent='Preview'

  const publish=document.createElement('button')
  publish.type='button'
  publish.className='btn btn-primary topbar-publish'
  const syncProfileActions=()=>{
    preview.href=published?`/${slug}`:'/preview'
    preview.textContent=published?'View live page ↗':'Preview'
    publish.textContent=published?'Unpublish':'Publish'
    publish.disabled=false
  }
  syncProfileActions()
  publish.onclick=()=>void (async()=>{
    publish.disabled=true
    try{
      const result=await requestPublication(published?'unpublish':'publish',slug)
      const next=result.profile as {slug:string;isPublished:boolean}|undefined
      if(next){slug=next.slug;published=next.isPublished}
      else published=!published
      syncProfileActions()
      options.onPublicationChange?.({published,slug})
    }catch(error){
      publish.textContent=error instanceof Error?error.message:'Could not update'
      window.setTimeout(syncProfileActions,2200)
    }finally{publish.disabled=false}
  })()

  const accountWrap=document.createElement('div')
  accountWrap.className='account-menu'
  const accountBtn=document.createElement('button')
  accountBtn.type='button'
  accountBtn.className='account-trigger'
  accountBtn.setAttribute('aria-expanded','false')
  accountBtn.setAttribute('aria-haspopup','menu')
  const initial=document.createElement('span')
  initial.textContent=options.name.charAt(0).toUpperCase()
  accountBtn.append(initial)
  const panel=document.createElement('div')
  panel.className='account-panel'
  panel.hidden=true
  panel.setAttribute('role','menu')
  const identity=document.createElement('div')
  identity.className='account-identity'
  const strong=document.createElement('strong')
  strong.textContent=options.name
  const email=document.createElement('small')
  email.textContent=options.user.email??''
  identity.append(strong,email)
  const settingsItem=document.createElement('a')
  settingsItem.href='/dashboard/settings'
  settingsItem.dataset.dashboardRoute=''
  settingsItem.textContent='Settings'
  const planItem=document.createElement('a')
  planItem.href='/dashboard/pricing'
  planItem.dataset.dashboardRoute=''
  planItem.textContent='Billing / Plans'
  const signOutItem=document.createElement('button')
  signOutItem.type='button'
  signOutItem.textContent='Sign out'
  signOutItem.onclick=()=>void signOut()
  panel.append(identity,settingsItem,planItem,signOutItem)
  const closeMenu=()=>{panel.hidden=true;accountBtn.setAttribute('aria-expanded','false')}
  accountBtn.onclick=(event)=>{
    event.stopPropagation()
    const open=panel.hidden
    panel.hidden=!open
    accountBtn.setAttribute('aria-expanded',String(open))
  }
  document.addEventListener('click',()=>closeMenu())
  panel.addEventListener('click',event=>event.stopPropagation())
  accountWrap.append(accountBtn,panel)

  topRight.append(preview,publish,accountWrap)
  top.append(menu,topLeft,topRight)

  const content=document.createElement('div')
  content.id='dashboardView'

  const footer=document.createElement('footer')
  footer.className='dashboard-footer'
  const copy=document.createElement('span')
  copy.textContent='© 2026 Get Look At Me'
  footer.append(copy)
  const openFeedback=()=>{dialog.showModal()}
  for(const [label,href] of [['Help',''],['Privacy','/privacy'],['Terms','/terms'],['Feedback','']] as const){
    if(href){
      const a=document.createElement('a')
      a.href=href
      a.textContent=label
      footer.append(a)
    }else{
      const button=document.createElement('button')
      button.type='button'
      button.textContent=label
      button.onclick=openFeedback
      footer.append(button)
    }
  }

  const dialog=document.createElement('dialog')
  dialog.className='feedback-dialog'
  dialog.innerHTML=`<form method="dialog" class="feedback-dialog-close"><button value="cancel" aria-label="Close">×</button></form>
    <section class="card feedback-card" aria-labelledby="feedbackTitle">
      <p class="label">Beta feedback</p>
      <h2 id="feedbackTitle">Tell us what you think</h2>
      <p>Share a problem, idea, or quick note. Please do not include sensitive personal information.</p>
      <form id="betaFeedbackForm">
        <label>Category<select id="feedbackCategory" name="category"><option value="feedback">Feedback</option><option value="bug">Report a problem</option><option value="idea">Idea</option></select></label>
        <label>Message<textarea id="feedbackMessage" name="message" maxlength="4000" required></textarea></label>
        <div class="feedback-actions"><button class="primary-action" type="submit">Send feedback</button><p class="feedback-status" id="feedbackStatus" role="status" aria-live="polite"></p></div>
      </form>
    </section>`

  main.append(top,content,footer)
  shell.append(side,main,dialog)
  root.replaceChildren(shell)

  return{
    content,
    feedbackRoot:dialog,
    setActive(section:DashboardSection){
      nav.querySelectorAll('a').forEach(a=>a.classList.toggle('active',a.dataset.section===section))
      settings.classList.toggle('active',section==='settings')
      sectionTitle.textContent=SECTION_TITLE[section]
      side.classList.remove('open')
      menu.setAttribute('aria-expanded','false')
      closeMenu()
    },
    setPublication(next:{published:boolean;slug:string}){
      published=next.published
      slug=next.slug
      syncProfileActions()
    },
  }
}
