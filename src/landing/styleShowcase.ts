type StyleVariant = { id: string; label: string; image: string; note: string }

const styles: StyleVariant[] = [
  { id: 'felt', label: 'Felt', image: '/landing/styles/felt.png', note: 'Warm, tactile and handcrafted' },
  { id: 'cartoon', label: 'Cartoon', image: '/landing/styles/cartoon.png', note: 'Bright, graphic and expressive' },
  { id: 'anime', label: 'Anime', image: '/landing/styles/anime.png', note: 'Illustrated, cinematic and distinctive' },
]

export function mountStyleShowcase(host: HTMLElement): void {
  host.innerHTML = `
    <article class="style-profile">
      <div class="style-copy">
        <span class="style-same-person">One profile · three supported styles</span>
        <p class="style-name">Mira Chen</p>
        <h3>Research lead turning complex ideas into clear product decisions.</h3>
        <dl><div><dt>Focus</dt><dd>Research strategy</dd></div><div><dt>Experience</dt><dd>8 years</dd></div><div><dt>Based in</dt><dd>Sydney</dd></div></dl>
        <div class="style-tabs" role="tablist" aria-label="Choose an avatar style"></div>
        <p class="style-note" aria-live="polite"></p>
      </div>
      <div class="style-visual"><span aria-hidden="true">Same person</span><img alt="Generated Felt avatar for Mira Chen" width="768" height="768" loading="lazy" decoding="async" /></div>
    </article>`

  const tabs = host.querySelector<HTMLElement>('.style-tabs')
  const visual = host.querySelector<HTMLElement>('.style-visual')
  const image = host.querySelector<HTMLImageElement>('.style-visual img')
  const note = host.querySelector<HTMLElement>('.style-note')
  if (!tabs || !visual || !image || !note) return

  const select = (style: StyleVariant, button: HTMLButtonElement) => {
    tabs.querySelectorAll<HTMLButtonElement>('button').forEach((item) => {
      const selected = item === button
      item.classList.toggle('is-active', selected)
      item.setAttribute('aria-selected', String(selected))
      item.tabIndex = selected ? 0 : -1
    })
    visual.classList.add('is-switching')
    window.setTimeout(() => {
      image.src = style.image
      image.alt = `Generated ${style.label} avatar for Mira Chen`
      note.textContent = style.note
      visual.dataset.style = style.id
      visual.classList.remove('is-switching')
    }, 120)
  }

  styles.forEach((style, index) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.role = 'tab'
    button.textContent = style.label
    button.setAttribute('aria-selected', String(index === 0))
    button.tabIndex = index === 0 ? 0 : -1
    if (index === 0) button.classList.add('is-active')
    button.addEventListener('click', () => select(style, button))
    button.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault()
      const nextIndex = (index + (event.key === 'ArrowRight' ? 1 : styles.length - 1)) % styles.length
      const nextButton = tabs.children.item(nextIndex) as HTMLButtonElement | null
      if (nextButton) { nextButton.focus(); select(styles[nextIndex], nextButton) }
    })
    tabs.append(button)
  })

  image.src = styles[0].image
  note.textContent = styles[0].note
  visual.dataset.style = styles[0].id
}
