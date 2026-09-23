type ProfessionalIdentity = {
  role: string
  image: string
  position: string
  tone: string
}

const identities: ProfessionalIdentity[] = [
  { role: 'AI Engineer', image: '/landing/people/ai-engineer.png', position: 'center bottom', tone: 'indigo' },
  { role: 'Product Designer', image: '/landing/people/product-designer.png', position: 'center 35%', tone: 'rose' },
  { role: 'Researcher', image: '/landing/people/researcher.png', position: 'center 22%', tone: 'ochre' },
  { role: 'Founder', image: '/landing/people/founder.png', position: 'center 30%', tone: 'blue' },
  { role: 'Content Strategist', image: '/landing/people/content-professional.png', position: 'center 34%', tone: 'peach' },
]

export function mountPeopleShowcase(host: HTMLElement): void {
  const gallery = document.createElement('div')
  gallery.className = 'people-gallery'

  identities.forEach((identity, index) => {
    const card = document.createElement('article')
    card.className = `identity-card identity-card--${identity.tone}${index === 0 ? ' is-active' : ''}`
    card.tabIndex = 0
    card.innerHTML = `
      <div class="identity-portrait">
        <img src="${identity.image}" alt="Generated avatar representing a ${identity.role}" style="object-position:${identity.position}" />
      </div>
      <p>${identity.role}</p>
    `
    const activate = () => {
      gallery.querySelectorAll('.identity-card').forEach((item) => item.classList.remove('is-active'))
      card.classList.add('is-active')
    }
    card.addEventListener('pointerenter', activate)
    card.addEventListener('focus', activate)
    gallery.append(card)
  })

  host.replaceChildren(gallery)
}
