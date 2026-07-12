import { describe, expect, it } from 'vitest'
import { splitSlides, joinWithSentinels, SLIDE_SENTINEL, VSLIDE_SENTINEL } from '../src/core/split'

describe('splitSlides — hr mode', () => {
  const opts = { mode: 'hr' as const, verticalSlides: false }

  it('splits on --- surrounded by blank lines', () => {
    const groups = splitSlides('# One\n\n---\n\n# Two', opts)
    expect(groups).toEqual([['# One'], ['# Two']])
  })

  it('does not split on setext-style --- (text directly above)', () => {
    const groups = splitSlides('Heading\n---\nbody', opts)
    expect(groups).toEqual([['Heading\n---\nbody']])
  })

  it('does not split on --- inside a code fence', () => {
    const md = 'a\n\n```\n\n---\n\n```\n\nb'
    const groups = splitSlides(md, opts)
    expect(groups).toHaveLength(1)
  })

  it('ignores -- when verticalSlides is off', () => {
    const groups = splitSlides('a\n\n--\n\nb', opts)
    expect(groups).toEqual([['a\n\n--\n\nb']])
  })

  it('splits -- vertically when verticalSlides is on', () => {
    const groups = splitSlides('a\n\n--\n\nb\n\n---\n\nc', { mode: 'hr', verticalSlides: true })
    expect(groups).toEqual([['a', 'b'], ['c']])
  })

  it('handles CRLF input', () => {
    const groups = splitSlides('one\r\n\r\n---\r\n\r\ntwo', opts)
    expect(groups).toEqual([['one'], ['two']])
  })
})

describe('splitSlides — h1 mode', () => {
  const opts = { mode: 'h1' as const, verticalSlides: false }

  it('starts a new slide at each H1', () => {
    const groups = splitSlides('# A\ncontent\n# B\nmore', opts)
    expect(groups).toEqual([['# A\ncontent'], ['# B\nmore']])
  })

  it('does not create an empty first slide when the note starts with H1', () => {
    const groups = splitSlides('# A\nbody', opts)
    expect(groups).toEqual([['# A\nbody']])
  })

  it('keeps preamble before the first heading as its own slide', () => {
    const groups = splitSlides('intro text\n# A\nbody', opts)
    expect(groups).toEqual([['intro text'], ['# A\nbody']])
  })

  it('ignores # lines inside code fences', () => {
    const md = '# A\n```bash\n# not a heading\n```\n# B'
    const groups = splitSlides(md, opts)
    expect(groups).toEqual([['# A\n```bash\n# not a heading\n```'], ['# B']])
  })

  it('does not split on H2 in h1 mode', () => {
    const groups = splitSlides('# A\n## sub\ntext', opts)
    expect(groups).toEqual([['# A\n## sub\ntext']])
  })
})

describe('splitSlides — h2 mode', () => {
  const opts = { mode: 'h2' as const, verticalSlides: false }

  it('H1 starts a horizontal group, H2 stacks vertically inside it', () => {
    const groups = splitSlides('# A\nintro\n## A1\none\n## A2\ntwo\n# B\nend', opts)
    expect(groups).toEqual([['# A\nintro', '## A1\none', '## A2\ntwo'], ['# B\nend']])
  })

  it('handles a note with only H2 headings', () => {
    const groups = splitSlides('## X\na\n## Y\nb', opts)
    expect(groups).toEqual([['## X\na', '## Y\nb']])
  })
})

describe('splitSlides — auto mode', () => {
  const opts = { mode: 'auto' as const, verticalSlides: false }

  it('prefers --- over headings when both are present', () => {
    const groups = splitSlides('# One\n\n---\n\n# Two', opts)
    expect(groups).toEqual([['# One'], ['# Two']])
  })

  it('does not let a setext-style --- (text directly above) count as a separator, falling through to headings', () => {
    const groups = splitSlides('Heading\n---\nbody\n# A\nmore', opts)
    expect(groups).toEqual([['Heading\n---\nbody'], ['# A\nmore']])
  })

  it('splits like h1 mode when only H1 headings are present', () => {
    const groups = splitSlides('# A\ncontent\n# B\nmore', opts)
    expect(groups).toEqual([['# A\ncontent'], ['# B\nmore']])
  })

  it('splits like h2 mode (H1 horizontal, H2 vertical) when both H1 and H2 are present', () => {
    const groups = splitSlides('# A\nintro\n## A1\none\n## A2\ntwo\n# B\nend', opts)
    expect(groups).toEqual([['# A\nintro', '## A1\none', '## A2\ntwo'], ['# B\nend']])
  })

  it('promotes H2 to a flat horizontal splitter when only H2 headings are present', () => {
    const groups = splitSlides('## X\na\n## Y\nb', opts)
    expect(groups).toEqual([['## X\na'], ['## Y\nb']])
  })

  it('returns a single slide when neither --- nor headings are present', () => {
    const groups = splitSlides('just some text\nmore text', opts)
    expect(groups).toEqual([['just some text\nmore text']])
  })

  it('ignores --- inside a fenced code block when resolving, falling back to headings', () => {
    const md = '# A\n```\n---\n```\n# B'
    const groups = splitSlides(md, opts)
    expect(groups).toEqual([['# A\n```\n---\n```'], ['# B']])
  })

  it('ignores # and ## inside a fenced code block when resolving, falling back to a single slide', () => {
    const md = 'intro\n```\n# not a heading\n## also not\n```\nmore text'
    const groups = splitSlides(md, opts)
    expect(groups).toEqual([['intro\n```\n# not a heading\n## also not\n```\nmore text']])
  })

  it('handles CRLF input when resolving to h1-like behavior', () => {
    const groups = splitSlides('# A\r\ncontent\r\n# B\r\nmore', opts)
    expect(groups).toEqual([['# A\ncontent'], ['# B\nmore']])
  })

  it('ignores -- when resolved to hr and verticalSlides is off', () => {
    const groups = splitSlides('a\n\n--\n\nb\n\n---\n\nc', opts)
    expect(groups).toEqual([['a\n\n--\n\nb'], ['c']])
  })

  it('splits -- vertically when resolved to hr and verticalSlides is on', () => {
    const groups = splitSlides('a\n\n--\n\nb\n\n---\n\nc', { mode: 'auto', verticalSlides: true })
    expect(groups).toEqual([['a', 'b'], ['c']])
  })
})

describe('splitSlides — degenerate input', () => {
  it('returns a single empty slide for an empty body', () => {
    expect(splitSlides('', { mode: 'hr', verticalSlides: false })).toEqual([['']])
  })

  it('drops blank slides produced by consecutive separators', () => {
    const groups = splitSlides('a\n\n---\n\n---\n\nb', { mode: 'hr', verticalSlides: false })
    expect(groups).toEqual([['a'], ['b']])
  })
})

describe('joinWithSentinels', () => {
  it('joins groups horizontally and stacks vertically', () => {
    const doc = joinWithSentinels([['a', 'b'], ['c']])
    expect(doc).toBe(`a\n${VSLIDE_SENTINEL}\nb\n${SLIDE_SENTINEL}\nc`)
  })
})
