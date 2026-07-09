import { describe, expect, it } from 'vitest'
import { maskFences } from '../src/core/fences'

describe('maskFences', () => {
  it('masks a fenced block and restores it byte-identical', () => {
    const text = 'before\n```js\nconst a = 1\n```\nafter'
    const { masked, restore } = maskFences(text)
    expect(masked).not.toContain('const a = 1')
    expect(masked).toContain('before')
    expect(masked).toContain('after')
    expect(restore(masked)).toBe(text)
  })

  it('masks multiple blocks independently', () => {
    const text = '```\na\n```\nmiddle\n~~~\nb\n~~~'
    const { masked, restore } = maskFences(text)
    expect(masked).not.toContain('a')
    expect(masked).not.toContain('b')
    expect(restore(masked)).toBe(text)
  })

  it('does not close a backtick fence with a tilde fence', () => {
    const text = '```\ncode\n~~~\nstill code\n```\nout'
    const { masked, restore } = maskFences(text)
    expect(masked).not.toContain('still code')
    expect(restore(masked)).toBe(text)
  })

  it('keeps an unterminated fence masked to end of text', () => {
    const text = 'para\n```\nnever closed'
    const { masked, restore } = maskFences(text)
    expect(masked).not.toContain('never closed')
    expect(restore(masked)).toBe(text)
  })

  it('leaves fence-free text untouched', () => {
    const text = 'just\nlines'
    const { masked, restore } = maskFences(text)
    expect(masked).toBe(text)
    expect(restore(masked)).toBe(text)
  })
})
