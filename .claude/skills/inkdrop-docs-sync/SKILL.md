---
name: inkdrop-docs-sync
description: Update the project's Inkdrop tracking notebook "Ink-Presentation" (book:e1wyC-dV) via Inkdrop MCP. Use when shipping a roadmap item or release (update roadmap + release-log notes alongside CHANGELOG.md), when roadmap tracking changes, or when asked to update project notes.
---

# Inkdrop tracking notebook

Ownership model — every piece of content has exactly **one** source of
truth; nothing is mirrored:

- **Repo owns** public/code-coupled docs: `README.md`, `docs/architecture.md`,
  `docs/writing-slides.md`, `CHANGELOG.md`. Edit them in git only; do not
  copy them into notes.
- **Notebook owns** tracking: roadmap states/research/progress log, and
  release traceability (milestone/commit table, release procedure).

## Note map

Note IDs are pinned in `docs/inkdrop-notes.json` — read it first and address
notes by ID. Never create duplicates; if a note is missing, recreate it and
update the JSON in the same change.

## Touchpoints (the only cross-updates)

1. **Shipping a roadmap item / release**: update `CHANGELOG.md` in the repo
   AND, in the same session: set the item's state in the `roadmap` note
   (todo/researching/in-progress/done/dropped), append a dated Progress-log
   line, and add the version + commit row to the `releaseLog` note.
2. **Material scope change** (feature added/dropped from v2): refresh the
   short "Planned features" paragraph in `README.md` and the `roadmap`
   table. Day-to-day state changes do NOT touch the README.

## Procedure

1. Read `docs/inkdrop-notes.json` for notebook + note IDs.
2. `read-note` the target note (list/search bodies are truncated).
3. Prefer `patch-note` for exact replacements; `update-note` (fresh `_rev`)
   only when regenerating a whole section.
4. Report: note title, ID, what changed.

Known MCP limitation: moving a note to trash (`bookId: "trash"`) returns
400 — archive instead (retitle `[Archived] …`, status `dropped`, stub body)
and ask the user to delete it in the app.

## Authoring rules (must follow)

Follow `~/agent-rules/tools/inkdrop-v6/` (README routes to the rule files):

- Bodies: concise, no H1 duplicating the title, no `Tags:` lines (native tags).
- Mermaid: `flowchart LR/TD`; no Markdown lists or literal `\n` in labels; `<br/>` for line breaks; no emoji in labels.
- Links: `[Title](inkdrop://note/<id-without-note:-prefix>)`; never invent IDs.
- Statuses: `active` for living tracking notes, `none` for the index.
