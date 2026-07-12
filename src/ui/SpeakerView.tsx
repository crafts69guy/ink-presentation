// Classic JSX transform: the built output must only require 'react', which is
// the module the Inkdrop host is known to provide ('react/jsx-runtime' isn't).
import React, { useEffect, useRef, useState } from 'react'
import type { EffectiveDeckOptions } from '../core/deck-config'
import {
  SeqGate,
  type SpeakerEnterDetail,
  type SpeakerNavAction,
  type SpeakerPosition
} from '../core/speaker-protocol'
import { bindKeys, type KeyAction } from '../reveal/key-controller'
import { RevealManager } from '../reveal/reveal-manager'
import { broadcastSpeakerMessage, closeCurrentWindow, WINDOW_ORIGIN_ID } from '../speaker/bridge'
import { speakerEvents } from './speaker-events'

/**
 * The speaker window's entire UI. Mounted (like PresentationView) in every
 * window's `modal` layout region and renders null until this window is booted
 * as a speaker window via the `speaker-enter` runCommand.
 *
 * Renders two miniature Reveal decks from the presenter's prepared markdown —
 * the current slide and the upcoming one — plus speaker notes, a slide
 * counter, wall clock, and an elapsed timer. The presenter is the source of
 * truth: this view never moves its decks except on presenter `init`/
 * `position` messages, and navigation input is sent back as `nav` requests.
 */

interface SpeakerDeck {
  title: string
  markdown: string
  options: EffectiveDeckOptions
}

const HELLO_RETRY_MS = 1000
const HELLO_MAX_TRIES = 10

function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const mmss = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return hours > 0 ? `${hours}:${mmss}` : mmss
}

/** Speaker decks snap instantly and carry no chrome of their own. */
function previewOptions(options: EffectiveDeckOptions): EffectiveDeckOptions {
  return {
    ...options,
    transition: 'none',
    showSlideNumber: false,
    showProgressBar: false,
    autoFullscreen: false
  }
}

/**
 * The presenter re-broadcasts `init` after every rebuild, including ones
 * that don't change the prepared deck (settings toggle, refresh with
 * identical output). Rebuilding both mini decks then is pure waste — keep
 * the current state object when nothing material changed.
 */
function sameDeck(a: SpeakerDeck, b: SpeakerDeck): boolean {
  if (a.title !== b.title || a.markdown !== b.markdown) return false
  const keys = new Set([...Object.keys(a.options), ...Object.keys(b.options)])
  for (const key of keys) {
    if (
      a.options[key as keyof EffectiveDeckOptions] !== b.options[key as keyof EffectiveDeckOptions]
    ) {
      return false
    }
  }
  return true
}

