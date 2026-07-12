import { maskFences } from './fences'

/**
 * Speaker-note extraction for a single slide.
 *
 * Two authoring conventions are supported and merged:
 *   1. HTML comments: `<!-- note: remember to smile -->` (also `notes:`)
 *   2. A `Note:` line — everything from that line to the end of the slide
 *
 * RevealMarkdown only attaches notes when its notes separator splits a slide
 * into exactly two parts, so all sources are merged into a single trailing
 * `Note:` block per slide. Code fences are masked first so `Note:` or note
 * comments inside code are left untouched.
 */

/** Matches `data-separator-notes` in reveal-manager (applied with "mgi"). */
export const NOTES_SEPARATOR_REGEX = '^Note:'

const NOTE_COMMENT_RE = /<!--\s*notes?:([\s\S]*?)-->/gi
const NOTE_LINE_RE = /^\s*notes?:[ \t]*/i

export interface SlideNotes {
  /** Slide markdown without any note sources. */
  content: string
  /** Merged speaker notes; empty string when the slide has none. */
  notes: string
}

export function extractSlideNotes(slide: string): SlideNotes {
  const { masked, restore } = maskFences(slide)
  const noteParts: string[] = []

  let content = masked.replace(NOTE_COMMENT_RE, (_match, text: string) => {
    const trimmed = text.trim()
    if (trimmed !== '') noteParts.push(trimmed)
    return ''
  })

  // A literal `Note:` line claims the rest of the slide.
  const lines = content.split('\n')
  const noteLineIndex = lines.findIndex(line => NOTE_LINE_RE.test(line))
  if (noteLineIndex !== -1) {
    const tail = lines.slice(noteLineIndex).join('\n').replace(NOTE_LINE_RE, '').trim()
    if (tail !== '') noteParts.push(tail)
    content = lines.slice(0, noteLineIndex).join('\n')
  }

  return {
    content: restore(content.replace(/\s+$/, '')),
    notes: restore(noteParts.join('\n\n'))
  }
}

/** Re-emit a slide with its merged notes as the single trailing Note: block. */
export function buildSlideMarkdown(slide: string): string {
  const { content, notes } = extractSlideNotes(slide)
  if (notes === '') return content
  return `${content}\n\nNote:\n${notes}`
}
