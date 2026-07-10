import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { prepareForShadowRoot } from '../core/css'

/**
 * KaTeX CSS + webfonts, loaded lazily at runtime from the installed `katex`
 * package (the Electron renderer has Node). Nothing katex-related lives in
 * `lib/index.js` — the same bundle-budget reasoning as the lazy mermaid
 * import, extended to CSS and fonts.
 *
 * Fonts cannot load from inside a shadow root (`core/css.ts` strips
 * `@font-face` for exactly that reason), so the font faces are rebuilt from
 * the package's .woff2 files as data: URIs and injected ONCE at document
 * level — document-level `@font-face` applies inside shadow trees. The rest
 * of katex.min.css goes into the deck's shadow root via the caller.
 */

const FONT_STYLE_ID = 'ink-presentation-katex-fonts'

let cached: { cssDir: string; shadowCss: string } | null = null

/** KaTeX font naming: KaTeX_<Family>-<Regular|Bold|Italic|BoldItalic>.woff2 */
function fontFaceRule(fileName: string, base64: string): string {
  const stem = fileName.replace(/\.woff2$/, '')
  const [family = stem, variant = 'Regular'] = stem.split('-')
  const weight = variant.includes('Bold') ? 'bold' : 'normal'
  const style = variant.includes('Italic') ? 'italic' : 'normal'
  return (
    `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};` +
    `src:url(data:font/woff2;base64,${base64}) format('woff2')}`
  )
}

/**
 * Reads katex.min.css and the woff2 fonts from disk (cached after the first
 * call), injects the fonts at document level (idempotent), and returns the
 * @font-face-free stylesheet for shadow-root injection. Throws when the
 * katex package cannot be resolved or read — the caller degrades to plain
 * TeX text.
 */
export function ensureKatexAssets(): string {
  if (cached === null) {
    // createRequire: the bundle is CJS at runtime, but this file is authored
    // as ESM syntax, so plain `require` is not in scope here.
    const cssPath = createRequire(__filename).resolve('katex/dist/katex.min.css')
    cached = {
      cssDir: dirname(cssPath),
      shadowCss: prepareForShadowRoot(readFileSync(cssPath, 'utf8'))
    }
  }
  injectDocumentFonts(cached.cssDir)
  return cached.shadowCss
}

function injectDocumentFonts(cssDir: string): void {
  if (document.getElementById(FONT_STYLE_ID) !== null) return
  const fontsDir = join(cssDir, 'fonts')
  const rules = readdirSync(fontsDir)
    .filter(name => name.endsWith('.woff2'))
    .map(name => fontFaceRule(name, readFileSync(join(fontsDir, name)).toString('base64')))
  const style = document.createElement('style')
  style.id = FONT_STYLE_ID
  style.textContent = rules.join('\n')
  document.head.appendChild(style)
}
