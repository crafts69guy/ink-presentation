import { describe, expect, it } from 'vitest'
import { mergeDeckOptions, parseDeckConfig } from '../src/core/deck-config'
import type { PluginConfigValues } from '../src/config'

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

describe('parseDeckConfig', () => {
  it('accepts an empty/absent frontmatter', () => {
    expect(parseDeckConfig(null)).toEqual({ config: {}, warnings: [] })
    expect(parseDeckConfig(undefined)).toEqual({ config: {}, warnings: [] })
  })

  it('parses valid keys', () => {
    const { config, warnings } = parseDeckConfig({
      theme: 'black',
      transition: 'fade',
      separator: 'h2',
      slideNumber: false,
      progress: false,
      verticalSlides: true
    })
    expect(config).toEqual({
      theme: 'black',
      transition: 'fade',
      separator: 'h2',
      slideNumber: false,
      progress: false,
      verticalSlides: true
    })
    expect(warnings).toEqual([])
  })

  it('accepts the auto separator value', () => {
    const { config, warnings } = parseDeckConfig({ separator: 'auto' })
    expect(config).toEqual({ separator: 'auto' })
    expect(warnings).toEqual([])
  })

  it('warns on invalid values but keeps the rest', () => {
    const { config, warnings } = parseDeckConfig({ theme: 'neon', transition: 'fade' })
    expect(config).toEqual({ transition: 'fade' })
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('neon')
  })

  it('accepts a css string and warns on non-string css', () => {
    const ok = parseDeckConfig({ css: '.reveal h1 { color: tomato; }' })
    expect(ok.config).toEqual({ css: '.reveal h1 { color: tomato; }' })
    expect(ok.warnings).toEqual([])

    const bad = parseDeckConfig({ css: ['not', 'a', 'string'] })
    expect(bad.config).toEqual({})
    expect(bad.warnings).toHaveLength(1)
    expect(bad.warnings[0]).toContain('css')
  })

  it('silently ignores foreign frontmatter keys', () => {
    const { config, warnings } = parseDeckConfig({ tags: ['x'], created: '2026-01-01' })
    expect(config).toEqual({})
    expect(warnings).toEqual([])
  })

  it('warns when frontmatter is not a mapping', () => {
    const { warnings } = parseDeckConfig(['a', 'b'])
    expect(warnings).toHaveLength(1)
  })
})

describe('mergeDeckOptions', () => {
  it('uses plugin config when frontmatter is empty', () => {
    const merged = mergeDeckOptions(pluginDefaults, {})
    expect(merged).toEqual({
      theme: 'inkdrop',
      transition: 'slide',
      separator: 'hr',
      showSlideNumber: true,
      showProgressBar: true,
      verticalSlides: false,
      autoFullscreen: true,
      customCss: ''
    })
  })

  it('carries frontmatter css into customCss', () => {
    const merged = mergeDeckOptions(pluginDefaults, { css: '.reveal { --r-heading-color: teal; }' })
    expect(merged.customCss).toBe('.reveal { --r-heading-color: teal; }')
  })

  it('lets frontmatter win, including explicit false', () => {
    const merged = mergeDeckOptions(pluginDefaults, {
      theme: 'white',
      slideNumber: false,
      separator: 'h1'
    })
    expect(merged.theme).toBe('white')
    expect(merged.showSlideNumber).toBe(false)
    expect(merged.separator).toBe('h1')
    expect(merged.transition).toBe('slide')
  })
})
