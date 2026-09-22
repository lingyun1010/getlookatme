import type { User } from '@supabase/supabase-js'
import { signOut } from '../auth/session.ts'
import { requestPublication } from '../profile/publicationClient.ts'

export type DashboardSection='dashboard'|'profile'|'avatar'|'pages'|'pricing'|'settings'

const SECTION_TITLE:Record<DashboardSection,string>={
  dashboard:'Dashboard',
  profile:'Profile',
  avatar:'Avatar',
  pages:'Pages',
  pricing:'Plan',
  settings:'Settings',
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

export function mountDashboardShell(options:{user:User;name:string;published:boolean;slug:string}){
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
  nav.append(
    link('Dashboard','⌂','/dashboard','dashboard'),
    link('Profile','◎','/dashboard/profile','profile'),
    link('Avatar','◉','/dashboard/avatar','avatar'),
    link('Pages','▤','/dashboard/pages','pages'),
    link('Plan','◇','/dashboard/pricing','pricing'),
  )
  const next=document.createElement('p')
  next.textContent='Coming next'
  nav.append(next)
  for(const label of ['✦ AI Profile','⌁ Tailor','⌗ Analytics','□ Inbox']){
    const span=document.createElement('span')
    span.className='disabled'
    span.textContent=label
    const small=document.createElement('small')
    small.textContent='Soon'
    span.append(small)
    nav.append(span)
  }

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
  const statusBadge=document.createElement('span')
  statusBadge.className='status-badge'
  const syncBadge=()=>{
    statusBadge.textContent=published?'Published':'Draft'
    statusBadge.classList.toggle('published',published)
  }
  syncBadge()
  topLeft.append(sectionTitle,statusBadge)

  const topRight=document.createElement('div')
  topRight.className='topbar-right'

  const preview=document.createElement('a')
  preview.className='topbar-action'
  preview.href='/preview'
  preview.textContent='Preview'

  const publish=document.createElement('button')
  publish.type='button'
  publish.className='topbar-action topbar-publish'
  const syncPublish=()=>{
    publish.textContent=published?'Unpublish':'Publish'
    publish.disabled=false
  }
  syncPublish()
  publish.onclick=()=>void (async()=>{
    publish.disabled=true
    try{
      const result=await requestPublication(published?'unpublish':'publish',slug)
      const next=result.profile as {slug:string;isPublished:boolean}|undefined
      if(next){slug=next.slug;published=next.isPublished}
      else published=!published
      syncBadge();syncPublish()
    }catch(error){
      publish.textContent=error instanceof Error?error.message:'Could not update'
      window.setTimeout(syncPublish,2200)
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
  planItem.textContent='Plan / Billing'
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
  main.append(top,content)
  shell.append(side,main)
  root.replaceChildren(shell)

  return{
    content,
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
      syncBadge()
      syncPublish()
    },
  }
}
