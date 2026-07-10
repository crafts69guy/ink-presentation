# Writing slides

Any Inkdrop note can be presented. This guide covers how notes map to slides.

## Slide separators

Three modes, set in **Settings ▸ Slide separator** or per note via
frontmatter `separator:`.

### `hr` (default) — split on `---`

A `---` line **surrounded by blank lines** starts a new slide:

```markdown
# First slide

content

---

# Second slide
```

Notes:
- `text` directly followed by `---` is a Markdown setext heading, **not** a
  separator — keep a blank line above.
- With **Vertical slides** enabled (settings or `verticalSlides: true`),
  `--` starts a vertical slide (navigate with <kbd>↓</kbd>).

### `h1` — every `# ` heading starts a slide

```markdown
# Chapter 1     ← slide 1
intro

# Chapter 2     ← slide 2
```

Content before the first heading becomes its own leading slide.

### `h2` — `# ` starts a column, `## ` stacks vertically

```markdown
# Chapter 1     ← slide 1 (column 1)
## Detail A     ← slide below it (↓)
## Detail B     ← another vertical slide
# Chapter 2     ← slide 2 (column 2)
```

### Code fences are safe

`---`, `# `, `## `, `Note:` and `<!-- note: -->` **inside fenced code
blocks** (``` or ~~~) are always treated as code, never as separators or
notes — in every mode.

## Frontmatter (per-note deck config)

A YAML block at the very top of the note configures the deck and never
becomes a slide. All keys are optional; they override the plugin settings.

```markdown
---
theme: night          # inkdrop | black | white | league | night | serif | simple
transition: fade      # none | fade | slide | convex | concave | zoom
separator: h2         # hr | h1 | h2
slideNumber: false
progress: false
verticalSlides: true  # only meaningful in hr mode
---
```

Unknown values produce a notification and fall back to your settings.
Foreign keys (tags, dates, …) are ignored silently. Invalid YAML is stripped
with a warning so it can't leak into slide 1.

## Speaker notes

Two equivalent syntaxes, freely mixable — press <kbd>S</kbd> while
presenting to show them:

```markdown
## The pitch

Visible slide content

<!-- note: remember to pause here -->

Note: everything from this line to the end of the slide is also a note
```

Multiple notes on one slide are merged into a single block. Notes render as
plain text in the overlay.

Press <kbd>V</kbd> while presenting to open the **speaker view** — a
separate window with the current slide, the upcoming slide, your notes, a
slide counter, wall clock, and an elapsed timer (click it to reset). It
follows the presentation live, and its arrow keys / buttons drive the main
deck. <kbd>Esc</kbd> closes it; it also closes with the presentation.

## Math (KaTeX)

Inline `$…$` and display `$$…$$` TeX render via KaTeX — the same delimiters
as Inkdrop's own math plugin:

```markdown
Euler's identity $e^{i\pi} + 1 = 0$ inline, or as a block:

$$
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
$$
```

Delimiter rules (remark-math style), so prose with dollar signs is safe:

- An opening `$` must not be followed by whitespace; a closing `$` must not
  be preceded by whitespace or followed by a digit — `costs $5 and $10`
  never becomes math.
- `\$` always renders a literal dollar sign.
- Math inside fenced code, inline backticks, or 4-space-indented lines is
  never rendered.
- Invalid TeX shows as red source text instead of blocking the deck.

KaTeX (and its fonts) load only when a note actually contains math.

## Themes

- **`inkdrop`** (default): mirrors your current Inkdrop theme — background,
  text, headings, links, code surfaces, fonts — and follows light/dark
  switches live.
- **Reveal classics**: `black`, `white`, `league`, `night`, `serif`,
  `simple`. Webfonts they reference fall back to system fonts.

## Limitations

- Mermaid diagrams render as SVG; a malformed diagram shows an inline error
  instead of blocking the deck.
- The speaker view window relies on undocumented Inkdrop internals; if a
  future Inkdrop build changes them, <kbd>V</kbd> shows an error
  notification instead of a window.
- Slides are a snapshot: edits made while presenting appear the next time
  you open the deck.
