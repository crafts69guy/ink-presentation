import { describe, expect, it } from 'vitest'
import { decodeMathTex, MATH_DISPLAY_ATTR, MATH_TEX_ATTR, transformMath } from '../src/core/math'

/** Pull the encoded TeX payloads out of the transformed markdown. */
function payloads(text: string): string[] {
  const re = new RegExp(`${MATH_TEX_ATTR}="([^"]*)"`, 'g')
  return Array.from(text.matchAll(re), match => decodeURIComponent(match[1] as string))
}

describe('transformMath', () => {
  it('replaces inline math with an empty placeholder span', () => {
    const out = transformMath('Euler: $e^{i\\pi} + 1 = 0$ is neat')
    expect(out).toContain(`<span ${MATH_TEX_ATTR}=`)
    expect(out).not.toContain(MATH_DISPLAY_ATTR)
    expect(out).not.toContain('$e^{i\\pi}')
    expect(payloads(out)).toEqual(['e^{i\\pi} + 1 = 0'])
  })

  it('preserves markdown-hostile TeX exactly (underscores, backslashes, asterisks)', () => {
    const tex = 'a_i * b_j \\\\ \\text{sum}_{k=0}'
    expect(payloads(transformMath(`$${tex}$`))).toEqual([tex])
  })

  it('handles multiple inline segments on one line', () => {
    const out = transformMath('$a$ plus $b$ equals $c$')
    expect(payloads(out)).toEqual(['a', 'b', 'c'])
  })

  it('replaces same-line display math with a display placeholder', () => {
    const out = transformMath('$$E = mc^2$$')
    expect(out).toContain(MATH_DISPLAY_ATTR)
    expect(payloads(out)).toEqual(['E = mc^2'])
  })

  it('replaces a multi-line $$ block with a single display placeholder', () => {
    const out = transformMath('before\n\n$$\n\\sum_{i=0}^n i = \\frac{n(n+1)}{2}\n$$\n\nafter')
    expect(payloads(out)).toEqual(['\\sum_{i=0}^n i = \\frac{n(n+1)}{2}'])
    expect(out).toContain(MATH_DISPLAY_ATTR)
    expect(out.split('\n')).toContain(`<span ${MATH_TEX_ATTR}="${encodeURIComponent('\\sum_{i=0}^n i = \\frac{n(n+1)}{2}')}" ${MATH_DISPLAY_ATTR}=""></span>`)
  })

  it('captures content on the $$ delimiter lines themselves', () => {
    const out = transformMath('$$a +\nb$$')
    expect(payloads(out)).toEqual(['a +\nb'])
  })

  it('does not misread currency amounts as math', () => {
    const text = 'It costs $5 and $10 today, or $20,000 total'
    expect(transformMath(text)).toBe(text)
  })

  it('rejects a closer directly followed by a digit', () => {
    const text = 'pay $x$4 now'
    expect(transformMath(text)).toBe(text)
  })

  it('respects escaped dollars', () => {
    const text = 'literal \\$100 stays \\$'
    expect(transformMath(text)).toBe(text)
  })

  it('restores escaped dollars inside TeX as \\$', () => {
    expect(payloads(transformMath('$a = \\$5$'))).toEqual(['a = \\$5'])
  })

  it('never touches fenced code', () => {
    const text = '```sh\necho $HOME and $PATH\n```\n\n$$\nx\n$$'
    const out = transformMath(text)
    expect(out).toContain('echo $HOME and $PATH')
    expect(payloads(out)).toEqual(['x'])
  })

  it('never touches inline code spans', () => {
    const text = 'run `echo $a and $b` please'
    expect(transformMath(text)).toBe(text)
  })

  it('still finds math after an inline code span on the same line', () => {
    const out = transformMath('`$notmath$` but $x$ is')
    expect(payloads(out)).toEqual(['x'])
    expect(out).toContain('`$notmath$`')
  })

  it('leaves a $$ block literal when it swallowed a code fence', () => {
    const text = '$$\n```\ncode\n```\n$$'
    expect(transformMath(text)).toBe(text)
  })

  it('leaves an unterminated $$ block literal', () => {
    const text = 'para\n\n$$\nnever closed'
    expect(transformMath(text)).toBe(text)
  })

  it('leaves empty delimiters literal', () => {
    expect(transformMath('$ $ and $$$$')).toBe('$ $ and $$$$')
    expect(transformMath('$$\n$$')).toBe('$$\n$$')
  })

  it('skips lines indented like code blocks', () => {
    const text = '    indented code with $x$'
    expect(transformMath(text)).toBe(text)
  })

  it('transforms math inside headings', () => {
    const out = transformMath('# Euler: $e^{i\\pi}$')
    expect(out).toMatch(/^# Euler: <span /)
    expect(payloads(out)).toEqual(['e^{i\\pi}'])
  })

  it('encodes attribute-breaking characters', () => {
    const out = transformMath('$a<b \\text{"q"} & c$')
    // The raw payload must not be able to close the attribute or open a tag.
    const attr = /data-ink-math="([^"]*)"/.exec(out)?.[1] as string
    expect(attr).not.toMatch(/[<>"&]/)
    expect(decodeURIComponent(attr)).toBe('a<b \\text{"q"} & c')
  })
})

describe('decodeMathTex', () => {
  it('round-trips encoded TeX', () => {
    expect(decodeMathTex(encodeURIComponent('\\frac{a}{b} % 100'))).toBe('\\frac{a}{b} % 100')
  })

  it('returns null for malformed encodings instead of throwing', () => {
    expect(decodeMathTex('%')).toBeNull()
  })
})
