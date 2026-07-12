/** Pure color parsing for light/dark detection (probe values are computed
 * styles, so the browser has already normalized them to rgb/rgba). */

const RGB_RE =
  /^rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)(?:[\s,/]+(\d+(?:\.\d+)?%?))?\s*\)$/

/**
 * True when the color reads as dark. Unparseable or fully transparent
 * values return the provided default (dark UIs are Inkdrop's most common
 * setup, so callers default to true).
 */
export function isDarkColor(color: string, fallback = true): boolean {
  const match = RGB_RE.exec(color.trim())
  if (!match) return fallback

  const [, r, g, b, alphaRaw] = match
  if (alphaRaw !== undefined) {
    const alpha = alphaRaw.endsWith('%') ? Number(alphaRaw.slice(0, -1)) / 100 : Number(alphaRaw)
    if (alpha === 0) return fallback
  }

  // Relative luminance (ITU-R BT.709 coefficients on gamma-encoded values —
  // adequate for a binary light/dark call).
  const luminance = (0.2126 * Number(r) + 0.7152 * Number(g) + 0.0722 * Number(b)) / 255
  return luminance < 0.5
}
