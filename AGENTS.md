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
