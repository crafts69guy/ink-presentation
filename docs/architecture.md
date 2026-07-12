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
        │    ├─ Reveal lifecycle (embedded, keyboard:false)
        │    ├─ sanitizeSlideContent          src/reveal/sanitize.ts
        │    └─ DeckHydrator (lazy per-slide) src/reveal/hydrate.ts
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

tsdown's css-guard intercepts `.css` imports and wants CSS _bundling_; we
need CSS _text_ to inject into the shadow root. `scripts/gen-css.mjs`
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

### Note-authored CSS (frontmatter `css`)

Injected as the last sheet in the shadow root so it wins over the theme.
Hardening happens at the injection point (`RevealManager.injectStyles`), not
in the pure pipeline, so the speaker window enforces it independently on the
options it receives over IPC: `prepareForShadowRoot` strips
`@import`/`@font-face` like every sheet, and `core/css.ts`'s
`stripRemoteUrls` empties any `url()` that isn't a `data:` URI or
`#fragment` — presenting a shared note must not beacon out. Shadow DOM
scoping already keeps it away from the app UI.

### Note-authored HTML is sanitized after conversion (DOMPurify)

Threat model: RevealMarkdown's bundled marked converts note markdown with
raw HTML passthrough, and Inkdrop's renderer runs with nodeIntegration — so
presenting a synced or shared note someone else authored would execute its
`<script>`/`onerror` handlers with Node privileges. `reveal/sanitize.ts`
runs DOMPurify over every converted slide inside `RevealManager.initialize`,
per the same principle as the CSS channel above: hardening lives at the one
choke point both windows share, so the speaker window's mini decks are
covered on IPC-received markdown with zero extra protocol work.

Why a post-convert DOM pass and not a marked hook or escaping raw HTML in
the pipeline: it preserves legit inline HTML (marked output plus benign
author markup), and it also catches attributes RevealMarkdown itself copies
onto `<section>` elements from `<!-- .slide: ... -->` comments — those never
pass through marked at all. Ordering matters twice: the pass runs after
`deck.initialize()` (nothing exists to sanitize before conversion) and
before the mermaid pass (mermaid SVG is sanitized internally by
`securityLevel: 'strict'` and would be mangled by an HTML-profile re-run).
KaTeX placeholders ride through as `data-*` attributes, which DOMPurify
keeps by default; the DOM test suite pins that behavior. `dompurify` is
bundled, not lazy-loaded like mermaid/katex — sanitization must fail
closed, so it cannot depend on a runtime import succeeding.

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
falsely split a slide. After RevealMarkdown converts the slides, the
hydration pass (`reveal/hydrate.ts`) renders KaTeX into the placeholders
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

### Speaker view: a second app window, driven over broadcast IPC

There is no public BrowserWindow API for plugins, and `window.open` is
hard-denied by the main process (it opens the URL externally). The speaker
view instead composes three of the app's own internal surfaces (found by
inspecting v6 canary.21's app.asar — undocumented, so every call degrades to
an error notification if it vanishes):

