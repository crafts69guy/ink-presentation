/**
 * Single owner of all keyboard input while a presentation is open.
 *
 * Reveal is initialized with `keyboard: false`; a window-level capture-phase
 * listener translates keys into deck actions and stops propagation so
 * Inkdrop's own keymaps never fire during a presentation.
 */

export type KeyAction =
  | 'next'
  | 'prev'
  | 'first'
  | 'last'
  | 'toggle-overview'
  | 'toggle-fullscreen'
  | 'toggle-notes'
  | 'toggle-pause'
  | 'speaker-view'
  | 'escape'

export interface KeyContext {
  /** Cmd (macOS) / Ctrl (others) held — let app-global shortcuts pass through. */
  hasModifier: boolean
}

/**
 * Pure key → action mapping. Returns null for keys the presentation does not
 * own (those propagate to Inkdrop as usual).
 */
export function mapKeyToAction(key: string, context: KeyContext): KeyAction | null {
  if (context.hasModifier) return null

  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
    case ' ':
    case 'PageDown':
    case 'n':
    case 'j':
    case 'l':
      return 'next'
    case 'ArrowLeft':
    case 'ArrowUp':
    case 'PageUp':
    case 'p':
    case 'h':
    case 'k':
      return 'prev'
    case 'Home':
      return 'first'
    case 'End':
      return 'last'
    case 'o':
      return 'toggle-overview'
    case 'f':
      return 'toggle-fullscreen'
    case 's':
      return 'toggle-notes'
    case '.':
    case 'b':
      return 'toggle-pause'
    case 'v':
      return 'speaker-view'
    case 'Escape':
      return 'escape'
    default:
      return null
  }
}

/**
 * Install the capture-phase listener. Returns a cleanup function.
 */
export function bindKeys(onAction: (action: KeyAction) => void): () => void {
  const handler = (event: KeyboardEvent) => {
    const action = mapKeyToAction(event.key, {
      hasModifier: event.metaKey || event.ctrlKey || event.altKey
    })
    if (action === null) return
    event.preventDefault()
    event.stopPropagation()
    onAction(action)
  }
  window.addEventListener('keydown', handler, { capture: true })
  return () => {
    window.removeEventListener('keydown', handler, { capture: true })
  }
}
