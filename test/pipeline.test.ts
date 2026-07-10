import { describe, expect, it } from 'vitest'
import type { PluginConfigValues } from '../src/config'
import { NOTES_SEPARATOR_REGEX } from '../src/core/notes'
import { prepareDeck } from '../src/core/pipeline'
import { SLIDE_SEPARATOR_REGEX, VSLIDE_SEPARATOR_REGEX } from '../src/core/split'

const pluginDefaults: PluginConfigValues = {
  slideSeparator: 'hr',
  theme: 'inkdrop',
  transition: 'slide',
  autoFullscreen: true,
  showSlideNumber: true,
  showProgressBar: true,
  verticalSlides: false,
  showSampleCommand: true
}

/**
 * Faithful replica of RevealMarkdown 5.2.1's slidify() exec loop (see
 * plugin/markdown/markdown.esm.js, function i). Used as a golden oracle:
 * whatever we hand Reveal must terminate and produce the expected slide
 * shape with our sentinel separators.
 */
function slidifyOracle(
  markdown: string,
  separator: string,
  verticalSeparator: string
): Array<string | string[]> {
  const combined = new RegExp(`${separator}|${verticalSeparator}`, 'mg')
  const horizontal = new RegExp(separator)
  let match: RegExpExecArray | null
  let isHorizontal: boolean
  let wasHorizontal = true
  let content: string
  let lastIndex = 0
  let iterations = 0
  const sectionStack: Array<string | string[]> = []

  while ((match = combined.exec(markdown))) {
    if (++iterations > 10_000) throw new Error('slidify infinite loop detected')
    isHorizontal = horizontal.test(match[0])
    if (!isHorizontal && wasHorizontal) sectionStack.push([])
    content = markdown.substring(lastIndex, match.index)
    if (isHorizontal && wasHorizontal) {
      sectionStack.push(content)
    } else {
      ;(sectionStack[sectionStack.length - 1] as string[]).push(content)
    }
    lastIndex = combined.lastIndex
    wasHorizontal = isHorizontal
  }
  ;((wasHorizontal ? sectionStack : sectionStack[sectionStack.length - 1]) as string[]).push(
    markdown.substring(lastIndex)
  )
  return sectionStack
}

describe('prepareDeck', () => {
  it('produces a deck whose sentinels slidify cleanly (hr mode)', () => {
    const body = '---\ntransition: fade\n---\n\n# One\n\n---\n\n# Two\n\n---\n\n# Three'
    const deck = prepareDeck(body, pluginDefaults)
    expect(deck.slideCount).toBe(3)
    expect(deck.options.transition).toBe('fade')

    const sections = slidifyOracle(deck.markdown, SLIDE_SEPARATOR_REGEX, VSLIDE_SEPARATOR_REGEX)
    expect(sections).toHaveLength(3)
    expect(sections[0]).toContain('# One')
  })

  it('never lets frontmatter become a slide in hr mode', () => {
    const body = '---\ntheme: black\n---\n\nfirst slide content'
    const deck = prepareDeck(body, pluginDefaults)
    expect(deck.slideCount).toBe(1)
    expect(deck.markdown).not.toContain('theme: black')
  })

  it('handles h2 mode with vertical stacks through the oracle', () => {
    const body = '# A\nintro\n## A1\none\n# B\nend'
    const deck = prepareDeck(body, { ...pluginDefaults, slideSeparator: 'h2' })
    expect(deck.slideCount).toBe(3)

    const sections = slidifyOracle(deck.markdown, SLIDE_SEPARATOR_REGEX, VSLIDE_SEPARATOR_REGEX)
    expect(sections).toHaveLength(2)
    expect(Array.isArray(sections[0])).toBe(true)
    expect((sections[0] as string[])[0]).toContain('# A')
    expect((sections[0] as string[])[1]).toContain('## A1')
  })

  it('keeps exactly one Note: separator per slide for Reveal to attach', () => {
    const body = 'content\n<!-- note: a -->\n<!-- note: b -->\nNote: c'
    const deck = prepareDeck(body, pluginDefaults)
    const notesRe = new RegExp(NOTES_SEPARATOR_REGEX, 'mgi')
    const parts = deck.markdown.split(notesRe)
    // RevealMarkdown attaches notes only when the split yields exactly 2 parts.
    expect(parts).toHaveLength(2)
    expect(parts[1]).toContain('a')
    expect(parts[1]).toContain('b')
    expect(parts[1]).toContain('c')
  })

  it('handles auto mode promoting H2 to horizontal when no H1 is present', () => {
    const body = '## X\na\n## Y\nb'
    const deck = prepareDeck(body, { ...pluginDefaults, slideSeparator: 'auto' })
    expect(deck.slideCount).toBe(2)

    const sections = slidifyOracle(deck.markdown, SLIDE_SEPARATOR_REGEX, VSLIDE_SEPARATOR_REGEX)
    expect(sections).toHaveLength(2)
  })

  it('frontmatter separator override changes the split mode', () => {
    const body = '---\nseparator: h1\n---\n# A\ntext\n# B'
    const deck = prepareDeck(body, pluginDefaults)
    expect(deck.options.separator).toBe('h1')
    expect(deck.slideCount).toBe(2)
  })

  it('is resilient to an empty note body', () => {
    const deck = prepareDeck('', pluginDefaults)
    expect(deck.slideCount).toBe(1)
    expect(deck.warnings).toEqual([])
  })

  it('a note that is a single fenced code block stays one slide', () => {
    const body = '```md\n# fake\n\n---\n\nfake\n```'
    const deck = prepareDeck(body, { ...pluginDefaults, slideSeparator: 'h1' })
    expect(deck.slideCount).toBe(1)
    expect(deck.markdown).toBe(body)
  })
})
