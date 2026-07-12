import { describe, expect, it } from 'vitest'
import { MATH_DISPLAY_ATTR, MATH_TEX_ATTR } from '../../src/core/math'
import { sanitizeSlideContent } from '../../src/reveal/sanitize'

/** Build the post-RevealMarkdown DOM shape: .slides > section (> section). */
function slidesFrom(html: string): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = `<div class="reveal"><div class="slides">${html}</div></div>`
  sanitizeSlideContent(root)
  const slides = root.querySelector('.slides')
  if (!(slides instanceof HTMLElement)) throw new Error('missing .slides')
  return slides
}

describe('sanitizeSlideContent', () => {
  it('strips script, iframe, and inline event handlers', () => {
    const slides = slidesFrom(
      '<section><h1>Hi</h1><script>window.pwned = true</script>' +
        '<iframe src="https://evil.example"></iframe>' +
        '<img src="x" onerror="window.pwned = true"></section>'
    )
    expect(slides.querySelector('script')).toBeNull()
    expect(slides.querySelector('iframe')).toBeNull()
    expect(slides.querySelector('img')?.hasAttribute('onerror')).toBe(false)
    expect(slides.querySelector('h1')?.textContent).toBe('Hi')
  })

  it('strips javascript: URLs and inline style tags', () => {
    const slides = slidesFrom(
      '<section><a href="javascript:alert(1)">x</a><style>.reveal{display:none}</style></section>'
    )
    expect(slides.querySelector('a')?.hasAttribute('href')).toBe(false)
    expect(slides.querySelector('style')).toBeNull()
  })

  it('keeps KaTeX math placeholders intact', () => {
    const slides = slidesFrom(
      `<section><span ${MATH_TEX_ATTR}="a%5E2" ${MATH_DISPLAY_ATTR}=""></span></section>`
    )
    const span = slides.querySelector(`span[${MATH_TEX_ATTR}]`)
    expect(span?.getAttribute(MATH_TEX_ATTR)).toBe('a%5E2')
    expect(span?.hasAttribute(MATH_DISPLAY_ATTR)).toBe(true)
  })

  it('keeps mermaid fences, highlight classes, notes asides, and images', () => {
    const slides = slidesFrom(
      '<section><pre><code class="mermaid">graph TD; A--&gt;B</code></pre>' +
        '<pre><code class="language-js">const x = 1</code></pre>' +
        '<aside class="notes">remember this</aside>' +
        '<img src="data:image/png;base64,AAAA" alt="inline">' +
        '<img src="https://example.com/x.png" alt="remote"></section>'
    )
    expect(slides.querySelector('pre code.mermaid')?.textContent).toBe('graph TD; A-->B')
    expect(slides.querySelector('pre code.language-js')?.textContent).toBe('const x = 1')
    expect(slides.querySelector('aside.notes')?.textContent).toBe('remember this')
    expect(slides.querySelectorAll('img')).toHaveLength(2)
  })

  it('cleans attributes RevealMarkdown copies onto the sections themselves', () => {
    const slides = slidesFrom(
      '<section onclick="window.pwned = true" data-background-iframe="https://evil.example"' +
        ' data-background-color="#123456"><p>x</p></section>'
    )
    const section = slides.querySelector('section')
    expect(section?.hasAttribute('onclick')).toBe(false)
    expect(section?.hasAttribute('data-background-iframe')).toBe(false)
    expect(section?.getAttribute('data-background-color')).toBe('#123456')
  })

  it('covers nested vertical-stack sections through the parent pass', () => {
    const slides = slidesFrom(
      '<section><section data-background-iframe="https://evil.example">' +
        '<img src="x" onerror="window.pwned = true"></section></section>'
    )
    const nested = slides.querySelector('section > section')
    expect(nested).not.toBeNull()
    expect(nested?.hasAttribute('data-background-iframe')).toBe(false)
    expect(nested?.querySelector('img')?.hasAttribute('onerror')).toBe(false)
  })
})
