# Agent Guide — ink-presentation

Inkdrop v6 plugin presenting the current note as a Reveal.js slideshow.
Works for any coding agent (Claude Code, Codex, …).

## Project facts

- TypeScript strict, CJS bundle via tsdown; `src/core/` is pure and fully
  unit-tested (vitest); DOM/host code in `src/reveal/` and `src/ui/`.
- Verify chain before committing: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- CSS ships as generated TS strings — run `pnpm gen:css` (part of `build`/`dev`)
  after touching `scripts/gen-css.mjs` manifest or `src/themes/*.css`.
- Architecture and the reasoning behind every non-obvious decision:
  `docs/architecture.md` (read before structural changes).
- Git: no Co-Authored-By trailers in commits.

## Working with an agent (people ↔ agent boundary)

The hard constraint: **an agent cannot run Inkdrop.** The verify chain and
the jsdom DOM tests are the agent's ceiling. Anything that needs a live app
— Reveal's real layout, the speaker-window IPC, large-deck behavior — is
verified by a human. So:

- An agent does not claim a runtime-touching change is "done" on green
  tests alone. It stops at "verify chain + DOM tests green" and hands off
  the relevant checklist from `docs/verifying.md`. The human runs it.
- Structural changes update `docs/architecture.md` in the same change — that
  file is the agent's map of _why_, and keeping it true is what makes the
  next session fast. Stale architecture docs are worse than none.
- Test-first for bugs: reproduce the bug as a failing test before fixing.
  `core/` bugs → a node vitest case; DOM/host bugs → a `test/dom/` case. A
  bug only reproducible in the live app (Reveal layout, IPC) → record the
  repro steps and the `docs/verifying.md` line that catches it, since no
  automated test can.
- Run `/security-review` on any change to the rendering path — this plugin
  renders content authored in _other people's_ notes (sync/share), so slide
  HTML, CSS injection, and the speaker IPC are a real trust boundary. Run
  `/code-review` before committing non-trivial diffs.
- Large or multi-step work: use plan mode, then track it in the roadmap
  note (below). One commit (or tight series) per workstream, verify chain
  between.

## After an Inkdrop upgrade

The speaker view and a few host touchpoints ride on undocumented Inkdrop
internals (`create-simple-window`, `broadcast-command`, `window:close`, the
`editingNote` store slice, `nodeIntegration`). They can break silently on
any app update. Run **`docs/canary-upgrade.md`** — it enumerates the exact
surfaces and how to re-verify each.

## Inkdrop tracking notebook (ownership split — no mirroring)

Each piece of content has exactly one source of truth:

- **Repo owns** public/code-coupled docs: README, `docs/`, CHANGELOG.
- **Inkdrop notebook "Ink-Presentation"** (`book:e1wyC-dV`) **owns**
  tracking: roadmap states/research/progress log, release traceability.

Touchpoints (the only cross-updates): shipping a roadmap item/release means
updating CHANGELOG.md AND the roadmap + release-log notes in the same
session; a material scope change refreshes the README "Planned features"
paragraph.

- Note IDs pinned in `docs/inkdrop-notes.json` — address notes by ID, never
  search-and-guess, never duplicate.
- Procedure and rules: `.claude/skills/inkdrop-docs-sync/SKILL.md` (Claude
  Code loads it as a skill; other agents follow the file directly).
- Note authoring conventions (Mermaid safety, linking, statuses, tags):
  `~/agent-rules/tools/inkdrop-v6/`.
