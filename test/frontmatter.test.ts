import { describe, expect, it } from 'vitest'
import { extractFrontmatter } from '../src/core/frontmatter'

describe('extractFrontmatter', () => {
  it('returns body unchanged when there is no frontmatter', () => {
    const md = '# Title\n\nHello'
    expect(extractFrontmatter(md)).toEqual({ data: null, body: md, warnings: [] })
  })

  it('parses and strips a frontmatter block', () => {
    const md = '---\ntheme: black\ntransition: fade\n---\n\n# Slide 1'
    const result = extractFrontmatter(md)
    expect(result.data).toEqual({ theme: 'black', transition: 'fade' })
    expect(result.body).toBe('\n# Slide 1')
    expect(result.warnings).toEqual([])
  })

  it('handles CRLF line endings', () => {
    const md = '---\r\ntheme: white\r\n---\r\n# Slide'
    const result = extractFrontmatter(md)
    expect(result.data).toEqual({ theme: 'white' })
    expect(result.body).toBe('# Slide')
  })

  it('does not treat a mid-document --- pair as frontmatter', () => {
    const md = '# Intro\n\n---\ntheme: black\n---\n'
    const result = extractFrontmatter(md)
    expect(result.data).toBeNull()
    expect(result.body).toBe(md)
  })

  it('strips but warns on invalid YAML', () => {
    const md = '---\n{ not: [valid\n---\n# Slide'
    const result = extractFrontmatter(md)
    expect(result.data).toBeNull()
    expect(result.body).toBe('# Slide')
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toMatch(/invalid YAML/i)
  })

  it('handles a frontmatter-only note', () => {
    const md = '---\ntheme: black\n---'
    const result = extractFrontmatter(md)
    expect(result.data).toEqual({ theme: 'black' })
    expect(result.body).toBe('')
  })
})
