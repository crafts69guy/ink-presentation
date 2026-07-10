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

## Inkdrop docs notebook (must keep in sync)

Project docs are mirrored into the Inkdrop notebook **"Ink-Presentation"**
(`book:e1wyC-dV`) via Inkdrop MCP tools. The repo is the source of truth.

- Note IDs are pinned in `docs/inkdrop-notes.json` — address notes by ID,
  never search-and-guess, never duplicate.
- Mapping and procedure: `.claude/skills/inkdrop-docs-sync/SKILL.md`
  (Claude Code loads it as the `inkdrop-docs-sync` skill; other agents:
  follow the file directly).
- Sync whenever you change `README.md` (roadmap/usage/dev sections),
  `CHANGELOG.md`, or `docs/architecture.md`, and after shipping a
  milestone/release.
- Note authoring conventions (Mermaid safety, linking, statuses, tags):
  `~/agent-rules/tools/inkdrop-v6/`.
