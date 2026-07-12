# In-app verification

The automated chain (`pnpm typecheck && pnpm lint && pnpm test && pnpm
build`) and the jsdom DOM tests cover the pure pipeline, the sanitize pass,
hydration scheduling, and key handling. They **cannot** cover the parts that
need a running Inkdrop: Reveal's real layout, the speaker-window IPC, and
how the deck behaves under load. Those are verified by hand here.

An agent cannot run Inkdrop. So for any change touching runtime behavior,
the agent stops at "verify chain + DOM tests green" and hands off this
checklist; a human runs it before tagging a release.

Reload the plugin first: Development Mode on, <kbd>⌥⌘⇧R</kbd>.

## Always, before a release

- [ ] **Sample deck** (`Plugins ▸ Present Sample Deck`): every feature
      renders — headings split into slides, code highlighted, a mermaid
      diagram, KaTeX math, speaker notes overlay (<kbd>S</kbd>), custom CSS
      accent. This is the broad regression.
- [ ] **A real note** presents and closes cleanly; <kbd>Esc</kbd> and the
      toggle command both close it; fullscreen exits on close.

## Security (rendering-path changes)

Present a note whose body contains this, and confirm nothing executes — no
alert fires, the broken image shows, the link has no `href`:

    <img src=x onerror="alert('pwned')">
    <script>alert('pwned')</script>
    [link](javascript:alert('pwned'))

- [ ] None of the above runs.
- [ ] Benign inline HTML still renders (e.g. a `<sub>`/`<sup>`, a table).

## Performance / scale (hydration or rendering changes)

- [ ] A large note (~150 slides, ~30 mermaid, ~50 math) opens near-instantly
      — not after a visible whole-deck render stall.
- [ ] Paging with arrow keys is smooth; the next slide shows no "pop-in" of
      diagrams/math (neighbors hydrate ahead).
- [ ] Overview grid (<kbd>O</kbd>) fills in without freezing.
- [ ] Editing a large note while presenting (auto-refresh) stays responsive.

## Speaker view (any speaker / IPC / hydration change)

- [ ] <kbd>V</kbd> opens the window; it fills with current + next slide,
      notes, counter, clock, timer.
- [ ] Navigation syncs both directions (keys in either window; the speaker's
      Next/Prev buttons).
- [ ] <kbd>Esc</kbd> in the speaker window closes only it; closing the
      presentation closes it too.
- [ ] Changing a setting mid-deck does **not** flicker/rebuild the mini
      decks when the deck content is unchanged.
- [ ] With the speaker view open, editing the note re-renders only the
      visible slides.

## Degradation

- [ ] A mermaid fence with invalid syntax shows an inline red error; the
      rest of the deck is unaffected.
- [ ] Malformed frontmatter shows a warning toast (once, not per keystroke)
      and still presents.

## After an Inkdrop upgrade

Run **[canary-upgrade.md](canary-upgrade.md)** as well — it targets the
undocumented IPC surfaces specifically.
