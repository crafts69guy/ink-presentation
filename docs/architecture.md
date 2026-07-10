# Architecture

How ink-presentation turns an Inkdrop note into a Reveal.js deck, and why it
is built the way it is.

## Overview

```
ink-presentation:toggle (command / ⌃⌥P / menu)
        │
        ▼
src/index.ts ── reads store.editingNote ── emits via presentation-events
        │
        ▼
PresentationView (always mounted in the `modal` layout region, renders null when closed)
        │
        ├─ prepareDeck(body, config)          src/core/pipeline.ts   ← pure, unit-tested
        │    ├─ extractFrontmatter            src/core/frontmatter.ts
        │    ├─ parseDeckConfig + merge       src/core/deck-config.ts
        │    ├─ splitSlides (fence-aware)     src/core/split.ts
        │    └─ buildSlideMarkdown (notes)    src/core/notes.ts
        │
        ├─ RevealManager                      src/reveal/reveal-manager.ts
        │    ├─ Shadow DOM + style injection  (themes.ts, core/css.ts)
        │    └─ Reveal lifecycle (embedded, keyboard:false)
        │
        ├─ key-controller                     src/reveal/key-controller.ts
        └─ NotesOverlay                       src/ui/NotesOverlay.tsx
```

Design rule: everything under `src/core/` is **pure** (no DOM, no `inkdrop`
global) and covered by vitest. DOM and host-API code lives in `src/reveal/`
and `src/ui/`.

## Key decisions

### Shadow DOM isolation

Reveal's stylesheets (reset.css, reveal.css, themes) are not fully scoped —
loading them app-wide would bleed into Inkdrop. The deck therefore renders
inside a shadow root on the overlay host. Two consequences:

1. **Hard two-way isolation** — Reveal styles can't touch the app; app styles
   can't break slide layout.
2. **CSS custom properties still inherit through the boundary** — which is
   exactly what the `inkdrop` theme exploits (see below).

Before injection every third-party sheet passes through `core/css.ts`:
`:root` → `:host` (`:root` never matches inside a shadow tree) and
`@import`/`@font-face` stripping (fonts can't load from a shadow root; themes
fall back to the next family in their stacks).

### CSS as generated TypeScript

tsdown's css-guard intercepts `.css` imports and wants CSS *bundling*; we
need CSS *text* to inject into the shadow root. `scripts/gen-css.mjs`
materializes each sheet as `src/generated/*.css → .ts` string modules ahead
of the build (`pnpm gen:css`, wired into `build`/`dev`). Deterministic, no
bundler magic.

### The `inkdrop` theme

`src/themes/inkdrop.css` maps Reveal's `--r-*` contract onto Inkdrop's app
variables (`--editor-background`, `--text-color`, `--mde-preview-*`,
`--font-name`, …) with fallback chains. Because custom properties resolve
live across the shadow boundary, switching the app theme restyles an open
deck instantly. Structurally it reuses black.css (whose rules only read
`--r-*` vars) and injects the mapping after the highlight.js sheet so its
code-block surfaces win.

Highlight.js light/dark pairing: static per built-in theme; for `inkdrop` a
probe element resolves `--editor-background` and `core/color.ts` classifies
its luminance.

### Sentinel-based slide splitting (not Reveal separators)

RevealMarkdown's `slidify()` advances its exec loop with `regex.lastIndex`,
which **infinite-loops on zero-width matches** — lookahead separators like
`^(?=# )` freeze the app. It is also regex-only, so `---` or `#` inside code
fences would falsely split.

Instead, `core/split.ts` walks lines with fence tracking and splits itself
(`hr`/`h1`/`h2` modes, vertical stacks), then joins slides with sentinel
lines (`<!--ink-slide-->` / `<!--ink-vslide-->`) that are passed to Reveal as
`data-separator` regexes. Sentinels always consume characters, so the exec
loop is safe — `test/pipeline.test.ts` contains a faithful replica of
slidify's loop as an oracle proving termination and slide shape.

### Math placeholders, not a marked extension (KaTeX)

RevealMarkdown pipes slide markdown through marked, which mangles TeX
(`_` → `<em>`, `\\` collapses) before any math hook could run — and Reveal's
own math plugin fetches KaTeX from a CDN. Instead `core/math.ts` lifts
`$…$` / `$$…$$` segments out in the pure pipeline (fence- and backtick-aware,
remark-math delimiter rules so `$5 and $10` stays prose), replacing each with
an empty `<span data-ink-math="…">` carrying URI-encoded TeX. The placeholder
is inert through marked, slide splitting, and notes handling — running before
`splitSlides` also means a `$$` block spanning `---`/`# ` lines can never
falsely split a slide. After RevealMarkdown converts the slides,
`RevealManager.renderMathExpressions` renders KaTeX into the placeholders
(`throwOnError: false`, `trust: false`); placeholders inside `aside.notes`
get raw TeX text instead, because the notes overlay renders text only.