1. `create-simple-window` IPC opens a frameless, distraction-free app window
   whose `runCommands` are dispatched once that window's app is ready —
   after packages activate, so the plugin's `speaker-enter` command exists
   there (the app's quick-note feature uses the same mechanism).
2. `broadcast-command` IPC relays a command dispatch into every window; it
   is the transport for all speaker traffic, one command
   (`ink-presentation:speaker-message`) carrying a validated payload.
3. `window:close` IPC lets the speaker window close itself.

`core/speaker-protocol.ts` (pure, unit-tested) defines and validates the
messages. Broadcasts arrive in _all_ windows including the sender, so every
message carries a `sessionId` and a per-window `from` id for echo/foreign
filtering. State flows one way — the presenter answers `hello` with `init`
(prepared markdown + options + position, re-sent on every rebuild) and
streams `position` under a monotonic `seq` gate; the speaker window only
sends `nav` requests and lifecycle signals (`hello`/`bye`) — which makes
echo loops structurally impossible. `SpeakerView` (mounted in every
window's `modal` region, active only after a `speaker-enter` boot) renders
two non-interactive mini `RevealManager` decks from the same sentinel
markdown: one at the presenter's position, one advanced a step with
Reveal's own `next()` ordering.

### Lazy per-slide hydration (mermaid / KaTeX / highlight.js)

The expensive renderers used to run over the whole deck before it opened —
every diagram, expression, and code block, sequentially, off-screen slides
included, which was the scalability wall for large notes (and tripled when
the speaker view mirrored the deck with two more managers). `DeckHydrator`
(`reveal/hydrate.ts`) scopes all three renderers to one leaf `<section>` at
a time behind an idempotent `data-ink-hydrated` marker. `initialize()`
resolves once the visible slide and its one-keypress neighbors (document
order plus the vertical stack) are hydrated; every `slidechanged` hydrates
the newly reachable slides; the rest of the deck fills in one slide per
`requestIdleCallback` slice. `deck.layout()` runs only when hydration
changed the _current_ slide's content — off-screen height changes don't need
a refit, and Reveal re-lays out on navigation anyway. Because notes can
carry math placeholders that hydration resolves to text, the slide-changed
notification re-fires after a current-slide hydration.

Auto-refresh rebuilds deliberately stay full destroy/rebuild: with lazy
hydration a rebuild only pays for the visible slides, so per-keystroke cost
is near-constant. True incremental DOM diffing is an explicit non-goal.

Mermaid needs three extra guards, all module-level in `hydrate.ts`: render
element ids come from a monotonic counter (`Date.now()` collided when the
speaker's two mini decks hydrated in the same millisecond); renders from
concurrent managers are serialized through one promise chain because
`mermaid.initialize()` mutates global config and `render()` shares an
internal DOM sandbox; and a _module load_ failure degrades every diagram to
the inline error node instead of rejecting deck initialization (render
failures always did). The speaker's mini decks pass `hydrateVisibleOnly` —
they mirror a deck already rendered in full elsewhere, so background idle
hydration would be pure waste; the speaker window also skips rebuilding its
mini decks entirely when a presenter re-`init` carries unchanged
markdown/options.

### Reveal lifecycle vs React 19

React renders only the overlay shell; `RevealManager` builds the deck DOM
imperatively and owns a small state machine
(`idle → initializing → ready → destroyed`) making `destroy()` idempotent and
safe against StrictMode's double-effect and rapid toggling (a `cancelled`
flag covers destroy-during-async-initialize). The markdown template is
assigned via `textContent`, so note content containing `</script>` cannot
break out.

Rebuilds (settings/theme/OS-appearance changes while open, and note edits
arriving from another window or sync via a debounced `store.subscribe` on
`editingNote` — the host reloads it there when the note doc changes and the
local editor isn't dirty) bump a `deckKey` or swap in a `refreshedBody`;
slide position survives via `initialSlide`, and a warnings-changed guard
keeps mid-edit invalid frontmatter from re-toasting on every keystroke. A
`ResizeObserver` drives `deck.layout()` on window resize and fullscreen
transitions.

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
`mermaid` fenced code block or a math placeholder reaching the hydration
pass (`reveal/hydrate.ts`). KaTeX's CSS and fonts
(~300 kB of .woff2) follow the same rule via `reveal/katex-assets.ts`, read
off disk at first use instead of shipping in the bundle — the same "don't pay
for what you don't use" reasoning as `highlight.js/lib/common` above, just
via lazy loading instead of a narrower static subset.

Two deliberate non-optimizations, evaluated 2026-07-12:

- **All 7 theme CSS string modules stay eagerly imported** in
  `reveal/themes.ts` (~57 kB, only one theme renders per deck). Making them
  dynamic imports would force `injectStyles` async on the deck-open critical
  path and emit CJS chunks the plugin loader would have to resolve — real
  complexity for an ~11 % bundle win. Revisit only if the budget becomes a
  constraint.
- **The 1.2 MB sourcemap is generated but not packaged.** `sourcemap: true`
  stays on for development; package.json's `files` field limits any
  npm-style pack to `lib/index.js` + the convention directories, so the map
  never ships.

## Dev-environment gotcha: canary data directory

The Inkdrop v6 canary uses `~/Library/Application Support/inkdrop-canary/`,
but `ipm` (1.1.1) hardcodes the stable `inkdrop` dir — `ipm link --dev` puts
the symlink where the canary never looks. Symlink manually into
`inkdrop-canary/dev/packages/` (see README).
