import {
  SPLIT_MODES,
  THEMES,
  TRANSITIONS,
  type PluginConfigValues,
  type SplitMode,
  type ThemeName,
  type TransitionName
} from '../config'

/** Per-note overrides declared in YAML frontmatter. */
export interface DeckConfig {
  theme?: ThemeName
  transition?: TransitionName
  separator?: SplitMode
  slideNumber?: boolean
  progress?: boolean
  verticalSlides?: boolean
  /** Raw note-authored CSS; hardened at injection time (reveal-manager). */
  css?: string
}

export interface DeckConfigResult {
  config: DeckConfig
  warnings: string[]
}

/** Everything the presentation needs, after merging plugin config ⊕ frontmatter. */
export interface EffectiveDeckOptions {
  theme: ThemeName
  transition: TransitionName
  separator: SplitMode
  showSlideNumber: boolean
  showProgressBar: boolean
  verticalSlides: boolean
  autoFullscreen: boolean
  /** Frontmatter-only (no plugin setting); empty string = none. */
  customCss: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function oneOf<T extends string>(allowed: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
}

/**
 * Narrow unknown frontmatter data into a typed DeckConfig. Unknown keys and
 * invalid values are skipped with a warning rather than failing the deck.
 */
export function parseDeckConfig(data: unknown): DeckConfigResult {
  if (data === null || data === undefined) {
    return { config: {}, warnings: [] }
  }
  if (!isRecord(data)) {
    return { config: {}, warnings: ['Frontmatter is not a mapping; ignoring it.'] }
  }

  const config: DeckConfig = {}
  const warnings: string[] = []

  for (const [key, value] of Object.entries(data)) {
    switch (key) {
      case 'theme':
        if (oneOf(THEMES, value)) config.theme = value
        else warnings.push(`Unknown theme "${String(value)}" (expected: ${THEMES.join(', ')})`)
        break
      case 'transition':
        if (oneOf(TRANSITIONS, value)) config.transition = value
        else
          warnings.push(
            `Unknown transition "${String(value)}" (expected: ${TRANSITIONS.join(', ')})`
          )
        break
      case 'separator':
        if (oneOf(SPLIT_MODES, value)) config.separator = value
        else
          warnings.push(
            `Unknown separator "${String(value)}" (expected: ${SPLIT_MODES.join(', ')})`
          )
        break
      case 'slideNumber':
        if (typeof value === 'boolean') config.slideNumber = value
        else warnings.push(`"slideNumber" must be true or false`)
        break
      case 'progress':
        if (typeof value === 'boolean') config.progress = value
        else warnings.push(`"progress" must be true or false`)
        break
      case 'verticalSlides':
        if (typeof value === 'boolean') config.verticalSlides = value
        else warnings.push(`"verticalSlides" must be true or false`)
        break
      case 'css':
        if (typeof value === 'string') config.css = value
        else warnings.push(`"css" must be a string (use a YAML block scalar: css: |)`)
        break
      default:
        // Foreign frontmatter keys (tags, dates, …) are common — stay quiet.
        break
    }
  }

  return { config, warnings }
}

/** Frontmatter wins over plugin settings. */
export function mergeDeckOptions(
  pluginConfig: PluginConfigValues,
  deckConfig: DeckConfig
): EffectiveDeckOptions {
  return {
    theme: deckConfig.theme ?? pluginConfig.theme,
    transition: deckConfig.transition ?? pluginConfig.transition,
    separator: deckConfig.separator ?? pluginConfig.slideSeparator,
    showSlideNumber: deckConfig.slideNumber ?? pluginConfig.showSlideNumber,
    showProgressBar: deckConfig.progress ?? pluginConfig.showProgressBar,
    verticalSlides: deckConfig.verticalSlides ?? pluginConfig.verticalSlides,
    autoFullscreen: pluginConfig.autoFullscreen,
    customCss: deckConfig.css ?? ''
  }
}
