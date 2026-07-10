# Changelog

All notable changes to ink-presentation are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Vim-style `hjkl` keys for slide navigation, mirroring the arrow keys
  (`h`/`k` previous, `j`/`l` next)

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
