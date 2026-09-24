type StyleVariant = { id: string; label: string; image: string; note: string }

const styles: StyleVariant[] = [
  { id: 'felt', label: 'Felt', image: '/landing/styles/felt.png', note: 'Warm and tactile' },
  { id: 'cartoon', label: 'Cartoon', image: '/landing/styles/cartoon.png', note: 'Bright and expressive' },
  { id: 'anime', label: 'Anime', image: '/landing/styles/anime.png', note: 'Illustrated and cinematic' },
]

export function mountStyleShowcase(host: HTMLElement): void {
  host.innerHTML = `
    <div class="style-stage" data-style="felt">
      <div class="style-orbit" aria-hidden="true"></div>
      <div class="style-preview">
        <div class="style-selected">
          <span>Selected look</span>
          <img src="${styles[0].image}" alt="Generated Felt avatar for the same professional" width="768" height="768" loading="lazy" decoding="async" />
        </div>
      </div>
      <div class="style-content">
        <p class="eyebrow">Styles</p>
        <h2 id="styles-title">Same person. Different energy.</h2>
        <p class="style-intro">Choose a visual style that still feels like you.</p>
        <p class="style-current"><strong>${styles[0].label}</strong><span>${styles[0].note}</span></p>
        <div class="style-thumbnails" role="tablist" aria-label="Choose an avatar style"></div>
        <a class="style-cta" href="/dashboard/avatar" aria-label="Use Felt style">Use this style →</a>
      </div>
      <dl class="style-benefits"><div><dt>Identity</dt><dd>One professional</dd></div><div><dt>Looks</dt><dd>${styles.length} real styles</dd></div><div><dt>Switch</dt><dd>Instant preview</dd></div></dl>
    </div>`

  const stage = host.querySelector<HTMLElement>('.style-stage')
  const image = host.querySelector<HTMLImageElement>('.style-selected img')
  const label = host.querySelector<HTMLElement>('.style-current strong')
  const note = host.querySelector<HTMLElement>('.style-current span')
  const tabs = host.querySelector<HTMLElement>('.style-thumbnails')
  const cta = host.querySelector<HTMLAnchorElement>('.style-cta')
  if (!stage || !image || !label || !note || !tabs || !cta) return

  const select = (style: StyleVariant, button: HTMLButtonElement) => {
    tabs.querySelectorAll<HTMLButtonElement>('button').forEach((item) => {
      const selected = item === button
      item.classList.toggle('is-active', selected)
      item.setAttribute('aria-selected', String(selected))
      item.tabIndex = selected ? 0 : -1
    })
    stage.classList.add('is-switching')
    window.setTimeout(() => {
      image.src = style.image
      image.alt = `Generated ${style.label} avatar for the same professional`
      label.textContent = style.label
      note.textContent = style.note
      cta.setAttribute('aria-label', `Use ${style.label} style`)
      stage.dataset.style = style.id
      stage.classList.remove('is-switching')
    }, 120)
  }

  styles.forEach((style, index) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.role = 'tab'
    button.setAttribute('aria-label', `Preview ${style.label} style`)
    button.setAttribute('aria-selected', String(index === 0))
    button.tabIndex = index === 0 ? 0 : -1
    button.innerHTML = `<img src="${style.image}" alt="" width="768" height="768" loading="lazy" decoding="async" /><span>${style.label}</span>`
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
}
