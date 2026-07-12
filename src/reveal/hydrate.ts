/**
 * Per-slide "hydration": mermaid, KaTeX, and highlight.js rendering scoped
 * to one slide section at a time, instead of the whole deck up front. The
 * visible slide and its neighbors hydrate before the deck is usable; the
 * rest fill in on idle time (or on navigation), so a 200-slide note opens
 * as fast as a 5-slide one.
 */
// lib/common bundles ~40 popular languages instead of the full set (or
// Reveal's highlight plugin, which inlines all of highlight.js — ~1 MB).
import hljs from 'highlight.js/lib/common'
import { decodeMathTex, MATH_DISPLAY_ATTR, MATH_TEX_ATTR } from '../core/math'
import { ensureKatexAssets } from './katex-assets'

/** Marks a section whose expensive content has been rendered (idempotency). */
export const HYDRATED_ATTR = 'data-ink-hydrated'

/** Lazily imported once; decks without diagrams pay nothing (tsdown
 * `neverBundle` keeps mermaid out of the bundle). */
let mermaidModule: Promise<typeof import('mermaid')> | null = null

async function loadMermaid(): Promise<typeof import('mermaid').default> {
  mermaidModule ??= import('mermaid')
  const { default: mermaid } = await mermaidModule
  return mermaid
}

/** Same budget reasoning as mermaid: katex stays external and only loads
 * when a deck contains math. */
let katexModule: Promise<typeof import('katex')> | null = null

async function loadKatex(): Promise<typeof import('katex').default> {
  katexModule ??= import('katex')
  const { default: katex } = await katexModule
  return katex
}

/** Monotonic across every manager in this window — two speaker mini decks
 * hydrating concurrently must never collide on mermaid element ids
 * (`Date.now()` did, within one millisecond). */
let mermaidRenderSeq = 0

/** mermaid.initialize() mutates global config and render() shares an
 * internal DOM sandbox, so renders from concurrent managers are serialized
 * through one promise chain, each re-asserting its own config first. */
let mermaidJobs: Promise<unknown> = Promise.resolve()

