import { load } from 'js-yaml'

export interface FrontmatterResult {
  /** Parsed YAML value, or null when absent/invalid. */
  data: unknown
  /** Note body with the frontmatter block removed. */
  body: string
  warnings: string[]
}

// Only a block whose opening `---` is the very first line counts as
// frontmatter. It is stripped before slide splitting; otherwise its fences
// would be read as slide separators in `hr` mode.
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/

export function extractFrontmatter(markdown: string): FrontmatterResult {
  const match = FRONTMATTER_RE.exec(markdown)
  if (!match) {
    return { data: null, body: markdown, warnings: [] }
  }
  const body = markdown.slice(match[0].length)
  try {
    const data: unknown = load(match[1] ?? '')
    return { data, body, warnings: [] }
  } catch (error) {
    // Invalid YAML: still strip the block (leaving it would produce a
    // garbage first slide), but surface the problem.
    return {
      data: null,
      body,
      warnings: [
        `Ignored invalid YAML frontmatter: ${error instanceof Error ? error.message : String(error)}`
      ]
    }
  }
}
