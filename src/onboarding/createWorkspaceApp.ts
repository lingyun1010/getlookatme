let workspace:HTMLElement|null=null
let controllerStarted=false
export async function getCreateWorkspace():Promise<HTMLElement>{if(workspace)return workspace;const response=await fetch('/create.html');if(!response.ok)throw new Error('Unable to load the profile workspace.');const page=new DOMParser().parseFromString(await response.text(),'text/html');workspace=page.querySelector<HTMLTemplateElement>('#createWorkspaceTemplate')!.content.firstElementChild!.cloneNode(true) as HTMLElement;return workspace}
export async function startCreateWorkspace():Promise<void>{if(controllerStarted)return;controllerStarted=true;await import('./createApp.ts')}
