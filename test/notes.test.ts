import { describe, expect, it } from 'vitest'
import { buildSlideMarkdown, extractSlideNotes } from '../src/core/notes'

describe('extractSlideNotes', () => {
  it('returns content untouched when there are no notes', () => {
    expect(extractSlideNotes('# A\nbody')).toEqual({ content: '# A\nbody', notes: '' })
  })

  it('extracts an HTML note comment', () => {
    const { content, notes } = extractSlideNotes('# A\n<!-- note: say hi -->\nbody')
    expect(notes).toBe('say hi')
    expect(content).toContain('body')
    expect(content).not.toContain('note:')
  })

  it('supports the notes: variant and multiline comments', () => {
    const { notes } = extractSlideNotes('x\n<!-- NOTES:\nline one\nline two\n-->')
    expect(notes).toBe('line one\nline two')
  })

  it('extracts a literal Note: line and everything after it', () => {
    const { content, notes } = extractSlideNotes('# A\nbody\nNote: first\nsecond line')
    expect(content).toBe('# A\nbody')
    expect(notes).toBe('first\nsecond line')
  })

  it('merges comment notes and Note: line into one block', () => {
    const { notes } = extractSlideNotes('<!-- note: alpha -->\ntext\nNote: beta')
    expect(notes).toBe('alpha\n\nbeta')
  })

  it('ignores note markers inside code fences', () => {
    const slide = '```\nNote: not a note\n<!-- note: nope -->\n```\nreal content'
    const { content, notes } = extractSlideNotes(slide)
    expect(notes).toBe('')
    expect(content).toBe(slide)
  })
})

describe('buildSlideMarkdown', () => {
  it('emits at most one Note: block per slide', () => {
    const out = buildSlideMarkdown('<!-- note: a -->\ncontent\n<!-- note: b -->')
    const separatorMatches = out.match(/^Note:/gm) ?? []
    expect(separatorMatches).toHaveLength(1)
    expect(out).toContain('a')
    expect(out).toContain('b')
  })

  it('passes through a slide without notes', () => {
    expect(buildSlideMarkdown('just content')).toBe('just content')
  })
})
