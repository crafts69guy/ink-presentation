/**
 * Pure CSS string transforms applied before injecting third-party stylesheets
 * into the presentation's shadow root.
 */

/**
 * Rewrite `:root` selectors to `:host` so CSS custom properties defined by
 * Reveal.js themes take effect inside a shadow tree (`:root` never matches
 * there).
 */
export function scopeRootSelectors(css: string): string {
  return css.replace(/:root\b/g, ':host')
}

/**
 * Remove `@import` statements and `@font-face` blocks. Fonts cannot be loaded
 * from inside a shadow root and we don't want network fetches for webfonts;
 * the injected override stylesheet supplies a system font stack instead.
 */
export function stripFontImports(css: string): string {
  const withoutImports = css.replace(/@import\s+[^;]+;/g, '')
  // Match @font-face blocks non-greedily; theme CSS never nests braces inside them.
  const withoutFontFaces = withoutImports.replace(/@font-face\s*\{[^}]*\}/g, '')
  return withoutFontFaces
}

/**
 * Neutralize `url()` references that could reach the network (or local
 * files) from note-authored CSS — a shared note must not be able to beacon
 * out when presented. `data:` URIs and `#fragment` references stay; every
 * other reference becomes the empty `url()`, which makes its declaration
 * invalid so the CSS parser drops just that declaration.
 */
export function stripRemoteUrls(css: string): string {
  return css.replace(/url\(([^)]*)\)/gi, (match, rawArg: string) => {
    const arg = rawArg.trim().replace(/^['"]|['"]$/g, '').trim()
    const allowed = arg === '' || arg.toLowerCase().startsWith('data:') || arg.startsWith('#')
    return allowed ? match : 'url()'
  })
}

/** Apply all transforms required for shadow-root injection. */
export function prepareForShadowRoot(css: string): string {
  return scopeRootSelectors(stripFontImports(css))
}
