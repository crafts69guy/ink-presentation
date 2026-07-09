import { CompositeDisposable } from 'event-kit'
// Classic JSX transform: the built output must only require 'react', which is
// the module the Inkdrop host is known to provide ('react/jsx-runtime' isn't).
import React, { useEffect, useRef, useState } from 'react'
import { getConfig } from '../config'
import { getEnv } from '../env'
import { bindKeys, type KeyAction } from '../reveal/key-controller'
import { RevealManager } from '../reveal/reveal-manager'
import { presentationEvents, type PresentationNote } from './presentation-events'

// M1 skeleton: present a hard-coded demo deck. M2 wires the real note body
// through the frontmatter/notes/separator pipeline.
function buildDemoMarkdown(note: PresentationNote): string {
  return [
    `# ${note.title}`,
    '',
    'ink-presentation skeleton is alive 🎉',
    '',
    '---',
    '',
    '## Navigation works',
    '',
    '- `→` / `Space` — next slide',
    '- `←` — previous slide',
    '- `O` — overview, `F` — fullscreen',
    '- `Esc` — close'
  ].join('\n')
}

function exitFullscreenIfActive(): void {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {
      // Already exited or not permitted; nothing to recover.
    })
  }
}

export function PresentationView() {
  const [note, setNote] = useState<PresentationNote | null>(null)
  const hostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const subscriptions = new CompositeDisposable(
      presentationEvents.onToggle(next => setNote(current => (current ? null : next))),
      presentationEvents.onForceClose(() => setNote(null))
    )
    return () => subscriptions.dispose()
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!note || !host) return

    let cancelled = false
    const manager = new RevealManager(host, {
      markdown: buildDemoMarkdown(note),
      separator: '^\\r?\\n---\\r?\\n$',
      transition: getConfig('transition'),
      showSlideNumber: getConfig('showSlideNumber'),
      showProgressBar: getConfig('showProgressBar')
    })

    manager
      .initialize()
      .then(() => {
        if (cancelled) manager.destroy()
      })
      .catch((error: unknown) => {
        getEnv().notifications.addError('ink-presentation', {
          detail: `Failed to start the presentation: ${String(error)}`,
          dismissable: true
        })
        setNote(null)
      })

    if (getConfig('autoFullscreen') && !document.fullscreenElement) {
      host.requestFullscreen().catch(() => {
        // Fullscreen denied (e.g. not a user gesture); the fixed overlay
        // still covers the window, so continue without it.
      })
    }

    const handleAction = (action: KeyAction): void => {
      const deck = manager.getDeck()
      switch (action) {
        case 'next':
          deck?.next()
          break
        case 'prev':
          deck?.prev()
          break
        case 'first':
          deck?.slide(0)
          break
        case 'last':
          if (deck) deck.slide(deck.getHorizontalSlides().length - 1)
          break
        case 'toggle-overview':
          deck?.toggleOverview()
          break
        case 'toggle-fullscreen':
          if (document.fullscreenElement) {
            exitFullscreenIfActive()
          } else {
            host.requestFullscreen().catch(() => {})
          }
          break
        case 'toggle-notes':
          // Speaker notes overlay arrives in M4.
          break
        case 'toggle-pause':
          deck?.togglePause()
          break
        case 'escape':
          if (deck?.isOverview()) {
            deck.toggleOverview(false)
          } else if (document.fullscreenElement) {
            // Chromium usually exits fullscreen on Esc before we see the
            // event; if the flag is still set, exit but keep presenting.
            exitFullscreenIfActive()
          } else {
            setNote(null)
          }
          break
      }
    }
    const unbindKeys = bindKeys(handleAction)

    return () => {
      cancelled = true
      unbindKeys()
      exitFullscreenIfActive()
      manager.destroy()
    }
  }, [note])

  if (!note) return null
  return <div ref={hostRef} className="ink-presentation-overlay" />
}
