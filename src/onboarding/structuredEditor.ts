import type { Education, Experience, Project, Service } from '../profile/types.ts'
import type { ProfileDocumentDraft } from './types.ts'

type SaveDraft = (next: ProfileDocumentDraft) => Promise<void>
type FieldSpec = { key:string; label:string; type?:'text'|'email'|'url'|'textarea'; required?:boolean }

const node=<K extends keyof HTMLElementTagNameMap>(tag:K,className?:string,text?:string)=>{const value=document.createElement(tag);if(className)value.className=className;if(text)value.textContent=text;return value}
const id=()=>crypto.randomUUID()
const clone=<T>(value:T):T=>structuredClone(value)

function inputField(spec:FieldSpec,value=''){
  const label=node('label','structured-field',spec.label)
  const input=spec.type==='textarea'?node('textarea'):node('input')
  if(input instanceof HTMLInputElement)input.type=spec.type??'text'
  input.value=value;input.required=Boolean(spec.required);input.dataset.field=spec.key
  label.append(input);return label
}
function readFields(root:ParentNode,specs:FieldSpec[]):Record<string,string>{
  return Object.fromEntries(specs.map(spec=>[spec.key,(root.querySelector<HTMLInputElement|HTMLTextAreaElement>(`[data-field="${spec.key}"]`)?.value??'').trim()]))
}
function editorActions(onCancel:()=>void,onSave:()=>void,saveLabel='Save'){
  const row=node('div','structured-editor-actions')
  const cancel=node('button','btn btn-tertiary','Cancel');cancel.type='button';cancel.onclick=onCancel
  const save=node('button','btn btn-primary',saveLabel);save.type='button';save.onclick=onSave
  row.append(cancel,save);return row
}

