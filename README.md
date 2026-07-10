# ink-presentation

Present your Markdown notes as beautiful [Reveal.js](https://revealjs.com) slideshows inside [Inkdrop](https://www.inkdrop.app/) v6 — no external tools, no leaving the app.

- 🎨 **App-native theme by default** — slides follow your Inkdrop theme (light/dark, colors, fonts) live, plus 6 classic Reveal themes
- ✂️ **Flexible slide splitting** — `---` breaks, or automatic `#`/`##` heading splitting with vertical stacks
- 🗒️ **Speaker notes** — `<!-- note: ... -->` comments or `Note:` lines, shown in an in-deck overlay
- 🧱 **Code-fence aware** — `---`, `#`, and `Note:` inside code blocks never break your slides
- ⚙️ **Per-note config** — override theme, transition, and splitting via YAML frontmatter
- 🔒 **Fully isolated** — the deck renders in a Shadow DOM; plugin styles never leak into the app

## Install

Not yet on the plugin registry (see [Publishing](#publishing)). Manual install:

```bash
git clone https://github.com/crafts69guy/ink-presentation.git
cd ink-presentation
pnpm install && pnpm build
ln -sfn "$PWD" ~/Library/Application\ Support/inkdrop/packages/ink-presentation
```

> **Inkdrop v6 canary:** the canary build keeps its data in `inkdrop-canary`
> instead of `inkdrop` — link into
> `~/Library/Application Support/inkdrop-canary/packages/ink-presentation`.

## Usage

Open a note, then press <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>P</kbd> or select **Plugins ▸ Toggle Presentation**.

### Keys while presenting

| Key | Action |
| --- | --- |
| <kbd>→</kbd> / <kbd>↓</kbd> / <kbd>Space</kbd> / <kbd>PgDn</kbd> / <kbd>N</kbd> | Next slide |
| <kbd>←</kbd> / <kbd>↑</kbd> / <kbd>PgUp</kbd> / <kbd>P</kbd> | Previous slide |
| <kbd>Home</kbd> / <kbd>End</kbd> | First / last slide |
| <kbd>O</kbd> | Overview grid |
| <kbd>S</kbd> | Toggle speaker notes |
| <kbd>F</kbd> | Toggle fullscreen |
| <kbd>B</kbd> / <kbd>.</kbd> | Pause (black screen) |
| <kbd>Esc</kbd> | Close overview → exit fullscreen → close presentation |

### Writing slides

See **[docs/writing-slides.md](docs/writing-slides.md)** for the full guide. Quick example:

````markdown
---
theme: inkdrop
transition: fade
---

# My Talk

Intro slide

---

## Code

```js
const answer = 42
```

<!-- note: mention the benchmark here -->
````

## Settings

**Preferences ▸ Plugins ▸ ink-presentation**

| Setting | Default | Description |
| --- | --- | --- |
| Slide separator | `hr` | `hr` splits on `---`; `h1`/`h2` split on headings (`h2` stacks H2s vertically) |
| Theme | `inkdrop` | `inkdrop` follows the app theme; also black, white, league, night, serif, simple |
| Slide transition | `slide` | none / fade / slide / convex / concave / zoom |
| Enter fullscreen automatically | on | |
| Show slide number | on | |
| Show progress bar | on | |
| Vertical slides | off | Enables `--` as a vertical separator in `hr` mode |

Frontmatter keys (`theme`, `transition`, `separator`, `slideNumber`, `progress`, `verticalSlides`) override these per note.

## Known limitations

- **Mermaid diagrams and math** render as plain code blocks (planned for v2)
- **No popup speaker view** — notes show as an in-deck overlay (`S`); a separate presenter window is a v2 goal
- **No PDF/HTML export** yet (v2)
- Webfonts referenced by Reveal's built-in themes (League Gothic, Source Sans Pro) fall back to system fonts — fonts can't load inside a shadow root

## Development

```bash
pnpm install
pnpm build        # generate CSS modules + bundle to lib/
pnpm dev          # watch mode
pnpm test         # unit tests (vitest)
pnpm typecheck && pnpm lint
```

Link into Inkdrop for development (note the canary data-dir caveat — `ipm link --dev` targets the stable `inkdrop` dir only):

```bash
ln -sfn "$PWD" ~/Library/Application\ Support/inkdrop-canary/dev/packages/ink-presentation
```

Enable **Development Mode** in Preferences ▸ General and reload (<kbd>⌥⌘⇧R</kbd>).

Architecture notes: **[docs/architecture.md](docs/architecture.md)**.

## Publishing

Not published to the plugin registry for now — install from GitHub as
described above. For future reference: `ipm publish` is git-tag driven
(`ipm publish --dry-run` validates without publishing) and requires an
Inkdrop plugin developer license, whose issuance is currently paused
upstream.

## Roadmap

- **v2**: PDF/HTML export, Mermaid & KaTeX rendering, popup speaker view, custom per-note CSS

## License

[MIT](LICENSE)
