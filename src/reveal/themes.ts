import type { ThemeName } from '../config'
import { isDarkColor } from '../core/color'
import hljsGithubDarkCss from '../generated/hljs-github-dark-css'
import hljsGithubCss from '../generated/hljs-github-css'
import blackCss from '../generated/theme-black-css'
import inkdropCss from '../generated/theme-inkdrop-css'
import leagueCss from '../generated/theme-league-css'
import nightCss from '../generated/theme-night-css'
import serifCss from '../generated/theme-serif-css'
import simpleCss from '../generated/theme-simple-css'
import whiteCss from '../generated/theme-white-css'

export interface ResolvedTheme {
  /** Structural sheets, injected after reveal.css and before highlight.js. */
  base: string[]
  /** Sheets injected after highlight.js so their code-block surfaces win. */
  overrides: string[]
  /** Which highlight.js sheet fits; 'auto' follows the app appearance. */
  dark: boolean | 'auto'
}

/**
 * The "inkdrop" theme reuses black.css for its structural rules (they only
 * read --r-* variables) and overrides the variables with the app's own.
 */
const REGISTRY: Record<ThemeName, ResolvedTheme> = {
  inkdrop: { base: [blackCss], overrides: [inkdropCss], dark: 'auto' },
  black: { base: [blackCss], overrides: [], dark: true },
  white: { base: [whiteCss], overrides: [], dark: false },
  league: { base: [leagueCss], overrides: [], dark: true },
  night: { base: [nightCss], overrides: [], dark: true },
  serif: { base: [serifCss], overrides: [], dark: false },
  simple: { base: [simpleCss], overrides: [], dark: false }
}

export function resolveTheme(name: ThemeName): ResolvedTheme {
  return REGISTRY[name]
}

export function getHighlightSheet(dark: boolean): string {
  return dark ? hljsGithubDarkCss : hljsGithubCss
}

/**
 * Detect the app's current appearance by probing the resolved editor
 * background. Runs against the live document (not the shadow root) so it
 * sees the same variables the inkdrop theme will inherit.
 */
export function isAppDark(): boolean {
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:absolute;visibility:hidden;pointer-events:none;' +
    'background-color:var(--editor-background, var(--editor-background-color, #1c1c1c));'
  document.body.appendChild(probe)
  const background = getComputedStyle(probe).backgroundColor
  probe.remove()
  return isDarkColor(background)
}
