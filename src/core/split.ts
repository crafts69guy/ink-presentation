import type { SplitMode } from '../config'
import { FENCE_RE } from './fences'

/**
 * Fence-aware slide splitting.
 *
 * RevealMarkdown's own separator handling is regex-based, which (a) cannot
 * know about code fences, so a `---` or `# ` inside a fenced block would
 * falsely split, and (b) infinite-loops on zero-width separator matches
 * (its slidify() advances by `regex.lastIndex`). We therefore split here,
 * line-by-line with fence tracking, and hand Reveal a document whose slides
 * are joined by sentinel lines that never occur in real notes.
 */

/** A group is one horizontal slide; extra entries are its vertical stack. */
export type SlideGroups = string[][]

export const SLIDE_SENTINEL = '<!--ink-slide-->'
export const VSLIDE_SENTINEL = '<!--ink-vslide-->'

/** Regex sources passed to Reveal's data-separator attributes. Both consume
 * characters (never zero-width), keeping slidify's exec loop safe. */
export const SLIDE_SEPARATOR_REGEX = `^${SLIDE_SENTINEL}$`
export const VSLIDE_SEPARATOR_REGEX = `^${VSLIDE_SENTINEL}$`

const HR_RE = /^---+\s*$/
const VERTICAL_HR_RE = /^--\s*$/
const H1_RE = /^# /
const H2_RE = /^## /

interface SplitOptions {
  mode: SplitMode
  /** Allow `--` vertical separators (hr mode only; h2 mode is always vertical-aware). */
  verticalSlides: boolean
}

export function splitSlides(body: string, options: SplitOptions): SlideGroups {
  const lines = body.split(/\r?\n/)
  const groups: SlideGroups = [[]]
  let currentLines: string[] = []
  let inFence = false
  let fenceMarker = ''

  const currentGroup = () => groups[groups.length - 1] as string[]
  const pushSlide = () => {
    currentGroup().push(currentLines.join('\n'))
    currentLines = []
  }
  const startGroup = () => {
    pushSlide()
    groups.push([])
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string

    const fenceMatch = FENCE_RE.exec(line)
    if (fenceMatch) {
      const marker = fenceMatch[1] as string
      if (!inFence) {
        inFence = true
        fenceMarker = marker[0] as string
      } else if (marker[0] === fenceMarker) {
        inFence = false
      }
      currentLines.push(line)
      continue
    }
    if (inFence) {
      currentLines.push(line)
      continue
    }

    if (options.mode === 'hr') {
      const prevBlank = i === 0 || (lines[i - 1] ?? '').trim() === ''
      // A `---` directly after text is a Markdown setext heading, not a
      // thematic break — only blank-line-preceded separators split.
      if (prevBlank && HR_RE.test(line)) {
        startGroup()
        continue
      }
      if (prevBlank && options.verticalSlides && VERTICAL_HR_RE.test(line)) {
        pushSlide()
        continue
      }
    } else {
      if (H1_RE.test(line)) {
        if (!isEmptySoFar(groups, currentLines)) startGroup()
        currentLines.push(line)
        continue
      }
      if (options.mode === 'h2' && H2_RE.test(line)) {
        if (!isEmptySoFar(groups, currentLines)) pushSlide()
        currentLines.push(line)
        continue
      }
    }

    currentLines.push(line)
  }
  pushSlide()

  return pruneEmpty(groups)
}

/** True while nothing but blank lines has been collected for the very first
 * slide — prevents a leading empty slide when the note starts with a heading. */
function isEmptySoFar(groups: SlideGroups, currentLines: string[]): boolean {
  return (
    groups.length === 1 &&
    (groups[0] as string[]).length === 0 &&
    currentLines.every(line => line.trim() === '')
  )
}

/** Strip blank lines at slide edges without touching content indentation. */
function trimBlankEdges(slide: string): string {
  return slide.replace(/^(?:[ \t]*\r?\n)+/, '').replace(/(?:\r?\n[ \t]*)+$/, '')
}

function pruneEmpty(groups: SlideGroups): SlideGroups {
  const pruned = groups
    .map(group => group.map(trimBlankEdges).filter(slide => slide.trim() !== ''))
    .filter(group => group.length > 0)
  // Never return zero slides; Reveal needs at least one section.
  return pruned.length > 0 ? pruned : [['']]
}

/** Join slide groups back into a single document using the sentinels. */
export function joinWithSentinels(groups: SlideGroups): string {
  return groups
    .map(group => group.join(`\n${VSLIDE_SENTINEL}\n`))
    .join(`\n${SLIDE_SENTINEL}\n`)
}
