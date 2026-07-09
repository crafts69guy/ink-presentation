# ink-presentation

Present your Markdown notes as beautiful [Reveal.js](https://revealjs.com) slideshows inside [Inkdrop](https://www.inkdrop.app/) v6.

> ⚠️ Work in progress — currently at milestone M1 (skeleton). The presentation
> shows a demo deck; rendering the actual note body lands in M2.

## Usage

Open a note, then:

- Press <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>P</kbd>, or
- Select **Plugins ▸ Toggle Presentation** from the menu

### Keys while presenting

| Key                                                                             | Action                                                |
| ------------------------------------------------------------------------------- | ----------------------------------------------------- |
| <kbd>→</kbd> / <kbd>↓</kbd> / <kbd>Space</kbd> / <kbd>PgDn</kbd> / <kbd>N</kbd> | Next slide                                            |
| <kbd>←</kbd> / <kbd>↑</kbd> / <kbd>PgUp</kbd> / <kbd>P</kbd>                    | Previous slide                                        |
| <kbd>Home</kbd> / <kbd>End</kbd>                                                | First / last slide                                    |
| <kbd>O</kbd>                                                                    | Overview grid                                         |
| <kbd>F</kbd>                                                                    | Toggle fullscreen                                     |
| <kbd>B</kbd> / <kbd>.</kbd>                                                     | Pause (black screen)                                  |
| <kbd>Esc</kbd>                                                                  | Close overview → exit fullscreen → close presentation |

## Settings

**Preferences ▸ Plugins ▸ ink-presentation**

| Setting                        | Default   | Description                                                     |
| ------------------------------ | --------- | --------------------------------------------------------------- |
| Slide separator                | `hr`      | `hr` splits slides on `---`, `h1`/`h2` split on headings        |
| Theme                          | `inkdrop` | `inkdrop` follows the app theme; others are Reveal.js built-ins |
| Slide transition               | `slide`   | none / fade / slide / convex / concave / zoom                   |
| Enter fullscreen automatically | on        |                                                                 |
| Show slide number              | on        |                                                                 |
| Show progress bar              | on        |                                                                 |
| Vertical slides                | off       | Enables `--` as vertical separator in `hr` mode                 |

## Development

```bash
pnpm install
pnpm build        # generate CSS modules + bundle to lib/
pnpm dev          # watch mode
pnpm test         # unit tests (vitest)
pnpm typecheck && pnpm lint
```

Link into Inkdrop (note: the v6 canary uses the `inkdrop-canary` data
directory, which `ipm link --dev` does not target — symlink manually):

```bash
ln -sfn "$PWD" ~/Library/Application\ Support/inkdrop-canary/dev/packages/ink-presentation
```

Then enable **Development Mode** in Preferences ▸ General and reload the app
(<kbd>⌥⌘⇧R</kbd>).

## Roadmap

- M2: render the real note body (frontmatter, `hr`/`h1`/`h2` splitting, syntax highlighting)
- M3: themes, including the Inkdrop-native theme following app light/dark
- M4: speaker notes overlay + polish
- v2: PDF/HTML export, Mermaid & math support, popup speaker view

## License

MIT
