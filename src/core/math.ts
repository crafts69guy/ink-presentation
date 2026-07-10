import { maskFences } from './fences'

/**
 * Math-segment lift-out: `$inline$` and `$$display$$` TeX.
 *
 * RevealMarkdown runs slide markdown through marked, which would mangle TeX
 * before KaTeX ever sees it (`_` becomes <em>, `\\` collapses, …). So the
 * pipeline replaces each math segment with an EMPTY placeholder span carrying
 * the URI-encoded TeX in a data attribute; RevealManager renders KaTeX into
 * the placeholders after RevealMarkdown has converted the slides. Running
 * before `splitSlides` has a second payoff: a multi-line `$$` block containing
 * `---` or `# ` collapses to one line and can never falsely split a slide.
 *
 * Delimiter rules follow remark-math/Pandoc so prose like "costs $5 and $10"
 * is never misread as math:
 *   - inline opener `$` must not be followed by whitespace (or another `$`)
 *   - inline closer `$` must not be preceded by whitespace, nor followed by a
 *     digit or another `$`; inline math cannot contain `$` or span lines
 *   - display math is `$$…$$` on one line, or a block opened by a line
 *     starting with `$$` and closed by the next line ending with `$$`
 *   - `\$` never delimits (restored literally; marked unescapes it to `$`)
 *   - fenced code and inline backtick spans are never touched; lines indented
 *     like code (4+ spaces / tab) are skipped — line-based scanning cannot
 *     tell an indented code block from a deeply nested list item, and
 *     injecting markup into code would be the worse failure
 */

export const MATH_TEX_ATTR = 'data-ink-math'
export const MATH_DISPLAY_ATTR = 'data-ink-math-display'

// oxlint-disable-next-line no-control-regex -- NUL bytes cannot occur in note content; same trick as core/fences.ts.
const FENCE_PLACEHOLDER_RE = /\x00INKFENCE\d+\x00/
const ESCAPED_DOLLAR = '\x00INKDOLLAR\x00'
const INDENTED_CODE_RE = /^(?: {4,}|\t)/

/** Decode a placeholder's TeX attribute; null when malformed (a hand-written
 * span in the note, not one of ours). */
export function decodeMathTex(encoded: string): string | null {
  try {
    return decodeURIComponent(encoded)
  } catch {
    return null
  }
}

/** encodeURIComponent escapes `"`, `&` and `<`, so the attribute value can
 * never break out of the span — the placeholder passes through marked as
 * inert inline HTML. */
function placeholder(tex: string, display: boolean): string {
  const displayAttr = display ? ` ${MATH_DISPLAY_ATTR}=""` : ''
  return `<span ${MATH_TEX_ATTR}="${encodeURIComponent(tex)}"${displayAttr}></span>`
}

/** Validate + finalize captured TeX: reject content that swallowed a fenced
 * block or is blank; restore `\$` (legitimate TeX for a dollar sign). */
function texFrom(raw: string): string | null {
  if (FENCE_PLACEHOLDER_RE.test(raw)) return null
  const tex = raw.replaceAll(ESCAPED_DOLLAR, '\\$').trim()
  return tex === '' ? null : tex
}

/** CommonMark-ish inline code spans for one line: a run of N backticks closes
 * at the next run of exactly N backticks. (Code spans that wrap across lines
 * are not detected — line-based, like the rest of the pipeline.) */
function backtickSpans(line: string): Array<[number, number]> {
  const runs: Array<{ start: number; end: number; length: number }> = []
  const re = /`+/g
  let match: RegExpExecArray | null
  while ((match = re.exec(line)) !== null) {
    runs.push({ start: match.index, end: match.index + match[0].length, length: match[0].length })
  }
  const spans: Array<[number, number]> = []
  let i = 0
  while (i < runs.length) {
    const open = runs[i] as { start: number; end: number; length: number }
    const closeIndex = runs.findIndex((run, j) => j > i && run.length === open.length)
    if (closeIndex === -1) {
      i++
      continue
    }
    spans.push([open.start, (runs[closeIndex] as { end: number }).end])
    i = closeIndex + 1
  }
  return spans
}

/** First valid inline closer for an opener at `open`; -1 when the line has
 * none (inline math cannot contain `$`, so only the next `$` qualifies). */
function findInlineCloser(line: string, open: number, inCode: (pos: number) => boolean): number {
  const afterOpen = line[open + 1]
  if (afterOpen === undefined || /\s/.test(afterOpen)) return -1
  const close = line.indexOf('$', open + 1)
  if (close === -1 || inCode(close)) return -1
  const before = line[close - 1] as string
  const after = line[close + 1]
  if (/\s/.test(before)) return -1
  if (after !== undefined && (after === '$' || /\d/.test(after))) return -1
  return close
}

/** Replace `$$…$$` then `$…$` segments within a single line. */
function scanLine(line: string): string {
  if (!line.includes('$')) return line
  const spans = backtickSpans(line)
  const inCode = (pos: number): boolean => spans.some(([start, end]) => pos >= start && pos < end)

  let out = ''
  let i = 0
  while (i < line.length) {
    const ch = line[i] as string
    if (ch !== '$' || inCode(i)) {
      out += ch
      i++
      continue
    }
    if (line[i + 1] === '$') {
      const close = line.indexOf('$$', i + 2)
      const tex = close === -1 || inCode(close) ? null : texFrom(line.slice(i + 2, close))
      if (tex !== null) {
        out += placeholder(tex, true)
        i = close + 2
      } else {
        out += '$$'
        i += 2
      }
      continue
    }
    const close = findInlineCloser(line, i, inCode)
    const tex = close === -1 ? null : texFrom(line.slice(i + 1, close))
    if (tex === null) {
      out += ch
      i++
      continue
    }
    out += placeholder(tex, false)
    i = close + 1
  }
  return out
}

/** Assemble a multi-line `$$` block's TeX; the block stays literal when its
 * content is empty or swallowed a fence placeholder. */
function closeBlock(blockLines: string[]): string {
  const first = (blockLines[0] as string).trim()
  const last = (blockLines[blockLines.length - 1] as string).trim()
  const middle = blockLines.slice(1, -1)
  const tex = texFrom([first.slice(2), ...middle, last.slice(0, -2)].join('\n'))
  return tex === null ? blockLines.join('\n') : placeholder(tex, true)
}

/** Lift math segments out of note markdown into placeholder spans. */
export function transformMath(text: string): string {
  if (!text.includes('$')) return text
  const { masked, restore } = maskFences(text)
  const lines = masked.replace(/\\\$/g, ESCAPED_DOLLAR).split('\n')

  const out: string[] = []
  /** Raw lines of an open multi-line `$$` block, delimiters included. */
  let block: string[] | null = null

  for (const line of lines) {
    if (block !== null) {
      block.push(line)
      if (line.trimEnd().endsWith('$$')) {
        out.push(closeBlock(block))
        block = null
      }
      continue
    }
    if (INDENTED_CODE_RE.test(line)) {
      out.push(line)
      continue
    }
    const trimmed = line.trim()
    // Block opener: starts with `$$` and does not close on the same line.
    if (trimmed.startsWith('$$') && trimmed.indexOf('$$', 2) === -1) {
      block = [line]
      continue
    }
    out.push(scanLine(line))
  }
  // Unterminated block: leave it literal (mirrors unterminated-fence handling).
  if (block !== null) out.push(...block)

  return restore(out.join('\n')).replaceAll(ESCAPED_DOLLAR, '\\$')
}
