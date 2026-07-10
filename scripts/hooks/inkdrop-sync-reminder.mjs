// PostToolUse hook: after an Edit/Write touching a doc file that is mirrored
// into the Inkdrop notebook, remind the agent to run the inkdrop-docs-sync
// skill. Emits additionalContext JSON (fed back to the agent); silent for
// non-mapped files.
import { readFileSync } from 'node:fs'

const WATCHED = /(README\.md|CHANGELOG\.md|docs\/(architecture|writing-slides)\.md)$/

let input
try {
  input = JSON.parse(readFileSync(0, 'utf8'))
} catch {
  process.exit(0)
}

const filePath = input?.tool_input?.file_path ?? ''
if (!WATCHED.test(filePath)) process.exit(0)

const output = {
  hookSpecificOutput: {
    hookEventName: 'PostToolUse',
    additionalContext:
      `${filePath} is mirrored into the Inkdrop notebook "Ink-Presentation". ` +
      'Before finishing this task, sync the mapped note via the inkdrop-docs-sync ' +
      'skill (note IDs in docs/inkdrop-notes.json).'
  }
}
console.log(JSON.stringify(output))
