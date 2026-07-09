import type { PluginConfigValues } from '../config'
import { mergeDeckOptions, parseDeckConfig, type EffectiveDeckOptions } from './deck-config'
import { extractFrontmatter } from './frontmatter'
import { buildSlideMarkdown } from './notes'
import { joinWithSentinels, splitSlides } from './split'

export interface PreparedDeck {
  /** Sentinel-joined markdown ready for RevealMarkdown. */
  markdown: string
  options: EffectiveDeckOptions
  warnings: string[]
  slideCount: number
}

/**
 * The full note-body → deck transformation:
 * frontmatter → option merge → fence-aware slide split → per-slide note
 * normalization → sentinel-joined document.
 */
export function prepareDeck(body: string, pluginConfig: PluginConfigValues): PreparedDeck {
  const frontmatter = extractFrontmatter(body)
  const deckConfig = parseDeckConfig(frontmatter.data)
  const options = mergeDeckOptions(pluginConfig, deckConfig.config)

  const groups = splitSlides(frontmatter.body, {
    mode: options.separator,
    verticalSlides: options.verticalSlides
  })
  const normalized = groups.map(group => group.map(buildSlideMarkdown))

  return {
    markdown: joinWithSentinels(normalized),
    options,
    warnings: [...frontmatter.warnings, ...deckConfig.warnings],
    slideCount: normalized.reduce((count, group) => count + group.length, 0)
  }
}
