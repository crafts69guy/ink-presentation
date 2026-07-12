import { describe, expect, it, vi } from 'vitest'
import { DeckHydrator, HYDRATED_ATTR } from '../../src/reveal/hydrate'

const mermaidMock = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn((id: string) => Promise.resolve({ svg: `<svg data-render-id="${id}"></svg>` }))
}))

vi.mock('mermaid', () => ({
  default: { initialize: mermaidMock.initialize, render: mermaidMock.render }
}))

/** Build the post-RevealMarkdown shadow DOM shape the hydrator works on. */
function makeRoot(sectionsHtml: string): ShadowRoot {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = host.attachShadow({ mode: 'open' })
  root.innerHTML = `<div class="reveal"><div class="slides">${sectionsHtml}</div></div>`
  return root
}

function leafSections(root: ShadowRoot): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('.slides section')).filter(
    section => section.querySelector('section') === null
  )
}

const theme = { dark: true, inkdropNative: false }

describe('DeckHydrator', () => {
  it('hydrates a section exactly once', async () => {
    const root = makeRoot(
      '<section><pre><code class="language-js">const x = 1</code></pre></section>'
    )
    const hydrator = new DeckHydrator(root, theme)
    const [section] = leafSections(root)
    if (!section) throw new Error('missing section')

    await hydrator.hydrateSection(section)

    expect(section.hasAttribute(HYDRATED_ATTR)).toBe(true)
    expect(section.querySelector('code.hljs')).not.toBeNull()

    const again = await hydrator.hydrateSection(section)
    expect(again.rendered).toBe(false)
  })

  it('hydrateAround covers current, document-order neighbors, and the vertical stack', async () => {
    const root = makeRoot(
      '<section id="s0"><p>a</p></section>' +
        '<section><section id="s1a"><p>b</p></section><section id="s1b"><p>c</p></section></section>' +
        '<section id="s2"><p>d</p></section>' +
        '<section id="s3"><p>far</p></section>'
    )
    const hydrator = new DeckHydrator(root, theme)
    const current = root.querySelector<HTMLElement>('#s1a')
    if (!current) throw new Error('missing current')

    await hydrator.hydrateAround(current)

    const hydratedIds = leafSections(root)
      .filter(section => section.hasAttribute(HYDRATED_ATTR))
      .map(section => section.id)
    expect(hydratedIds.sort()).toEqual(['s0', 's1a', 's1b'])
    expect(root.querySelector('#s3')?.hasAttribute(HYDRATED_ATTR)).toBe(false)
  })

  it('reports a current-slide change so the caller can relayout', async () => {
    const root = makeRoot(
      '<section id="s0"><pre><code class="mermaid">graph TD; A</code></pre></section>' +
        '<section id="s1"><p>plain</p></section>'
    )
    const hydrator = new DeckHydrator(root, theme)

    const withDiagram = await hydrator.hydrateAround(root.querySelector<HTMLElement>('#s0'))
    expect(withDiagram.currentChanged).toBe(true)
    expect(root.querySelector('#s0 .mermaid-diagram svg')).not.toBeNull()

    const plain = await hydrator.hydrateAround(root.querySelector<HTMLElement>('#s1'))
    expect(plain.currentChanged).toBe(false)
  })

  it('background idle hydration reaches every slide; stop() cancels it', async () => {
    const root = makeRoot(
      '<section><p>1</p></section><section><p>2</p></section><section><p>3</p></section>'
    )
    const hydrator = new DeckHydrator(root, theme)
    hydrator.startIdleHydration()

    await vi.waitFor(() => {
      expect(leafSections(root).every(section => section.hasAttribute(HYDRATED_ATTR))).toBe(true)
    })

    const stoppedRoot = makeRoot('<section><p>1</p></section><section><p>2</p></section>')
    const stopped = new DeckHydrator(stoppedRoot, theme)
    stopped.startIdleHydration()
    stopped.stop()
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(leafSections(stoppedRoot).some(section => section.hasAttribute(HYDRATED_ATTR))).toBe(
      false
    )
  })

  it('gives every mermaid render a unique id, even across concurrent hydrators', async () => {
    mermaidMock.render.mockClear()
    const rootA = makeRoot(
      '<section><pre><code class="mermaid">a</code></pre><pre><code class="mermaid">b</code></pre></section>'
    )
    const rootB = makeRoot('<section><pre><code class="mermaid">c</code></pre></section>')
    const hydratorA = new DeckHydrator(rootA, theme)
    const hydratorB = new DeckHydrator(rootB, theme)

    const [sectionA] = leafSections(rootA)
    const [sectionB] = leafSections(rootB)
    if (!sectionA || !sectionB) throw new Error('missing sections')
    await Promise.all([hydratorA.hydrateSection(sectionA), hydratorB.hydrateSection(sectionB)])

    const ids = mermaidMock.render.mock.calls.map(call => call[0])
    expect(ids).toHaveLength(3)
    expect(new Set(ids).size).toBe(3)
    for (const id of ids) expect(id).toMatch(/^ink-mermaid-\d+$/)
    // Serialized queue re-asserts config before each render.
    expect(mermaidMock.initialize.mock.calls.length).toBeGreaterThanOrEqual(3)
  })
})