function enqueueMermaidRender(
  mermaid: Awaited<ReturnType<typeof loadMermaid>>,
  config: Record<string, unknown>,
  source: string
): Promise<string> {
  const job = mermaidJobs.then(async () => {
    mermaid.initialize(config)
    const { svg } = await mermaid.render(`ink-mermaid-${++mermaidRenderSeq}`, source)
    return svg
  })
  mermaidJobs = job.then(
    () => undefined,
    () => undefined
  )
  return job
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

export interface HydrateResult {
  /** The current slide's content changed height — caller should relayout. */
  currentChanged: boolean
  /** Math was rendered somewhere — caller should refit once fonts settle. */
  anyMath: boolean
}

/** The three per-slide renderers behind one idempotent entry point. */
export class DeckHydrator {
  private mermaidConfig: Record<string, unknown> | null = null
  private katexHandle: Promise<Awaited<ReturnType<typeof loadKatex>> | null> | null = null
  private idleHandle: number | null = null
  private stopped = false

  constructor(
    private readonly root: ShadowRoot,
    private readonly theme: { dark: boolean; inkdropNative: boolean }
  ) {}

  /** Leaf sections in document order (vertical stacks hydrate per child). */
  private sections(): HTMLElement[] {
    return Array.from(this.root.querySelectorAll<HTMLElement>('.slides section')).filter(
      section => section.querySelector('section') === null
    )
  }

  /**
   * Hydrate the given slide plus its immediate neighbors (document-order
   * prev/next and the rest of its vertical stack) — the slides reachable
   * with one keypress.
   */
  async hydrateAround(current: HTMLElement | null): Promise<HydrateResult> {
    const all = this.sections()
    const targets = new Set<HTMLElement>()
    if (current) {
      targets.add(current)
      const parent = current.parentElement
      if (parent?.tagName === 'SECTION') {
        for (const sibling of Array.from(parent.children)) {
          if (sibling instanceof HTMLElement && sibling.tagName === 'SECTION') targets.add(sibling)
        }
      }
      const index = all.indexOf(current)
      const before = all[index - 1]
      const after = all[index + 1]
      if (before) targets.add(before)
      if (after) targets.add(after)
    } else if (all[0]) {
      targets.add(all[0])
    }

    let currentChanged = false
    let anyMath = false
    for (const section of targets) {
      if (this.stopped) break
      const result = await this.hydrateSection(section)
      if (section === current && result.rendered) currentChanged = true
      if (result.math) anyMath = true
    }
    return { currentChanged, anyMath }
  }

  /** Hydrate everything else, one slide per idle slice. */
  startIdleHydration(): void {
    if (this.stopped || this.idleHandle !== null) return
    const request: (cb: () => void) => number =
      typeof window.requestIdleCallback === 'function'
        ? cb => window.requestIdleCallback(() => cb())
        : cb => window.setTimeout(cb, 50)

    const step = (): void => {
      this.idleHandle = null
      if (this.stopped) return
      const next = this.sections().find(section => !section.hasAttribute(HYDRATED_ATTR))
      if (!next) return
      void this.hydrateSection(next).then(() => {
        if (!this.stopped) this.idleHandle = request(step)
      })
    }
    this.idleHandle = request(step)
  }

  stop(): void {
    this.stopped = true
    if (this.idleHandle !== null) {
      if (typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(this.idleHandle)
      } else {
        window.clearTimeout(this.idleHandle)
      }
      this.idleHandle = null
    }
  }

  /** Render one slide's mermaid → KaTeX → highlight.js, exactly once. */
  async hydrateSection(section: HTMLElement): Promise<{ rendered: boolean; math: boolean }> {
    if (section.hasAttribute(HYDRATED_ATTR)) return { rendered: false, math: false }
    section.setAttribute(HYDRATED_ATTR, '')

    const diagrams = await this.renderMermaid(section)
    if (this.stopped) return { rendered: diagrams, math: false }
    const math = await this.renderMath(section)
    if (this.stopped) return { rendered: diagrams || math, math }
    this.highlightCode(section)
    return { rendered: diagrams || math, math }
  }

  /**
   * RevealMarkdown overrides marked's default code renderer and does NOT
   * apply `langPrefix` ("language-"); the fence's info string becomes the
   * class verbatim (`class="mermaid"`). Replace fences with rendered SVG in
   * place; runs before highlightCode() so replaced blocks (no longer
   * `pre code`) are naturally skipped by hljs.
   */
  private async renderMermaid(section: HTMLElement): Promise<boolean> {
    const blocks = Array.from(section.querySelectorAll<HTMLElement>('pre code.mermaid'))
    if (blocks.length === 0) return false

    let mermaid: Awaited<ReturnType<typeof loadMermaid>>
    try {
      mermaid = await loadMermaid()
    } catch (err) {
      // Module load failure (missing/corrupt install) degrades to inline
      // errors — one broken dependency must not kill the whole deck.
      for (const block of blocks) {
        this.replaceWithMermaidError(block, `Mermaid failed to load: ${describeError(err)}`)
      }
      return true
    }

    this.mermaidConfig ??= {
      startOnLoad: false,
      securityLevel: 'strict',
      ...mermaidThemeConfig(this.theme.dark, this.theme.inkdropNative)
    }
    for (const block of blocks) {
      if (this.stopped) return true
      const source = block.textContent ?? ''
      try {
        const svg = await enqueueMermaidRender(mermaid, this.mermaidConfig, source)
        const wrapper = document.createElement('div')
        wrapper.className = 'mermaid-diagram'
        // securityLevel: 'strict' has mermaid sanitize the SVG internally
        // (DOMPurify) before returning it, so injecting it here is safe.
        wrapper.innerHTML = svg
        ;(block.closest('pre') ?? block).replaceWith(wrapper)
      } catch (err) {
        this.replaceWithMermaidError(block, `Mermaid diagram error: ${describeError(err)}`)
      }
    }
    return true
  }

  private replaceWithMermaidError(block: HTMLElement, message: string): void {
    const errorNode = document.createElement('pre')
    errorNode.className = 'mermaid-error'
    errorNode.textContent = message
    ;(block.closest('pre') ?? block).replaceWith(errorNode)
  }

  /** KaTeX itself and its CSS/fonts load on the first slide that needs
   * them; load failure degrades every expression to plain TeX text. */
  private ensureKatex(): Promise<Awaited<ReturnType<typeof loadKatex>> | null> {
    this.katexHandle ??= (async () => {
      try {
        const shadowCss = ensureKatexAssets()
        const katex = await loadKatex()
        const style = document.createElement('style')
        style.textContent = shadowCss
        this.root.appendChild(style)
        return katex
      } catch (err) {
        console.error('ink-presentation: failed to load KaTeX', err)
        return null
      }
    })()
    return this.katexHandle
  }

  /** The preprocessing pipeline (core/math.ts) left empty placeholder spans
   * carrying URI-encoded TeX; render KaTeX into them in place. */
  private async renderMath(section: HTMLElement): Promise<boolean> {
    const nodes = Array.from(section.querySelectorAll<HTMLElement>(`span[${MATH_TEX_ATTR}]`))
    if (nodes.length === 0) return false

    const katex = await this.ensureKatex()
    for (const node of nodes) {
      if (this.stopped) return true
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

  private highlightCode(section: HTMLElement): void {
    for (const block of Array.from(section.querySelectorAll('pre code'))) {
      hljs.highlightElement(block as HTMLElement)
    }
  }
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
