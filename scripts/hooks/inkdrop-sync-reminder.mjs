// PostToolUse hook: the Inkdrop notebook owns roadmap/release tracking while
// the repo owns public docs. Editing CHANGELOG.md (a release touchpoint) or
// the README's Planned features scope should be followed by updating the
// tracking notes — remind the agent. Silent for everything else.
import { readFileSync } from 'node:fs'

const WATCHED = /(README\.md|CHANGELOG\.md)$/

let input
try {
  input = JSON.parse(readFileSync(0, 'utf8'))
} catch {
  process.exit(0)
}

const filePath = input?.tool_input?.file_path ?? ''
if (!WATCHED.test(filePath)) process.exit(0)

const isChangelog = filePath.endsWith('CHANGELOG.md')
const reminder = isChangelog
  ? 'CHANGELOG.md changed — release touchpoint: update the roadmap and release-log notes in the Inkdrop notebook via the inkdrop-docs-sync skill (note IDs in docs/inkdrop-notes.json).'
  : 'README.md changed — if the "Planned features" scope changed, update the roadmap note in the Inkdrop notebook via the inkdrop-docs-sync skill (note IDs in docs/inkdrop-notes.json). Other README edits need no note updates.'

console.log(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: reminder }
  })
)
