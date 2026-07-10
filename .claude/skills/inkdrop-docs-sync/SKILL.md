---
name: inkdrop-docs-sync
description: Sync this repo's docs into the Inkdrop notebook "Ink-Presentation" (book:e1wyC-dV) via Inkdrop MCP. Use after changing README.md (roadmap/usage), CHANGELOG.md, docs/architecture.md, shipping a milestone/release, or when asked to update project notes.
---

# Inkdrop docs sync

The repository is the **source of truth**; the Inkdrop notebook is its
readable mirror plus tracking layer. This skill keeps them consistent.

## Note map

Note IDs are pinned in `docs/inkdrop-notes.json` — always read it first and
address notes by ID. Never create a duplicate note; if a note is missing,
recreate it, then update the JSON in the same change.

| Repo change | Note to update | What to sync |
| --- | --- | --- |
| README Roadmap section | `roadmap` | Mirror the checklist into the state table (todo/researching/in-progress/done/dropped); append a dated line to Progress log |
| CHANGELOG / release shipped | `releaseLog` | New version section with highlights + milestone/commit table |
| docs/architecture.md | `architecture`, `decisions` | Update diagrams/tables; add an ADR entry (ADR-NNN, newest first) for each new non-obvious decision |
| README Development / dev gotchas | `devWorkflow` | Commands, canary data-dir caveat, smoke checklist, environment facts |
| New/renamed notes | `index` | Keep the note list and sync-contract table current |

## Procedure

1. Read `docs/inkdrop-notes.json` for notebook + note IDs.
2. `read-note` the target note (full body) — bodies from list/search are truncated.
3. Prefer `patch-note` for small exact replacements; `update-note` (with fresh `_rev`) only when regenerating a whole section/body.
4. Report: note title, ID, what changed.

## Authoring rules (must follow)

Follow `~/agent-rules/tools/inkdrop-v6/` (README routes to the rule files):

- Bodies: concise, no H1 duplicating the title, no `Tags:` lines (use native tags).
- Mermaid: `flowchart LR/TD`; no Markdown lists or literal `\n` in labels; `<br/>` for line breaks; no emoji in labels.
- Links: `[Title](inkdrop://note/<id-without-note:-prefix>)`; never invent IDs.
- Statuses: `active` for living tracking notes (roadmap, release log), `none` for stable references (index, architecture, decisions, dev workflow).
- Existing tags in use: index, architecture, diagram, decision, plan, task, release, document, tool.

## Cadence

- After a milestone/release commit: update `releaseLog` + `roadmap`.
- After editing any mapped file: sync the mapped note in the same session.
- Do not sync transient WIP; sync when the repo change is committed.
