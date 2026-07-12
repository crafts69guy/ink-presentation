# Changelog

All notable changes to ink-presentation are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Security

- Note-authored HTML in slides is now sanitized with DOMPurify after
  RevealMarkdown converts it: `<script>`, `<iframe>`, inline event handlers,
  `javascript:` URLs, inline `<style>`, and `data-background-iframe` slide
  attributes are stripped. Presenting a synced or shared note can no longer
  execute markup it carries; benign inline HTML, images, math placeholders,
  mermaid fences, and code highlighting are unaffected. The speaker view's
  mini decks enforce the same pass independently

### Changed

- Slides now hydrate lazily: Mermaid diagrams, KaTeX math, and code
  highlighting render for the visible slide and its neighbors first, then
  fill in during idle time — a large deck opens near-instantly instead of
  waiting for every diagram in the note. Auto-refresh rebuilds only pay for
  the visible slides
- The speaker view no longer re-renders its mini decks when a presenter
  rebuild carries an unchanged deck, and its previews skip background
  hydration entirely

### Fixed

- A mermaid module load failure (missing or corrupt install) now shows an
  inline error per diagram instead of closing the whole presentation
- Concurrent mermaid renders (speaker view's two previews) can no longer
  collide on render element ids or interleave global mermaid configuration

### Internal

- oxfmt is pinned as a devDependency with a repo-style config, the codebase
  is formatted once, and CI now runs a format check
- New jsdom-based vitest project covers the DOM layer: sanitization,
  hydration scheduling, mermaid degradation, and keyboard capture
- package.json `files` keeps the 1.2 MB sourcemap out of any published
  package

## [0.2.0] - 2026-07-12

The v2 feature milestone: everything from the roadmap that isn't blocked
upstream (registry publication still is). Install from GitHub as before.

### Added

- Auto-refresh while presenting: when the presented note changes (edited in
  another window, or synced from another device), the open deck rebuilds in
  place after a short debounce, keeping the current slide position and the
  speaker view in sync. On by default; disable via the new "Auto-refresh
  the deck while presenting" setting to get the old snapshot behavior
- Custom per-note CSS: a `css` frontmatter key (YAML block scalar) restyles
  that note's deck. Injected after the theme so it wins; Shadow DOM keeps it
  out of the app UI; `@import`/`@font-face` are stripped and `url()`
  references other than `data:`/`#fragment` are neutralized so shared notes
  can't phone home when presented. The speaker view's previews follow it
- Speaker view: press <kbd>V</kbd> while presenting to open a separate,
  synced window showing the current slide, the upcoming slide, speaker
  notes, a slide counter, wall clock, and a resettable elapsed timer.
  Navigation works from either window. Built on Inkdrop's own cross-window
  IPC (`create-simple-window` + `broadcast-command`); since those internals
  are undocumented, the plugin degrades to an error notification if a
  future Inkdrop build changes them
- KaTeX math rendering in slides: `$inline$` and `$$display$$` TeX, the same
  delimiters as Inkdrop's math plugin, with remark-math strictness so prose
  like `costs $5 and $10` is never misread as math (`\$` escapes a literal
  dollar; code fences, inline backticks, and indented code are never
  touched). KaTeX, its stylesheet, and its fonts load lazily from the
  plugin's own dependencies only when a note contains math — the plugin
  bundle and math-free decks pay nothing. Invalid TeX renders as red source
  text instead of blocking the deck
- Mermaid diagram rendering in slides. Diagrams are rendered lazily (mermaid
  is only loaded when a deck contains a `mermaid` code fence) and a malformed
  diagram shows an inline error instead of blocking the deck. Diagram colors
  follow the deck's theme: the `inkdrop` theme matches the live app palette
  (light/dark, text, accent colors), other themes get mermaid's own
  light/dark built-in for contrast
- `auto` slide separator mode (now the default): picks `---` if present,
  otherwise splits on whichever heading level the note actually uses — H1
  (with H2 nested vertically if also present), or H2 promoted to a flat,
  horizontal split when there's no H1 to nest it under
- Vim-style `hjkl` keys for slide navigation, mirroring the arrow keys
  (`h`/`k` previous, `j`/`l` next)
- `ink-presentation:present-sample` command (**Plugins ▸ Present Sample
  Deck**) presents a bundled demo note showcasing the plugin's features,
  without needing a note of your own. Gated by the new "Show 'Present Sample
  Deck' command" setting (on by default)

### Changed

- Default `slideSeparator` is now `auto` instead of `hr`. Notes that already
  use `---` render identically; heading-only notes with no `---` (previously
  a single slide) now split by heading automatically

### Fixed

- <kbd>Esc</kbd> now always closes the presentation, even while fullscreen
  (previously required a second press)

## [0.1.0] - 2026-07-10

First feature-complete v1 (not yet published to the plugin registry).

### Added

- Present the current note as a Reveal.js 5 deck inside Inkdrop v6
  (`ink-presentation:toggle`, <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>P</kbd>,
  Plugins menu)
- Slide splitting modes: `hr` (`---`), `h1`, `h2` (vertical stacks), all
  code-fence aware; optional `--` vertical separator in `hr` mode
- YAML frontmatter deck config (`theme`, `transition`, `separator`,
  `slideNumber`, `progress`, `verticalSlides`) overriding plugin settings,
  with validation warnings
- `inkdrop` theme mapping the live app theme (light/dark aware) via CSS
  custom properties across the shadow boundary, plus Reveal's black, white,
  league, night, serif, and simple themes
- Syntax highlighting via highlight.js (common languages), light/dark sheet
  paired to the theme
- Speaker notes from `<!-- note: ... -->` comments and `Note:` lines, shown
  in an in-deck overlay (<kbd>S</kbd>)
- Keyboard navigation, overview grid, pause/black screen, fullscreen with
  automatic entry option, slide number and progress bar
- Live deck rebuild on settings, app-theme, and OS-appearance changes with
  slide position preserved