export function mountStructuredProfileEditor(host:HTMLElement,initial:ProfileDocumentDraft,onSave:SaveDraft){
  let draft=clone(initial)
  let editing:string|null=null
  const update=async(next:ProfileDocumentDraft)=>{await onSave(next);draft=next;editing=null;render()}
  const section=(title:string,actionLabel:string|undefined,action:()=>void)=>{const wrap=node('section','profile-section');const head=node('header','profile-section-head');head.append(node('h3','',title));if(actionLabel){const button=node('button','btn btn-tertiary',actionLabel);button.type='button';button.onclick=action;head.append(button)}wrap.append(head);return wrap}
  const summary=(primary:string,secondary?:string)=>{const copy=node('div','profile-entry-copy');copy.append(node('strong','',primary||'Not added'));if(secondary)copy.append(node('small','',secondary));return copy}
  const entry=(primary:string,secondary:string|undefined,onEdit:()=>void,onRemove?:()=>void)=>{const row=node('article','profile-entry');row.append(summary(primary,secondary));const actions=node('div','profile-entry-actions');const edit=node('button','btn btn-tertiary','Edit');edit.type='button';edit.onclick=onEdit;actions.append(edit);if(onRemove){const remove=node('button','btn btn-tertiary profile-remove','Remove');remove.type='button';remove.onclick=onRemove;actions.append(remove)}row.append(actions);return row}
  const open=(key:string)=>{editing=key;render()}

  const heroSpecs:FieldSpec[]=[{key:'fullName',label:'Full name',required:true},{key:'preferredName',label:'Preferred name',required:true},{key:'headline',label:'Headline',required:true},{key:'location',label:'Location'},{key:'summary',label:'Summary / about',type:'textarea',required:true},{key:'email',label:'Email',type:'email',required:true}]
  const linkSpecs:FieldSpec[]=[{key:'linkedinUrl',label:'LinkedIn',type:'url'},{key:'githubUrl',label:'GitHub',type:'url'},{key:'websiteUrl',label:'Portfolio / website',type:'url'},{key:'contactHeading',label:'Contact heading'}]
  const experienceSpecs:FieldSpec[]=[{key:'role',label:'Role',required:true},{key:'company',label:'Company',required:true},{key:'location',label:'Location'},{key:'startDate',label:'Start'},{key:'endDate',label:'End'},{key:'summary',label:'Description',type:'textarea'}]
  const educationSpecs:FieldSpec[]=[{key:'degree',label:'Degree',required:true},{key:'institution',label:'Institution'},{key:'startDate',label:'Start'},{key:'endDate',label:'End'},{key:'description',label:'Description',type:'textarea'}]
  const projectSpecs:FieldSpec[]=[{key:'title',label:'Project title',required:true},{key:'category',label:'Category'},{key:'shortDescription',label:'Description',type:'textarea',required:true},{key:'url',label:'Project link',type:'url'},{key:'image',label:'Image URL',type:'url'}]
  const serviceSpecs:FieldSpec[]=[{key:'name',label:'Service name',required:true},{key:'description',label:'Description',type:'textarea',required:true}]

  function editObject<T extends {id:string}>(sectionKey:string,index:number,specs:FieldSpec[],value:T,build:(values:Record<string,string>,current:T)=>T,isNew=false){
    const form=node('form','structured-inline-editor');form.onsubmit=event=>event.preventDefault()
    specs.forEach(spec=>{
      const direct=(value as unknown as Record<string,unknown>)[spec.key]
      const current=direct??(spec.key==='url'?(value as unknown as Project).links?.[0]?.url??'':'')
      form.append(inputField(spec,String(current)))
    })
    form.append(editorActions(()=>{editing=null;render()},()=>void (async()=>{if(!form.reportValidity())return;const values=readFields(form,specs);const next=clone(draft);const target=(next[sectionKey as keyof ProfileDocumentDraft] as T[]);target[index]=build(values,value);if(sectionKey==='experience'&&!next.featured.experienceId)next.featured.experienceId=target[index].id;if(sectionKey==='education'&&!next.featured.educationId)next.featured.educationId=target[index].id;if(sectionKey==='projects'&&!next.featured.projectId)next.featured.projectId=target[index].id;await update(next)})(),isNew?'Add':'Save'))
    return form
  }

  function render(){
    host.replaceChildren()
    const hero=section('Hero / Basic information','Edit',()=>open('hero'))
    if(editing==='hero'){
      const form=node('form','structured-inline-editor');form.onsubmit=event=>event.preventDefault();heroSpecs.forEach(spec=>{const value=draft.identity[spec.key as keyof typeof draft.identity]??'';const field=inputField(spec,value);form.append(field);if(spec.key==='summary'){const area=field.querySelector('textarea')!;if(value.length<=280)area.maxLength=280;const guidance=node('small','hero-summary-guidance');const sync=()=>{guidance.textContent=`${area.value.length} / 280${area.value.length>220?' · Keep this concise so it fits comfortably beside your avatar.':''}`;guidance.classList.toggle('warning',area.value.length>220);area.setCustomValidity(area.value.length>280?'Shorten the Hero summary to 280 characters or fewer.':'')};area.addEventListener('input',sync);sync();field.append(guidance)}})
      form.append(editorActions(()=>{editing=null;render()},()=>void (async()=>{const area=form.querySelector<HTMLTextAreaElement>('[data-field="summary"]')!;area.setCustomValidity(area.value.length>280?'Shorten the Hero summary to 280 characters or fewer.':'');if(!form.reportValidity())return;const next=clone(draft);next.identity={...next.identity,...readFields(form,heroSpecs)};await update(next)})()))
      hero.append(form)
    }else hero.append(summary(draft.identity.preferredName||draft.identity.fullName||'Add your name',[draft.identity.headline,draft.identity.location].filter(Boolean).join(' · ')))
    host.append(hero)

    const repeatable=<T extends {id:string}>(key:'experience'|'education'|'projects'|'services',title:string,list:T[],specs:FieldSpec[],primary:(item:T)=>string,secondary:(item:T)=>string,empty:()=>T,build:(values:Record<string,string>,current:T)=>T)=>{
      const wrap=section(title,'+ Add',()=>open(`${key}:new`))
      list.forEach((item,index)=>{const editKey=`${key}:${index}`;wrap.append(editing===editKey?editObject(key,index,specs,item,build):entry(primary(item),secondary(item),()=>open(editKey),()=>void (async()=>{const next=clone(draft);const target=next[key] as unknown as T[];target.splice(index,1);if(key==='experience'&&next.featured.experienceId===item.id)next.featured.experienceId=target[0]?.id;if(key==='education'&&next.featured.educationId===item.id)next.featured.educationId=target[0]?.id;if(key==='projects'&&next.featured.projectId===item.id)next.featured.projectId=target[0]?.id;await update(next)})()))})
      if(editing===`${key}:new`){const value=empty();wrap.append(editObject(key,list.length,specs,value,build,true))}
      if(!list.length&&editing!==`${key}:new`)wrap.append(node('p','profile-section-empty',`No ${title.toLowerCase()} added yet.`))
      host.append(wrap)
    }
    repeatable<Experience>('experience','Experience',draft.experience,experienceSpecs,item=>item.role,item=>[item.company,item.startDate&&item.endDate?`${item.startDate} – ${item.endDate}`:item.startDate||item.endDate].filter(Boolean).join(' · '),()=>({id:id(),role:'',company:''}),(v,current)=>({...current,...v}))
    repeatable<Education>('education','Education',draft.education,educationSpecs,item=>item.degree,item=>[item.institution,item.startDate&&item.endDate?`${item.startDate} – ${item.endDate}`:item.startDate||item.endDate].filter(Boolean).join(' · '),()=>({id:id(),degree:''}),(v,current)=>({...current,...v}))
    repeatable<Project>('projects','Projects',draft.projects,projectSpecs,item=>item.title,item=>item.category||item.shortDescription,()=>({id:id(),title:'',category:'',shortDescription:''}),(v,current)=>({...current,title:v.title,category:v.category,shortDescription:v.shortDescription,image:v.image||undefined,links:v.url?[{label:'Project',url:v.url}]:[]}))

    const skills=section('Skills','Edit',()=>open('skills'))
    if(editing==='skills'){
      const form=node('form','structured-inline-editor skills-chip-editor');form.onsubmit=event=>event.preventDefault();let items=[...new Set(draft.skills.flatMap(group=>group.items).map(item=>item.trim()).filter(Boolean))]
      const chips=node('div','skills-chip-list');const addInput=node('input');addInput.placeholder='Add skill…';addInput.ariaLabel='Add skill'
      const renderChips=()=>{chips.replaceChildren(...items.map((item,index)=>{const chip=node('span','skill-edit-chip',item);const remove=node('button','','×');remove.type='button';remove.ariaLabel=`Remove ${item}`;remove.onclick=()=>{items.splice(index,1);renderChips()};chip.append(remove);return chip}))}
      const add=()=>{const value=addInput.value.replace(/,$/,'').trim();if(value&&!items.some(item=>item.toLocaleLowerCase()===value.toLocaleLowerCase()))items.push(value);addInput.value='';renderChips()}
      addInput.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===','){event.preventDefault();add()}});addInput.addEventListener('blur',add);renderChips();form.append(chips,addInput)
      form.append(editorActions(()=>{editing=null;render()},()=>void (async()=>{add();const next=clone(draft);next.skills=items.length?[{id:'profile-skills',category:'Skills',items}]:[];await update(next)})()));skills.append(form)
    }else skills.append(summary(draft.skills.flatMap(group=>group.items).join(' · ')||'No skills added yet.'))
    host.append(skills)

    repeatable<Service>('services','Services',draft.services,serviceSpecs,item=>item.name,item=>item.description,()=>({id:id(),name:'',description:''}),(v,current)=>({...current,...v}))

    const links=section('Links / Contact','Edit',()=>open('links'))
    if(editing==='links'){
      const form=node('form','structured-inline-editor');form.onsubmit=event=>event.preventDefault();linkSpecs.forEach(spec=>form.append(inputField(spec,spec.key==='contactHeading'?draft.presentation.contactHeading:draft.identity[spec.key as keyof typeof draft.identity]??'')))
      form.append(editorActions(()=>{editing=null;render()},()=>void (async()=>{if(!form.reportValidity())return;const values=readFields(form,linkSpecs);const next=clone(draft);next.identity={...next.identity,linkedinUrl:values.linkedinUrl,githubUrl:values.githubUrl,websiteUrl:values.websiteUrl};next.presentation.contactHeading=values.contactHeading;await update(next)})()));links.append(form)
    }else links.append(summary(draft.identity.websiteUrl||draft.identity.linkedinUrl||draft.identity.githubUrl||'No links added yet.',draft.presentation.contactHeading))
    host.append(links)
  }
  render()
  return{getDraft:()=>clone(draft)}
}