KaTeX's CSS needs its webfonts, but `@font-face` cannot live in a shadow root
(see `core/css.ts`). `reveal/katex-assets.ts` therefore reads katex.min.css
and the .woff2 files off disk from the installed package at first use, injects
the font faces **once at document level** as `data:` URIs (document-level
fonts apply inside shadow trees), and hands the font-face-free remainder to
the shadow root. A `document.fonts.ready` hook triggers one extra
`deck.layout()` as glyph metrics settle. If asset loading fails, placeholders
degrade to plain TeX text rather than blanking the deck.

### Speaker notes normalization

RevealMarkdown attaches notes only when the notes separator splits a slide
into **exactly two** parts. `core/notes.ts` therefore extracts all note
sources per slide (`<!-- note: ... -->` comments and literal `Note:` lines,
fences masked via `core/fences.ts`) and re-emits a single trailing `Note:`
block. The overlay (`NotesOverlay.tsx`) renders the notes as React text
nodes only — no HTML injection surface.

### Single keyboard owner

Reveal runs with `keyboard: false`. `key-controller.ts` installs one
window-level capture-phase keydown listener while the deck is open, maps keys
to actions (pure `mapKeyToAction`, unit-tested), and stops propagation so
Inkdrop keymaps never fire mid-presentation. Cmd/Ctrl/Alt combos pass
through untouched. Esc semantics: overview → close (exiting fullscreen along
the way if active). `hjkl` mirror the arrow keys for vim-style navigation.

### Reveal lifecycle vs React 19

React renders only the overlay shell; `RevealManager` builds the deck DOM
imperatively and owns a small state machine
(`idle → initializing → ready → destroyed`) making `destroy()` idempotent and
safe against StrictMode's double-effect and rapid toggling (a `cancelled`
flag covers destroy-during-async-initialize). The markdown template is
assigned via `textContent`, so note content containing `</script>` cannot
break out.

Rebuilds (settings/theme/OS-appearance changes while open) bump a `deckKey`;
slide position survives via `initialSlide`. A `ResizeObserver` drives
`deck.layout()` on window resize and fullscreen transitions.

### Host integration

- Component registered once at `activate()` into the `modal` layout region;
  toggling shows/hides it (pattern from Inkdrop's own plugins).
- The `Environment` from `activate(app)` is held in `src/env.ts` — the global
  `inkdrop` is deprecated in `@inkdropapp/types`.
- Built output is CJS with only `require("react")` external — the host is
  not known to provide `react/jsx-runtime`, hence the classic JSX transform.
- `keymaps/`, `menus/`, `styles/` load by directory convention (declaring
  them in package.json with paths breaks resolution).

## Bundle budget

Single `lib/index.js` (~475 kB min / ~130 kB gzip): reveal.js + markdown
plugin, `highlight.js/lib/common` (~40 languages — Reveal's highlight plugin
inlines all of highlight.js and tripled the bundle), js-yaml, event-kit, and
the generated CSS strings.

`mermaid` and `katex` are deliberately kept out of this figure: both are
declared as real `dependencies` (not `devDependencies`), listed in
`tsdown.config.ts`'s `neverBundle` array so they're never inlined, and loaded
via a cached `await import(…)` only when a deck actually needs them — a
`mermaid` fenced code block (`RevealManager.renderMermaidDiagrams`) or a math
placeholder (`RevealManager.renderMathExpressions`). KaTeX's CSS and fonts
(~300 kB of .woff2) follow the same rule via `reveal/katex-assets.ts`, read
off disk at first use instead of shipping in the bundle — the same "don't pay
for what you don't use" reasoning as `highlight.js/lib/common` above, just
via lazy loading instead of a narrower static subset.

## Dev-environment gotcha: canary data directory

The Inkdrop v6 canary uses `~/Library/Application Support/inkdrop-canary/`,
but `ipm` (1.1.1) hardcodes the stable `inkdrop` dir — `ipm link --dev` puts
the symlink where the canary never looks. Symlink manually into
`inkdrop-canary/dev/packages/` (see README).
