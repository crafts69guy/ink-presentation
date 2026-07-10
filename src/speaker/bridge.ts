import { ipcRenderer } from 'electron'
import {
  createOriginId,
  SPEAKER_ENTER_COMMAND,
  SPEAKER_MESSAGE_COMMAND,
  type SpeakerMessage
} from '../core/speaker-protocol'

/**
 * Transport for the speaker-view protocol, built entirely on Inkdrop's own
 * cross-window plumbing (v6 canary.21, discovered by inspecting app.asar —
 * none of this is documented plugin API, so every call degrades gracefully):
 *
 * - `broadcast-command` (ipcMain.on): main relays
 *   `commands.dispatch(document.body, command, params)` into EVERY
 *   non-preferences window — including the sender, hence the `from` origin
 *   filtering in the protocol. Inkdrop itself uses this to sync package
 *   activation across windows.
 * - `create-simple-window` (ipcMain.handle): opens a frameless,
 *   distraction-free app window; its `runCommands` param is dispatched on
 *   `document.body` once the window's app is ready — i.e. after packages
 *   activate, so our `speaker-enter` command is guaranteed to exist there.
 *   This is the same mechanism the app's own quick-note feature uses.
 * - `window:close` (ipcMain.handle): closes the calling window.
 */

/** Identifies this window in every message; generated once per window. */
export const WINDOW_ORIGIN_ID = createOriginId()

export function broadcastSpeakerMessage(message: SpeakerMessage): void {
  ipcRenderer.send('broadcast-command', {
    command: SPEAKER_MESSAGE_COMMAND,
    selector: 'body',
    params: message
  })
}

/** Open the speaker window; it boots into our `speaker-enter` command.
 * Rejects when the IPC surface is gone (future canary) — callers notify. */
export async function openSpeakerWindow(sessionId: string): Promise<void> {
  await ipcRenderer.invoke('create-simple-window', {
    runCommands: [
      { command: SPEAKER_ENTER_COMMAND, detail: { sessionId, from: WINDOW_ORIGIN_ID } }
    ]
  })
}

/** Close the window this code runs in (used by the speaker window). */
export async function closeCurrentWindow(): Promise<void> {
  await ipcRenderer.invoke('window:close')
}
