// lib/common bundles ~40 popular languages instead of the full set (or
// Reveal's highlight plugin, which inlines all of highlight.js — ~1 MB).
import hljs from 'highlight.js/lib/common'
import Reveal from 'reveal.js'
import RevealMarkdown from 'reveal.js/plugin/markdown/markdown.esm.js'
import type { EffectiveDeckOptions } from '../core/deck-config'
import { prepareForShadowRoot, stripRemoteUrls } from '../core/css'
import { decodeMathTex, MATH_DISPLAY_ATTR, MATH_TEX_ATTR } from '../core/math'
import { NOTES_SEPARATOR_REGEX } from '../core/notes'
import { SLIDE_SEPARATOR_REGEX, VSLIDE_SEPARATOR_REGEX } from '../core/split'
import resetCss from '../generated/reveal-reset-css'
import revealCss from '../generated/reveal-css'
import { ensureKatexAssets } from './katex-assets'
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

/** Lazily imported once; re-initialized (cheap, no re-import) on every
 * render so a theme/appearance change between decks is always reflected. */
let mermaidModule: Promise<typeof import('mermaid')> | null = null

async function loadMermaid(): Promise<typeof import('mermaid').default> {
  mermaidModule ??= import('mermaid')
  const { default: mermaid } = await mermaidModule
  return mermaid
}

/** Lazily imported once, same budget reasoning as mermaid above: katex stays
 * external (tsdown `neverBundle`) and only loads when a deck contains math. */
let katexModule: Promise<typeof import('katex')> | null = null

async function loadKatex(): Promise<typeof import('katex').default> {
  katexModule ??= import('katex')
  const { default: katex } = await katexModule
  return katex
}

/**
 * Reads the same app CSS custom properties `src/themes/inkdrop.css` maps
 * onto Reveal's `--r-*` variables, resolved to concrete colors the same way
 * `isAppDark()` probes `--editor-background` — mermaid computes its palette
 * at render time and cannot follow live `var()` cascades the way the rest
 * of the deck's CSS does.
 */
function resolveInkdropColors(): {
  background: string
  text: string
  border: string
  accent: string
  font: string
} {
  const probe = document.createElement('div')
  probe.style.cssText = [
    'position:absolute',
    'visibility:hidden',
    'pointer-events:none',
    'background-color:var(--editor-background, var(--editor-background-color, #1c1c1c))',
    'color:var(--text-color, #dddddd)',
    'border-color:var(--border-color, rgba(127, 127, 127, 0.4))',
    'outline-color:var(--primary-color, var(--link-color, #578af1))',
    "font-family:var(--font-name, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif)"
  ].join(';')
  document.body.appendChild(probe)
  const style = getComputedStyle(probe)
  const colors = {
    background: style.backgroundColor,
    text: style.color,
    border: style.borderColor,
    accent: style.outlineColor,
    font: style.fontFamily
  }
  probe.remove()
  return colors
}

/**
 * `inkdrop` theme: derive mermaid's palette from the live app colors so
 * diagrams match the surrounding deck, same intent as `theme-inkdrop-css.ts`.
 * Reveal classics (black/white/night/...): mermaid has no equivalent of
 * those fixed palettes, so just pick its own light/dark built-in theme for
 * contrast against the slide background.
 */
function mermaidThemeConfig(dark: boolean, inkdropNative: boolean): Record<string, unknown> {
  if (!inkdropNative) return { theme: dark ? 'dark' : 'default' }

  const colors = resolveInkdropColors()
  return {
    theme: 'base',
    themeVariables: {
      background: colors.background,
      primaryColor: colors.background,
      primaryTextColor: colors.text,
      primaryBorderColor: colors.accent,
      secondaryColor: colors.background,
      tertiaryColor: colors.background,
      lineColor: colors.border,
      textColor: colors.text,
      edgeLabelBackground: colors.background,
      fontFamily: colors.font
    }
  }
}

/**
 * Owns the Reveal.js lifecycle inside a Shadow DOM attached to the host
 * element. The shadow boundary keeps Reveal's stylesheets away from the app
 * while still letting Inkdrop's CSS custom properties inherit through.
 */
export class RevealManager {
  private deck: Reveal.Api | null = null
  private state: ManagerState = 'idle'
  private resizeObserver: ResizeObserver | null = null

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
    const diagramsRendered = await this.renderMermaidDiagrams(root, dark, inkdropNative)
    if (this.state !== 'initializing') {
      // Same guard as above, re-checked after the mermaid render's own await.
      this.safeDestroyDeck(deck)
      return
    }
    const mathRendered = await this.renderMathExpressions(root)
    if (this.state !== 'initializing') {
      // And once more after the katex render's own await.
      this.safeDestroyDeck(deck)
      return
    }
    this.highlightCodeBlocks(root)
    this.deck = deck
    this.state = 'ready'
    // Diagrams and math change slide content height after Reveal already fit
    // itself to the pre-render DOM.
    if (diagramsRendered || mathRendered) deck.layout()
    if (mathRendered) {
      // KaTeX webfonts (document-level data: URIs) finish loading after first
      // use; glyph metrics shift slightly, so refit once they settle. The
      // ResizeObserver can't catch this — the host size doesn't change.
      void document.fonts.ready.then(() => {
        if (this.state === 'ready') this.deck?.layout()
      })
    }

