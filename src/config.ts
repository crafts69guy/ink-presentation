import type { ConfigSchema } from '@inkdropapp/types'
import { getEnv } from './env'

export const THEMES = ['inkdrop', 'black', 'white', 'league', 'night', 'serif', 'simple'] as const
export type ThemeName = (typeof THEMES)[number]

export const TRANSITIONS = ['none', 'fade', 'slide', 'convex', 'concave', 'zoom'] as const
export type TransitionName = (typeof TRANSITIONS)[number]

export const SPLIT_MODES = ['auto', 'hr', 'h1', 'h2'] as const
export type SplitMode = (typeof SPLIT_MODES)[number]

export interface PluginConfigValues {
  slideSeparator: SplitMode
  theme: ThemeName
  transition: TransitionName
  autoFullscreen: boolean
  showSlideNumber: boolean
  showProgressBar: boolean
  verticalSlides: boolean
  autoRefreshWhilePresenting: boolean
  showSampleCommand: boolean
}

export const configSchema: Record<keyof PluginConfigValues, ConfigSchema> = {
  slideSeparator: {
    title: 'Slide separator',
    description:
      'How to split a note into slides: "auto" picks the best rule per note ' +
      '(`---` if present, otherwise the heading level actually used), "hr" ' +
      'splits on `---`, "h1"/"h2" split on headings',
    type: 'string',
    default: 'auto',
    enum: [...SPLIT_MODES],
    order: 1
  },
  theme: {
    title: 'Theme',
    description: '"inkdrop" follows the app theme; others are Reveal.js built-ins',
    type: 'string',
    default: 'inkdrop',
    enum: [...THEMES],
    order: 2
  },
  transition: {
    title: 'Slide transition',
    type: 'string',
    default: 'slide',
    enum: [...TRANSITIONS],
    order: 3
  },
  autoFullscreen: {
    title: 'Enter fullscreen automatically',
    type: 'boolean',
    default: true,
    order: 4
  },
  showSlideNumber: {
    title: 'Show slide number',
    type: 'boolean',
    default: true,
    order: 5
  },
  showProgressBar: {
    title: 'Show progress bar',
    type: 'boolean',
    default: true,
    order: 6
  },
  verticalSlides: {
    title: 'Enable vertical slides (`--` separator in hr mode)',
    type: 'boolean',
    default: false,
    order: 7
  },
  autoRefreshWhilePresenting: {
    title: 'Auto-refresh the deck while presenting',
    description:
      'When the presented note changes (edited in another window, or synced ' +
      'from another device), rebuild the open deck in place, keeping the ' +
      'current slide position.',
    type: 'boolean',
    default: true,
    order: 8
  },
  showSampleCommand: {
    title: 'Show "Present Sample Deck" command',
    description:
      'Adds a command (and Plugins menu entry) to present a bundled sample ' +
      'note showcasing the plugin\'s features, without touching your notes.',
    type: 'boolean',
    default: true,
    order: 9
  }
}

export function getConfig<K extends keyof PluginConfigValues>(key: K): PluginConfigValues[K] {
  return getEnv().config.get(`ink-presentation.${key}`) as PluginConfigValues[K]
}

export function getAllConfig(): PluginConfigValues {
  return {
    slideSeparator: getConfig('slideSeparator'),
    theme: getConfig('theme'),
    transition: getConfig('transition'),
    autoFullscreen: getConfig('autoFullscreen'),
    showSlideNumber: getConfig('showSlideNumber'),
    showProgressBar: getConfig('showProgressBar'),
    verticalSlides: getConfig('verticalSlides'),
    autoRefreshWhilePresenting: getConfig('autoRefreshWhilePresenting'),
    showSampleCommand: getConfig('showSampleCommand')
  }
}