export function SpeakerView() {
  const [session, setSession] = useState<SpeakerEnterDetail | null>(null)
  const [deck, setDeck] = useState<SpeakerDeck | null>(null)
  const [position, setPosition] = useState<SpeakerPosition>({ h: 0, v: 0 })
  const [notes, setNotes] = useState('')
  const [slideNumber, setSlideNumber] = useState(1)
  const [slideTotal, setSlideTotal] = useState(1)
  const [isEnd, setIsEnd] = useState(false)
  const [helloFailed, setHelloFailed] = useState(false)
  // Bumped when both mini decks finish initializing, so the position effect
  // re-applies onto fresh decks after an init/rebuild.
  const [decksReadyTick, setDecksReadyTick] = useState(0)
  const [clock, setClock] = useState('')
  const [elapsed, setElapsed] = useState(0)

  const currentHostRef = useRef<HTMLDivElement | null>(null)
  const nextHostRef = useRef<HTMLDivElement | null>(null)
  const currentManagerRef = useRef<RevealManager | null>(null)
  const nextManagerRef = useRef<RevealManager | null>(null)
  const positionRef = useRef<SpeakerPosition>({ h: 0, v: 0 })
  const gateRef = useRef(new SeqGate())
  const startedAtRef = useRef<number | null>(null)

  // A window becomes a speaker window at most once; the runCommand fires
  // right after this component mounts with the app ready.
  useEffect(() => {
    const subscription = speakerEvents.onEnter(detail => {
      setSession(current => current ?? detail)
    })
    return () => subscription.dispose()
  }, [])

  // Protocol lifecycle: hello (with retries) until init arrives; follow
  // presenter state; announce departure on unload.
  useEffect(() => {
    if (!session) return
    const { sessionId } = session
    const sayHello = () =>
      broadcastSpeakerMessage({ kind: 'hello', sessionId, from: WINDOW_ORIGIN_ID })
    const sayBye = () => broadcastSpeakerMessage({ kind: 'bye', sessionId, from: WINDOW_ORIGIN_ID })

    let gotInit = false
    let tries = 0
    sayHello()
    const helloTimer = window.setInterval(() => {
      if (gotInit) return
      tries += 1
      if (tries >= HELLO_MAX_TRIES) {
        window.clearInterval(helloTimer)
        setHelloFailed(true)
        return
      }
      sayHello()
    }, HELLO_RETRY_MS)

    const subscription = speakerEvents.onMessage(message => {
      if (message.sessionId !== sessionId || message.from === WINDOW_ORIGIN_ID) return
      switch (message.kind) {
        case 'init':
          if (!gateRef.current.accept(message.seq)) return
          gotInit = true
          setHelloFailed(false)
          startedAtRef.current ??= Date.now()
          positionRef.current = message.position
          setPosition(message.position)
          setDeck(current => {
            const incoming: SpeakerDeck = {
              title: message.title,
              markdown: message.markdown,
              options: message.options
            }
            return current && sameDeck(current, incoming) ? current : incoming
          })
          window.document.title = message.title ? `Speaker view — ${message.title}` : 'Speaker view'
          break
        case 'position':
          if (!gateRef.current.accept(message.seq)) return
          positionRef.current = message.position
          setPosition(message.position)
          break
        case 'end':
          closeCurrentWindow().catch(() => window.close())
          break
        default:
          break
      }
    })

    window.addEventListener('beforeunload', sayBye)
    return () => {
      window.clearInterval(helloTimer)
      window.removeEventListener('beforeunload', sayBye)
      subscription.dispose()
    }
  }, [session])

  // Keyboard: navigation is forwarded to the presenter; Esc leaves. Other
  // deck keys are consumed but inert here, keeping keystrokes away from the
  // Inkdrop UI underneath the overlay.
  useEffect(() => {
    if (!session) return
    const { sessionId } = session
    const sendNav = (action: SpeakerNavAction) =>
      broadcastSpeakerMessage({ kind: 'nav', sessionId, from: WINDOW_ORIGIN_ID, action })
    const leave = () => {
      broadcastSpeakerMessage({ kind: 'bye', sessionId, from: WINDOW_ORIGIN_ID })
      closeCurrentWindow().catch(() => window.close())
    }

    const handleAction = (action: KeyAction): void => {
      switch (action) {
        case 'next':
        case 'prev':
        case 'first':
        case 'last':
          sendNav(action)
          break
        case 'escape':
          leave()
          break
        default:
          break
      }
    }
    return bindKeys(handleAction)
  }, [session])

  // Clocks: wall time always; elapsed counts from the first init.
  useEffect(() => {
    if (!session) return
    const update = () => {
      setClock(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
      const startedAt = startedAtRef.current
      if (startedAt !== null) setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    }
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [session])

  // Build the two mini decks whenever a (re-)init arrives.
  useEffect(() => {
    const currentHost = currentHostRef.current
    const nextHost = nextHostRef.current
    if (!deck || !currentHost || !nextHost) return

    let cancelled = false
    const options = previewOptions(deck.options)
    const currentManager = new RevealManager(currentHost, {
      markdown: deck.markdown,
      options,
      initialSlide: positionRef.current,
      // The presenter window already renders this deck in full; the mini
      // decks only ever show the mirrored slide, so skip idle hydration.
      hydrateVisibleOnly: true,
      onSlideChanged: notesText => {
        setNotes(notesText)
        const api = currentManager.getDeck()
        if (api) {
          setSlideNumber(api.getSlidePastCount() + 1)
          setSlideTotal(api.getTotalSlides())
        }
      }
    })
    const nextManager = new RevealManager(nextHost, {
      markdown: deck.markdown,
      options,
      initialSlide: positionRef.current,
      hydrateVisibleOnly: true
    })
    currentManagerRef.current = currentManager
    nextManagerRef.current = nextManager

    Promise.all([currentManager.initialize(), nextManager.initialize()])
      .then(() => {
        if (cancelled) return
        setDecksReadyTick(tick => tick + 1)
      })
      .catch(() => {
        // A broken deck in the speaker window must not crash it; the
        // presenter window still works and notes keep flowing.
      })

    return () => {
      cancelled = true
      currentManagerRef.current = null
      nextManagerRef.current = null
      currentManager.destroy()
      nextManager.destroy()
    }
  }, [deck])

  // Follow the presenter: current deck mirrors the position, next deck sits
  // one step ahead (Reveal's own next() order: vertical first, then across).
  useEffect(() => {
    const current = currentManagerRef.current?.getDeck()
    const next = nextManagerRef.current?.getDeck()
    if (current) current.slide(position.h, position.v)
    if (next) {
      next.slide(position.h, position.v)
      next.next()
      const indices = next.getIndices()
      setIsEnd(indices.h === position.h && (indices.v ?? 0) === position.v)
    }
  }, [position, decksReadyTick])

  if (!session) return null

  const sendNavClick = (action: SpeakerNavAction) => () =>
    broadcastSpeakerMessage({
      kind: 'nav',
      sessionId: session.sessionId,
      from: WINDOW_ORIGIN_ID,
      action
    })

  return (
    <div className="ink-speaker-overlay">
      <header className="ink-speaker-header">
        <span className="ink-speaker-title">{deck?.title ?? 'Speaker view'}</span>
        <span className="ink-speaker-meta">
          <span className="ink-speaker-counter">
            {slideNumber} / {slideTotal}
          </span>
          <span className="ink-speaker-clock">{clock}</span>
          <button
            type="button"
            className="ink-speaker-elapsed"
            title="Click to reset the timer"
            onClick={() => {
              startedAtRef.current = Date.now()
              setElapsed(0)
            }}
          >
            {formatElapsed(elapsed)}
          </button>
        </span>
      </header>
      {deck ? (
        <div className="ink-speaker-body">
          <section className="ink-speaker-current">
            <div ref={currentHostRef} className="ink-speaker-deck" />
          </section>
          <aside className="ink-speaker-side">
            <section className="ink-speaker-next">
              <h2 className="ink-speaker-pane-label">Next</h2>
              <div className="ink-speaker-next-frame">
                <div ref={nextHostRef} className="ink-speaker-deck" />
                {isEnd && <div className="ink-speaker-end-badge">End of deck</div>}
              </div>
            </section>
            <section className="ink-speaker-notes">
              <h2 className="ink-speaker-pane-label">Notes</h2>
              {notes ? (
                <p className="ink-speaker-notes-text">{notes}</p>
              ) : (
                <p className="ink-speaker-notes-empty">No notes for this slide.</p>
              )}
            </section>
            <nav className="ink-speaker-controls">
              <button type="button" onClick={sendNavClick('prev')}>
                ← Prev
              </button>
              <button type="button" onClick={sendNavClick('next')}>
                Next →
              </button>
            </nav>
          </aside>
        </div>
      ) : (
        <div className="ink-speaker-waiting">
          {helloFailed
            ? 'Could not reach the presentation window. Close this window and press V in the presentation to retry.'
            : 'Waiting for the presentation…'}
        </div>
      )}
    </div>
  )
}