    const { initialSlide, onSlideChanged } = this.init
    if (initialSlide && (initialSlide.h > 0 || initialSlide.v > 0)) {
      deck.slide(initialSlide.h, initialSlide.v)
    }
    if (onSlideChanged) {
      deck.on('slidechanged', () => this.notifySlideChanged())
      this.notifySlideChanged()
    }

    // Reveal computes its scale from the container size; refit on resize
    // (window resize, fullscreen enter/exit).
    this.resizeObserver = new ResizeObserver(() => {
      if (this.state === 'ready') this.deck?.layout()
    })
    this.resizeObserver.observe(this.host)
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

  /**
   * RevealMarkdown has converted the slides by now; replace mermaid fences
   * with rendered SVG in place. Runs before highlightCodeBlocks() so
   * replaced blocks (no longer `pre code`) are naturally skipped by hljs.
   * Returns whether any diagram was rendered, so the caller knows to relayout.
   */
  private async renderMermaidDiagrams(
    root: ShadowRoot,
    dark: boolean,
    inkdropNative: boolean
  ): Promise<boolean> {
    // RevealMarkdown overrides marked's default code renderer and does NOT
    // apply `langPrefix` ("language-"); the fence's info string becomes the
    // class verbatim (`class="mermaid"`), unlike highlight.js's own
    // language-detection which additionally recognizes bare class names.
    const blocks = Array.from(root.querySelectorAll<HTMLElement>('pre code.mermaid'))
    if (blocks.length === 0) return false

    const mermaid = await loadMermaid()
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      ...mermaidThemeConfig(dark, inkdropNative)
    })
    let rendered = false
    for (const [index, block] of blocks.entries()) {
      // A slow multi-diagram note could still be mid-render when destroy()
      // is called; bail out before touching the DOM further.
      if (this.state !== 'initializing') return rendered

      const source = block.textContent ?? ''
      const pre = block.closest('pre') ?? block
      try {
        const { svg } = await mermaid.render(`mermaid-${index}-${Date.now()}`, source)
        const wrapper = document.createElement('div')
        wrapper.className = 'mermaid-diagram'
        // securityLevel: 'strict' has mermaid sanitize the SVG internally
        // (DOMPurify) before returning it, so injecting it here is safe.
        wrapper.innerHTML = svg
        pre.replaceWith(wrapper)
      } catch (err) {
        const errorNode = document.createElement('pre')
        errorNode.className = 'mermaid-error'
        errorNode.textContent = `Mermaid diagram error: ${err instanceof Error ? err.message : String(err)}`
        pre.replaceWith(errorNode)
      }
      rendered = true
    }
    return rendered
  }

  /**
   * RevealMarkdown has converted the slides by now; the preprocessing
   * pipeline (core/math.ts) left empty placeholder spans carrying URI-encoded
   * TeX. Render KaTeX into them in place. KaTeX itself and its CSS/fonts are
   * loaded lazily only when placeholders exist — decks without math pay zero
   * cost. Returns whether anything was rendered, so the caller knows to
   * relayout.
   */
  private async renderMathExpressions(root: ShadowRoot): Promise<boolean> {
    const nodes = Array.from(root.querySelectorAll<HTMLElement>(`span[${MATH_TEX_ATTR}]`))
    if (nodes.length === 0) return false

    let katex: Awaited<ReturnType<typeof loadKatex>> | null = null
    try {
      const shadowCss = ensureKatexAssets()
      katex = await loadKatex()
      const style = document.createElement('style')
      style.textContent = shadowCss
      root.appendChild(style)
    } catch (err) {
      // Degrade to plain TeX text below rather than blanking the deck.
      console.error('ink-presentation: failed to load KaTeX', err)
    }

    for (const node of nodes) {
      // Bail out if destroy() arrived while katex was loading.
      if (this.state !== 'initializing') return true

      const tex = decodeMathTex(node.getAttribute(MATH_TEX_ATTR) ?? '')
      if (tex === null) continue // hand-written span with a malformed attribute
      // The notes overlay renders text only — keep raw TeX readable there.
      if (katex === null || node.closest('aside.notes') !== null) {
        node.textContent = tex
        continue
      }
      try {
        katex.render(tex, node, {
          displayMode: node.hasAttribute(MATH_DISPLAY_ATTR),
          // Invalid TeX renders as red source text instead of throwing.
          throwOnError: false,
          // No \href/\includegraphics/… from note content.
          trust: false
        })
      } catch {
        // throwOnError:false still throws on a few non-parse errors.
        node.textContent = tex
      }
    }
    return true
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
