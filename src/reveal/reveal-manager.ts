import Reveal from 'reveal.js'
import RevealMarkdown from 'reveal.js/plugin/markdown/markdown.esm.js'
import type { EffectiveDeckOptions } from '../core/deck-config'
import { prepareForShadowRoot, stripRemoteUrls } from '../core/css'
import { NOTES_SEPARATOR_REGEX } from '../core/notes'
import { SLIDE_SEPARATOR_REGEX, VSLIDE_SEPARATOR_REGEX } from '../core/split'
import resetCss from '../generated/reveal-reset-css'
import revealCss from '../generated/reveal-css'
import { DeckHydrator } from './hydrate'
import { sanitizeSlideContent } from './sanitize'
import { getHighlightSheet, isAppDark, resolveTheme } from './themes'

export interface SlidePosition {
  h: number
  v: number
}

export interface RevealManagerInit {
  /** Sentinel-joined markdown from the preprocessing pipeline. */
  markdown: string
  options: EffectiveDeckOptions
  /** Restore position after a rebuild (settings/theme change mid-deck). */
  initialSlide?: SlidePosition
  /** Fired on ready and every slide change with the slide's speaker notes. */
  onSlideChanged?: (notes: string, position: SlidePosition) => void
  /**
   * Skip background idle hydration and render only the slides the deck
   * actually shows — for the speaker window's mini decks, which mirror a
   * deck that is already fully rendered elsewhere.
   */
  hydrateVisibleOnly?: boolean
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
.reveal .mermaid-diagram {
  display: flex;
  justify-content: center;
  padding: 1.5rem;
  border-radius: 12px;
  /* Card look matching Inkdrop's own preview panel: a dot-grid over the
   * code-block surface color, not something mermaid's theme controls. */
  background-color: var(--mde-preview-codeblock-background-color, rgba(127, 127, 127, 0.15));
  background-image: radial-gradient(circle, var(--border-color, rgba(127, 127, 127, 0.4)) 1px, transparent 1px);
  background-size: 18px 18px;
}
.reveal .mermaid-diagram svg {
  max-width: 100%;
  height: auto;
}
.reveal .mermaid-error {
  color: #e06c75;
  font-family: var(--r-code-font);
  white-space: pre-wrap;
}
/* Long equations scroll within the slide instead of overflowing it. */
.reveal .katex-display {
  overflow-x: auto;
  overflow-y: hidden;
}
`

/**
 * Owns the Reveal.js lifecycle inside a Shadow DOM attached to the host
 * element. The shadow boundary keeps Reveal's stylesheets away from the app
 * while still letting Inkdrop's CSS custom properties inherit through.
 *
 * Expensive slide content (mermaid/KaTeX/highlight.js) is NOT rendered up
 * front: `initialize()` resolves once the visible slide and its neighbors
 * are hydrated, and the rest of the deck fills in on idle time or on
 * navigation (see `reveal/hydrate.ts`).
 */
export class RevealManager {
  private deck: Reveal.Api | null = null
  private state: ManagerState = 'idle'
  private resizeObserver: ResizeObserver | null = null
  private hydrator: DeckHydrator | null = null
  private fontRefitScheduled = false

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
    const { dark, inkdropNative } = this.injectStyles(root)
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
    // Before any hydration: mermaid SVG is sanitized by mermaid itself and
    // must not be re-run through the HTML profile.
    sanitizeSlideContent(root)
    this.hydrator = new DeckHydrator(root, { dark, inkdropNative })
    this.deck = deck
    this.state = 'ready'

    // Navigation both notifies (speaker/notes overlay) and hydrates the
    // newly reachable slides. Registered before the position restore so a
    // mid-deck rebuild hydrates the restored slide, not slide 1.
    deck.on('slidechanged', () => {
      this.notifySlideChanged()
      void this.hydrateVisible()
    })
    const { initialSlide, onSlideChanged, hydrateVisibleOnly } = this.init
    if (initialSlide && (initialSlide.h > 0 || initialSlide.v > 0)) {
      deck.slide(initialSlide.h, initialSlide.v)
    }
    if (onSlideChanged) this.notifySlideChanged()

    // First paint waits only for the visible slide and its neighbors.
    await this.hydrateVisible()
    if (this.state !== 'ready') return

    if (!hydrateVisibleOnly) this.hydrator.startIdleHydration()

    // Reveal computes its scale from the container size; refit on resize
    // (window resize, fullscreen enter/exit).
    this.resizeObserver = new ResizeObserver(() => {
      if (this.state === 'ready') this.deck?.layout()
    })
    this.resizeObserver.observe(this.host)
  }

  /**
   * Hydrate the current slide and its neighbors; relayout and re-notify if
   * the current slide's content changed height (diagrams/math replace their
   * placeholders after Reveal already fit itself to the pre-render DOM).
   */
  private async hydrateVisible(): Promise<void> {
    const { deck, hydrator } = this
    if (!deck || !hydrator || this.state !== 'ready') return
    const current = deck.getCurrentSlide() as HTMLElement | null
    const { currentChanged, anyMath } = await hydrator.hydrateAround(current)
    if (this.state !== 'ready') return
    if (currentChanged) {
      deck.layout()
      // Speaker notes may contain math placeholders that hydration just
      // resolved to readable TeX text — push the updated notes out.
      this.notifySlideChanged()
    }
    if (anyMath && !this.fontRefitScheduled) {
      // KaTeX webfonts (document-level data: URIs) finish loading after
      // first use; glyph metrics shift slightly, so refit once they settle.
      // The ResizeObserver can't catch this — the host size doesn't change.
      this.fontRefitScheduled = true
      void document.fonts.ready.then(() => {
        if (this.state === 'ready') this.deck?.layout()
      })
    }
  }

  private notifySlideChanged(): void {
    const deck = this.deck
    if (!deck) return
    const indices = deck.getIndices()
    // Rendered notes HTML comes from the user's own note via marked; the
    // overlay renders text only, so strip to textContent here.
    const notes = deck.getCurrentSlide()?.querySelector('aside.notes')?.textContent ?? ''
    this.init.onSlideChanged?.(notes.trim(), { h: indices.h, v: indices.v })
  }

  destroy(): void {
    if (this.state === 'destroyed') return
    const previous = this.state
    this.state = 'destroyed'
    this.hydrator?.stop()
    this.hydrator = null
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
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

  /** Returns the resolved appearance so mermaid rendering can match it. */
  private injectStyles(root: ShadowRoot): { dark: boolean; inkdropNative: boolean } {
    const theme = resolveTheme(this.init.options.theme)
    const inkdropNative = theme.dark === 'auto'
    const dark = theme.dark === 'auto' ? isAppDark() : theme.dark
    const sheets = [
      resetCss,
      revealCss,
      BASE_CSS,
      ...theme.base,
      getHighlightSheet(dark),
      ...theme.overrides
    ]
    // Note-authored frontmatter CSS goes LAST so it wins over the theme.
    // prepareForShadowRoot (below) strips its @import/@font-face like every
    // other sheet; stripRemoteUrls additionally keeps a shared note from
    // beaconing out via url() when presented. Shadow DOM scoping already
    // keeps it away from the app UI.
    const { customCss } = this.init.options
    if (customCss.trim() !== '') sheets.push(stripRemoteUrls(customCss))
    for (const cssText of sheets) {
      const style = document.createElement('style')
      style.textContent = prepareForShadowRoot(cssText)
      root.appendChild(style)
    }
    return { dark, inkdropNative }
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
