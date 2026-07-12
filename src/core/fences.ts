/** Shared code-fence handling for the preprocessing pipeline. */

export const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})/

// oxlint-disable-next-line no-control-regex -- NUL bytes are the point: they cannot occur in note content, making the placeholder collision-proof.
const PLACEHOLDER_RE = /\x00INKFENCE(\d+)\x00/g

export interface MaskedText {
  masked: string
  /** Put the original fenced blocks back (apply to any derived string). */
  restore: (text: string) => string
}

/**
 * Replace fenced code blocks with opaque placeholders so line/regex passes
 * (note comments, `Note:` lines) cannot match inside code. Placeholders use
 * NUL bytes, which cannot occur in note content.
 */
export function maskFences(text: string): MaskedText {
  const blocks: string[] = []
  const outLines: string[] = []
  let fenceLines: string[] = []
  let inFence = false
  let fenceMarker = ''

  for (const line of text.split('\n')) {
    const fenceMatch = FENCE_RE.exec(line)
    if (!inFence && fenceMatch) {
      inFence = true
      fenceMarker = (fenceMatch[1] as string)[0] as string
      fenceLines = [line]
      continue
    }
    if (inFence) {
      fenceLines.push(line)
      if (fenceMatch && (fenceMatch[1] as string)[0] === fenceMarker) {
        outLines.push(`\x00INKFENCE${blocks.length}\x00`)
        blocks.push(fenceLines.join('\n'))
        inFence = false
      }
      continue
    }
    outLines.push(line)
  }
  // Unterminated fence: keep it as code (matches Markdown semantics).
  if (inFence) {
    outLines.push(`\x00INKFENCE${blocks.length}\x00`)
    blocks.push(fenceLines.join('\n'))
  }

  return {
    masked: outLines.join('\n'),
    restore: derived =>
      derived.replace(PLACEHOLDER_RE, (match, index: string) => blocks[Number(index)] ?? match)
  }
}
