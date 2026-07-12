# Canary-upgrade runbook

The single biggest source of future breakage in this plugin is that the
speaker view and a few host touchpoints ride on **undocumented Inkdrop
internals**. They can change silently on any Inkdrop update (canary or
stable). This runbook lists exactly what the plugin depends on and how to
re-verify it after Inkdrop upgrades.

Run this whenever you bump the Inkdrop app version — especially canary.

## Dependencies on undocumented / internal surfaces

Ordered by fragility (most likely to break first).

### 1. Cross-window IPC — `src/speaker/bridge.ts`

Three Electron `ipcRenderer` channels discovered in v6 canary.21's
`app.asar`. None are documented plugin API.

- **`broadcast-command`** (`ipcRenderer.send`) — relays
  `commands.dispatch(body, cmd, params)` into every window; this is the
  speaker sync transport. Breaks if the channel is renamed/removed, the
  relay stops reaching other windows, or the payload shape changes.
- **`create-simple-window`** (`ipcRenderer.invoke`) — opens the frameless
  speaker window; its `runCommands` param boots it into `speaker-enter`.
  Breaks if the channel is gone, `runCommands` is no longer dispatched on
  `document.body` after activation, or it fires before packages activate.
- **`window:close`** (`ipcRenderer.invoke`) — the speaker window closes
  itself. Breaks if the channel is renamed/removed.

All three already degrade to an error notification on failure (`invoke`
rejects, callers catch): a broken channel shows "Could not open the speaker
view" rather than crashing — but the feature is dead until fixed.

Also assumed: `nodeIntegration: true` in the renderer (the plugin imports
`electron` and `node:fs`). If Inkdrop disables node integration, both
`bridge.ts` and `reveal/katex-assets.ts` break at import time.

### 2. Store shape — `editingNote`

`src/index.ts` (`toggle`) and `src/ui/PresentationView.tsx` (auto-refresh)
read `app.store.getState().editingNote` and expect `{ _id, title, body }`.
Auto-refresh also relies on the host **reloading** `editingNote` when the
note's doc changes in another window or via sync. Breaks if the store slice
is renamed/reshaped or the host stops refreshing it there.

### 3. Layout region + component registration — `src/index.ts`

`app.layouts.addComponentToLayout('modal', …)` mounts both views in the
`modal` region. Breaks if the `modal` region is renamed or the
register/add-to-layout API changes. (Documented-ish, but still host API.)

### 4. `create-simple-window` boot ordering

The speaker window must activate this plugin (so `speaker-enter` exists)
**before** `runCommands` fires. This holds because plugins activate in every
non-preferences window. Breaks if simple windows stop activating packages,
or fire `runCommands` earlier.

## Verify after every Inkdrop upgrade

Reload the plugin first (Development Mode + <kbd>⌥⌘⇧R</kbd>). Then:

1. **Core still works** (rules out node-integration / layout-region
   breakage): open a note, <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>P</kbd> → deck
   renders. If this fails, suspect surface 3 or nodeIntegration.
2. **Speaker window opens** (surface 1 `create-simple-window` + boot
   ordering): press <kbd>V</kbd> → a frameless window opens and fills with
   the deck. If it opens but stays on "Waiting for the presentation…", the
   window booted but `broadcast-command` isn't relaying.
3. **Two-way sync** (surface 1 `broadcast-command`): arrow keys in either
   window move both; the speaker's Next/Prev buttons drive the presenter.
4. **Speaker closes** (`window:close`): <kbd>Esc</kbd> in the speaker window
   closes only it; closing the presentation closes it too.
5. **Auto-refresh** (surface 2 store shape): with a note presenting, edit it
   in another window → the deck rebuilds in place, position kept.

If a step fails, the surface list above points at what to inspect in the new
`app.asar`. When you re-confirm or re-discover a surface, update this file
and the list below.

## Verified against

- v6 canary.21 — original discovery (all four surfaces confirmed).
- _(add a line per Inkdrop version you re-verify against)_
