const steps = [
  ['Add your profile', 'Upload your CV or enter your information manually.'],
  ['Create your avatar', 'Use your original photo or choose an avatar style.'],
  ['Review your profile', 'Edit your experience, projects, skills and profile information.'],
  ['Publish', 'Share one interactive profile link anywhere.'],
]

const capabilities = [
  ['Interactive Avatar', 'A professional profile that reacts to visitors.'],
  ['AI Professional Q&A', 'Visitors can explore your experience by asking questions.'],
  ['Structured Career Profile', 'Experience, education, skills and projects remain fully editable.'],
]

const useCases = ['LinkedIn', 'Job applications', 'Recruiter outreach', 'Networking', 'Personal website', 'QR code on a CV']

function mountSteps(host: HTMLElement): void {
  const list = document.createElement('ol')
  list.className = 'creation-flow'
  steps.forEach(([title, description], index) => {
    const item = document.createElement('li')
    item.innerHTML = `<span>0${index + 1}</span><div><h3>${title}</h3><p>${description}</p></div>`
    list.append(item)
  })
  host.replaceChildren(list)
}

function mountCapabilities(host: HTMLElement): void {
  const grid = document.createElement('div')
  grid.className = 'capability-trio'
  capabilities.forEach(([title, description], index) => {
    const item = document.createElement('article')
    item.innerHTML = `<span aria-hidden="true">${['↗', '?', '≡'][index]}</span><h3>${title}</h3><p>${description}</p>`
    grid.append(item)
  })
  host.replaceChildren(grid)
}

function mountUseCases(host: HTMLElement): void {
  const list = document.createElement('ul')
  list.className = 'use-case-list'
  useCases.forEach((useCase, index) => {
    const item = document.createElement('li')
    item.innerHTML = `<span>${String(index + 1).padStart(2, '0')}</span>${useCase}`
    list.append(item)
  })
  host.replaceChildren(list)
}

export function mountSupportingContent(): void {
  const flow = document.querySelector<HTMLElement>('#creationFlow')
  const capabilityContent = document.querySelector<HTMLElement>('#capabilityContent')
  const useCaseContent = document.querySelector<HTMLElement>('#useCaseContent')
  if (flow) mountSteps(flow)
  if (capabilityContent) mountCapabilities(capabilityContent)
  if (useCaseContent) mountUseCases(useCaseContent)
}
