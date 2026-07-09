// lib/common bundles ~40 popular languages instead of the full set (or
// Reveal's highlight plugin, which inlines all of highlight.js — ~1 MB).
import hljs from 'highlight.js/lib/common'
import Reveal from 'reveal.js'
import RevealMarkdown from 'reveal.js/plugin/markdown/markdown.esm.js'
import type { EffectiveDeckOptions } from '../core/deck-config'
import { prepareForShadowRoot } from '../core/css'
import { NOTES_SEPARATOR_REGEX } from '../core/notes'
import { SLIDE_SEPARATOR_REGEX, VSLIDE_SEPARATOR_REGEX } from '../core/split'
import resetCss from '../generated/reveal-reset-css'
import revealCss from '../generated/reveal-css'
import { getHighlightSheet, isAppDark, resolveTheme } from './themes'

export interface RevealManagerInit {
  /** Sentinel-joined markdown from the preprocessing pipeline. */
  markdown: string
  options: EffectiveDeckOptions
}

type ManagerState = 'idle' | 'initializing' | 'ready' | 'destroyed'

/**
 * Host sizing plus system font-stack fallbacks, injected BEFORE the theme so
 * a theme's own font variables win. Theme `@font-face`/`@import` rules are
 * stripped (they cannot load in a shadow root); themes that name webfonts
 * fall back to the next family in their own stacks.
 */
const BASE_CSS = `
:host {
  display: block;
  width: 100%;
  height: 100%;
  --r-main-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --r-heading-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --r-code-font: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.reveal {
  width: 100%;
  height: 100%;
}
`

/**
 * Owns the Reveal.js lifecycle inside a Shadow DOM attached to the host
 * element. The shadow boundary keeps Reveal's stylesheets away from the app
 * while still letting Inkdrop's CSS custom properties inherit through.
 */
export class RevealManager {
  private deck: Reveal.Api | null = null
  private state: ManagerState = 'idle'

  constructor(
    private readonly host: HTMLElement,
    private readonly init: RevealManagerInit
  ) {}

  getDeck(): Reveal.Api | null {
    return this.state === 'ready' ? this.deck : null
  }

  async initialize(): Promise<void> {
    if (this.state !== 'idle') return
    this.state = 'initializing'

    const root = this.host.shadowRoot ?? this.host.attachShadow({ mode: 'open' })
    root.replaceChildren()
    this.injectStyles(root)
    const viewport = this.buildDeckDom(root)

    const { options } = this.init
    const deck = new Reveal(viewport, {
      embedded: true,
      // All keyboard input is owned by key-controller.ts.
      keyboard: false,
      hash: false,
      respondToHashChanges: false,
      history: false,
      transition: options.transition,
      progress: options.showProgressBar,
      slideNumber: options.showSlideNumber ? 'c/t' : false,
      plugins: [RevealMarkdown]
    })

    await deck.initialize()

    if (this.state !== 'initializing') {
      // destroy() was called while initialize() was in flight (StrictMode
      // double-effect in dev, or rapid toggling).
      this.safeDestroyDeck(deck)
      return
    }
    this.highlightCodeBlocks(root)
    this.deck = deck
    this.state = 'ready'
  }

  /** RevealMarkdown has converted the slides by now; highlight in place. */
  private highlightCodeBlocks(root: ShadowRoot): void {
    for (const block of Array.from(root.querySelectorAll('pre code'))) {
      hljs.highlightElement(block as HTMLElement)
    }
  }

  destroy(): void {
    if (this.state === 'destroyed') return
    const previous = this.state
    this.state = 'destroyed'
    if (previous === 'ready' && this.deck) {
      this.safeDestroyDeck(this.deck)
    }
    this.deck = null
    this.host.shadowRoot?.replaceChildren()
  }

  private safeDestroyDeck(deck: Reveal.Api): void {
    try {
      deck.destroy()
    } catch {
      // Reveal 5 destroy() can throw when torn down at odd lifecycle moments;
      // the shadow root is cleared regardless.
    }
  }

  private injectStyles(root: ShadowRoot): void {
    const theme = resolveTheme(this.init.options.theme)
    const dark = theme.dark === 'auto' ? isAppDark() : theme.dark
    const sheets = [
      resetCss,
      revealCss,
      BASE_CSS,
      ...theme.base,
      getHighlightSheet(dark),
      ...theme.overrides
    ]
    for (const cssText of sheets) {
      const style = document.createElement('style')
      style.textContent = prepareForShadowRoot(cssText)
      root.appendChild(style)
    }
  }

  private buildDeckDom(root: ShadowRoot): HTMLElement {
    const viewport = document.createElement('div')
    viewport.className = 'reveal'
    const slides = document.createElement('div')
    slides.className = 'slides'

    const section = document.createElement('section')
    section.setAttribute('data-markdown', '')
    section.setAttribute('data-separator', SLIDE_SEPARATOR_REGEX)
    section.setAttribute('data-separator-vertical', VSLIDE_SEPARATOR_REGEX)
    section.setAttribute('data-separator-notes', NOTES_SEPARATOR_REGEX)

    // textContent (never innerHTML) so note content containing markup or
    // "</script>" cannot break out of the template element.
    const template = document.createElement('script')
    template.type = 'text/template'
    template.textContent = this.init.markdown
    section.appendChild(template)

    slides.appendChild(section)
    viewport.appendChild(slides)
    root.appendChild(viewport)
    return viewport
  }
}
