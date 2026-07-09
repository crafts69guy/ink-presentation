import { CompositeDisposable } from 'event-kit'
// Classic JSX transform: the built output must only require 'react', which is
// the module the Inkdrop host is known to provide ('react/jsx-runtime' isn't).
import React, { useEffect, useRef, useState } from 'react'
import { getAllConfig } from '../config'
import { getEnv } from '../env'
import { prepareDeck } from '../core/pipeline'
import { bindKeys, type KeyAction } from '../reveal/key-controller'
import { RevealManager } from '../reveal/reveal-manager'
import { presentationEvents, type PresentationNote } from './presentation-events'

function exitFullscreenIfActive(): void {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {
      // Already exited or not permitted; nothing to recover.
    })
  }
}

export function PresentationView() {
  const [note, setNote] = useState<PresentationNote | null>(null)
  // Bumped to force a deck rebuild when settings or the app theme change
  // while presenting (colors follow live via CSS vars, but the highlight.js
  // sheet and Reveal options are baked in at initialize time).
  const [deckKey, setDeckKey] = useState(0)
  const hostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const subscriptions = new CompositeDisposable(
      presentationEvents.onToggle(next => setNote(current => (current ? null : next))),
      presentationEvents.onForceClose(() => setNote(null))
    )
    return () => subscriptions.dispose()
  }, [])

  useEffect(() => {
    if (!note) return
    const rebuild = () => setDeckKey(key => key + 1)
    const config = getEnv().config
    const subscriptions = new CompositeDisposable(
      config.onDidChange('ink-presentation', rebuild),
      config.onDidChange('core.themes', rebuild)
    )
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', rebuild)
    return () => {
      subscriptions.dispose()
      mediaQuery.removeEventListener('change', rebuild)
    }
  }, [note])

  useEffect(() => {
    const host = hostRef.current
    if (!note || !host) return

    let cancelled = false
    const prepared = prepareDeck(note.body, getAllConfig())
    if (prepared.warnings.length > 0) {
      getEnv().notifications.addInfo('ink-presentation', {
        detail: prepared.warnings.join('\n'),
        dismissable: true
      })
    }
    const manager = new RevealManager(host, {
      markdown: prepared.markdown,
      options: prepared.options
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

    if (prepared.options.autoFullscreen && !document.fullscreenElement) {
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
  }, [note, deckKey])

  if (!note) return null
  return <div ref={hostRef} className="ink-presentation-overlay" />
}
