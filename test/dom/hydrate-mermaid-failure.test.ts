import { describe, expect, it, vi } from 'vitest'
import { DeckHydrator } from '../../src/reveal/hydrate'

// Separate file from hydrate.test.ts: the module-level import cache in
// hydrate.ts would otherwise leak the rejected import into the other tests.
vi.mock('mermaid', () => {
  throw new Error('module broken')
})

describe('DeckHydrator when the mermaid module fails to load', () => {
  it('degrades every diagram to an inline error and keeps the slide alive', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = host.attachShadow({ mode: 'open' })
    root.innerHTML =
      '<div class="reveal"><div class="slides"><section>' +
      '<pre><code class="mermaid">graph TD; A</code></pre>' +
      '<pre><code class="mermaid">graph TD; B</code></pre>' +
      '<pre><code class="language-js">const x = 1</code></pre>' +
      '</section></div></div>'
    const hydrator = new DeckHydrator(root, { dark: true, inkdropNative: false })
    const section = root.querySelector<HTMLElement>('.slides section')
    if (!section) throw new Error('missing section')

    const result = await hydrator.hydrateSection(section)

    const errors = Array.from(root.querySelectorAll('pre.mermaid-error'))
    expect(errors).toHaveLength(2)
    for (const node of errors) {
      expect(node.textContent).toContain('Mermaid failed to load')
    }
    // The rest of the slide still hydrates: code highlighting ran.
    expect(root.querySelector('code.hljs')).not.toBeNull()
    expect(result.rendered).toBe(true)
  })
})
