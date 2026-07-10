/** Bundled demo deck shown by `ink-presentation:present-sample`. */
export const SAMPLE_DECK_TITLE = 'Ink-Presentation — Feature Demo'

export const SAMPLE_DECK_BODY = `---
theme: inkdrop
transition: slide
slideNumber: true
progress: true
---

# Ink-Presentation — Feature Demo

Turn any Inkdrop note into a Reveal.js slideshow. Run the toggle command on
**this note** to see everything below rendered as slides.

This deck doubles as the plugin's living feature showcase — every section
below is real, working syntax, not a mockup.

Note: Welcome slide. This note is meant to be presented, not just read —
toggle the presentation to see the rest of the demo properly.

# Markdown, the way you already write it

- **Bold**, _italic_, and \`inline code\` all render normally
- Ordered and unordered lists work as expected
- [Links](https://github.com/crafts69guy/ink-presentation) too

> "Slides are just notes." — a happy user, probably

Note: everything from this line to the end of the slide is also a speaker
note — press S while presenting to see it.

# Syntax-highlighted code

\`\`\`ts
export function greet(name: string): string {
  return \`Hello, \${name}!\`
}
\`\`\`

Highlighted with \`highlight.js/lib/common\` (~40 languages) instead of
Reveal's own highlight plugin, which would triple the bundle.

# Mermaid diagrams — shipped

## Architecture flow

\`\`\`mermaid
flowchart LR
  A[Note markdown] --> B[core pipeline]
  B --> C[RevealManager]
  C --> D[Shadow DOM deck]
  D --> E[Mermaid render hook]
  E -->|SVG| D

  style E fill:#2d7d46,color:#fff
\`\`\`

## Sequence: opening a deck

\`\`\`mermaid
sequenceDiagram
  participant U as User
  participant P as Plugin
  participant R as RevealManager
  participant M as Mermaid
  U->>P: toggle presentation
  P->>R: initialize deck
  R->>R: RevealMarkdown converts slides
  R->>M: render mermaid fences
  M-->>R: sanitized SVG
  R-->>U: ready deck
\`\`\`

Note: malformed diagrams show an inline error instead of blocking the whole
deck — mermaid is only loaded at all when a note actually contains a
mermaid fence, to protect the bundle size.

# Vertical slides in auto mode

This is a horizontal (\`#\`) slide. The two \`##\` sections below stack
vertically underneath it — press ↓ to see them.

## Detail A

\`auto\` mode promotes \`##\` to a vertical stack whenever an \`#\` exists above
it in the note.

## Detail B

No frontmatter override needed for this — \`auto\` is the plugin default.
\`hr\` (\`---\`) and explicit \`h1\`/\`h2\` modes are still available via
\`separator:\` in frontmatter.

# Feature status

| Feature              | Status      |
| --------------------- | ----------- |
| Mermaid diagrams       | shipped     |
| Syntax highlighting    | shipped     |
| Speaker notes           | shipped     |
| Themes (app + classics) | shipped     |
| KaTeX math               | planned |
| Popup speaker view        | planned |
| Custom per-note CSS         | planned |
| Live deck refresh while editing | planned |

# Math blocks — planned

\`\`\`text
E = mc^2
\`\`\`

Math fences currently render as plain code, same as any other unrecognized
language — KaTeX rendering is on the roadmap.

# Configuring this deck

Frontmatter at the very top of a note (before anything else) configures the
deck and never becomes a slide:

\`\`\`markdown
---
theme: night          # inkdrop | black | white | league | night | serif | simple
transition: fade      # none | fade | slide | convex | concave | zoom
separator: h2         # auto (default) | hr | h1 | h2
slideNumber: false
progress: false
verticalSlides: true  # only meaningful in hr mode
---
\`\`\`

This note itself uses \`theme: inkdrop\`, \`transition: slide\`, and the
default \`auto\` separator — see the top of the raw note.

# What's next

See the project's README on GitHub for the current roadmap and known
limitations: https://github.com/crafts69guy/ink-presentation

Note: full backlog and current state live in the repo, not in this bundled
sample note.

# Thanks

Press Esc to exit. Repo: https://github.com/crafts69guy/ink-presentation

Note: end of demo deck. You can disable this command from Preferences ▸
Plugins ▸ ink-presentation if you don't want it in the command palette.
`
