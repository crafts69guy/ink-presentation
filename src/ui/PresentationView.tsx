import { CompositeDisposable } from 'event-kit';
// Classic JSX transform: the built output must only require 'react', which is
// the module the Inkdrop host is known to provide ('react/jsx-runtime' isn't).
import React, { useEffect, useRef, useState } from 'react';
import { getAllConfig, getConfig } from '../config';
import { prepareDeck } from '../core/pipeline';
import { createOriginId } from '../core/speaker-protocol';
import { getEnv } from '../env';
import { bindKeys, type KeyAction } from '../reveal/key-controller';
import { RevealManager, type SlidePosition } from '../reveal/reveal-manager';
import { broadcastSpeakerMessage, openSpeakerWindow, WINDOW_ORIGIN_ID } from '../speaker/bridge';
import { NotesOverlay } from './NotesOverlay';
import { presentationEvents, type PresentationNote } from './presentation-events';
import { speakerEvents } from './speaker-events';

/** Presenter-side speaker session: set when the user opens a speaker window,
 * `alive` once that window has said hello. */
interface SpeakerSession {
  sessionId: string;
  alive: boolean;
}

/** The slice of app state the auto-refresh subscription reads. */
interface EditingNoteState {
  editingNote?: {
    _id?: string;
    body?: string;
  } | null;
}

/** Coalesce keystroke-by-keystroke store updates into one rebuild. */
const REFRESH_DEBOUNCE_MS = 400;

function exitFullscreenIfActive(): void {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {
      // Already exited or not permitted; nothing to recover.
    });
  }
}

export function PresentationView() {
  const [note, setNote] = useState<PresentationNote | null>(null);
  // Bumped to force a deck rebuild when settings or the app theme change
  // while presenting (colors follow live via CSS vars, but the highlight.js
  // sheet and Reveal options are baked in at initialize time).
  const [deckKey, setDeckKey] = useState(0);
  const [notesVisible, setNotesVisible] = useState(false);
  const [currentNotes, setCurrentNotes] = useState('');
  // Live note body from the auto-refresh subscription; null = use note.body.
  const [refreshedBody, setRefreshedBody] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  // Survives rebuilds so a settings change doesn't jump back to slide 1.
  const positionRef = useRef<SlidePosition>({ h: 0, v: 0 });
  // Speaker window pairing; survives rebuilds, cleared when the deck closes.
  const speakerRef = useRef<SpeakerSession | null>(null);
  // Monotonic sequence for init/position broadcasts (echo/stale protection).
  const seqRef = useRef(0);
  // Body currently on screen — the auto-refresh listener compares against
  // this so redundant store emissions don't schedule rebuilds.
  const lastBodyRef = useRef('');
  // Last warning set already shown; auto-refresh rebuilds must not re-toast
  // identical warnings on every keystroke (mid-edit YAML is often invalid).
  const lastWarningsRef = useRef('');

  useEffect(() => {
    const subscriptions = new CompositeDisposable(
      presentationEvents.onToggle(next => setNote(current => (current ? null : next))),
      presentationEvents.onForceClose(() => setNote(null)),
    );
    return () => subscriptions.dispose();
  }, []);

  // Fresh deck (new `note` identity): reset per-presentation state. Runs
  // before the deck effect below (declaration order) and not on deckKey
  // rebuilds, which must keep position and notes visibility.
  useEffect(() => {
    if (!note) return;
    positionRef.current = { h: 0, v: 0 };
    setNotesVisible(false);
    setCurrentNotes('');
    setRefreshedBody(null);
    lastBodyRef.current = note.body;
    lastWarningsRef.current = '';
  }, [note]);

  // Auto-refresh: while presenting a real note (the sample deck has no id),
  // follow the store's editingNote — Inkdrop reloads it there when the note
  // changes in another window or arrives via sync (and never while this
  // window's editor is dirty, which cannot happen under the overlay anyway).
  // The rebuild goes through refreshedBody → deck effect, so slide position
  // and the speaker window survive exactly like a settings rebuild.
  useEffect(() => {
    if (!note?.id) return;
    const noteId = note.id;
    const store = getEnv().store;
    let timer: number | null = null;

    const unsubscribe = store.subscribe(() => {
      if (!getConfig('autoRefreshWhilePresenting')) return;
      const editing = (store.getState() as EditingNoteState).editingNote;
      if (!editing || editing._id !== noteId) return;
      const body = editing.body;
      if (typeof body !== 'string' || body === lastBodyRef.current) return;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        lastBodyRef.current = body;
        setRefreshedBody(body);
      }, REFRESH_DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [note]);

  // Speaker session lives exactly as long as the presentation (not the
  // deck instance — rebuilds must keep the speaker window attached). On
  // close, tell the speaker window to shut itself down.
  useEffect(() => {
    if (!note) return;
    return () => {
      const session = speakerRef.current;
      if (session) {
        broadcastSpeakerMessage({
          kind: 'end',
          sessionId: session.sessionId,
          from: WINDOW_ORIGIN_ID,
        });
        speakerRef.current = null;
      }
    };
  }, [note]);

  useEffect(() => {
    if (!note) return;
    const rebuild = () => setDeckKey(key => key + 1);
    const config = getEnv().config;
    const subscriptions = new CompositeDisposable(
      config.onDidChange('ink-presentation', rebuild),
      config.onDidChange('core.themes', rebuild),
    );
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', rebuild);
    return () => {
      subscriptions.dispose();
      mediaQuery.removeEventListener('change', rebuild);
    };
  }, [note]);

  useEffect(() => {
    const container = containerRef.current;
    const host = hostRef.current;
    if (!note || !container || !host) return;

    let cancelled = false;
    const prepared = prepareDeck(refreshedBody ?? note.body, getAllConfig());
    // Only toast when the warning set changes: auto-refresh rebuilds hit
    // this path repeatedly while frontmatter is mid-edit.
    const warningsKey = prepared.warnings.join('\n');
    if (warningsKey !== lastWarningsRef.current) {
      lastWarningsRef.current = warningsKey;
      if (prepared.warnings.length > 0) {
        getEnv().notifications.addInfo('ink-presentation', {
          detail: warningsKey,
          dismissable: true,
        });
      }
    }
    const manager = new RevealManager(host, {
      markdown: prepared.markdown,
      options: prepared.options,
      initialSlide: positionRef.current,
      onSlideChanged: (notes, position) => {
        positionRef.current = position;
        setCurrentNotes(notes);
        const session = speakerRef.current;
        if (session?.alive) {
          broadcastSpeakerMessage({
            kind: 'position',
            sessionId: session.sessionId,
            from: WINDOW_ORIGIN_ID,
            seq: ++seqRef.current,
            position,
          });
        }
      },
    });

    // Full deck state for the speaker window: sent on hello, and again after
    // every rebuild (markdown/options may have changed with the settings).
    const sendSpeakerInit = () => {
      const session = speakerRef.current;
      if (!session) return;
      broadcastSpeakerMessage({
        kind: 'init',
        sessionId: session.sessionId,
        from: WINDOW_ORIGIN_ID,
        seq: ++seqRef.current,
        title: note.title,
        markdown: prepared.markdown,
        options: prepared.options,
        position: positionRef.current,
      });
    };

    const speakerSubscription = speakerEvents.onMessage(message => {
      const session = speakerRef.current;
      if (
        !session ||
        message.sessionId !== session.sessionId ||
        message.from === WINDOW_ORIGIN_ID
      ) {
        return;
      }
      switch (message.kind) {
        case 'hello':
          session.alive = true;
          sendSpeakerInit();
          break;
        case 'nav':
          handleAction(message.action);
          break;
        case 'bye':
          session.alive = false;
          break;
        default:
          // init/position/end originate from presenters, not speakers.
          break;
      }
    });

    manager
      .initialize()
      .then(() => {
        if (cancelled) {
          manager.destroy();
          return;
        }
        // Rebuild with a speaker attached: hand it the fresh deck.
        if (speakerRef.current?.alive) sendSpeakerInit();
      })
      .catch((error: unknown) => {
        getEnv().notifications.addError('ink-presentation', {
          detail: `Failed to start the presentation: ${String(error)}`,
          dismissable: true,
        });
        setNote(null);
      });

    if (prepared.options.autoFullscreen && !document.fullscreenElement) {
      container.requestFullscreen().catch(() => {
        // Fullscreen denied (e.g. not a user gesture); the fixed overlay
        // still covers the window, so continue without it.
      });
    }

    const handleAction = (action: KeyAction): void => {
      const deck = manager.getDeck();
      switch (action) {
        case 'next':
          deck?.next();
          break;
        case 'prev':
          deck?.prev();
          break;
        case 'first':
          deck?.slide(0);
          break;
        case 'last':
          if (deck) deck.slide(deck.getHorizontalSlides().length - 1);
          break;
        case 'toggle-overview':
          deck?.toggleOverview();
          break;
        case 'toggle-fullscreen':
          if (document.fullscreenElement) {
            exitFullscreenIfActive();
          } else {
            container.requestFullscreen().catch(() => {});
          }
          break;
        case 'toggle-notes':
          setNotesVisible(visible => !visible);
          break;
        case 'toggle-pause':
          deck?.togglePause();
          break;
        case 'speaker-view':
          openSpeakerView();
          break;
        case 'escape':
          if (deck?.isOverview()) {
            deck.toggleOverview(false);
          } else {
            // Chromium usually exits fullscreen on Esc before we see the
            // event; call this regardless so a lingering flag doesn't keep
            // the presentation stuck in fullscreen after close.
            exitFullscreenIfActive();
            setNote(null);
          }
          break;
      }
    };
    const openSpeakerView = (): void => {
      if (speakerRef.current?.alive) {
        getEnv().notifications.addInfo('ink-presentation', {
          detail: 'Speaker view is already open.',
          dismissable: true,
        });
        return;
      }
      const sessionId = createOriginId();
      speakerRef.current = { sessionId, alive: false };
      openSpeakerWindow(sessionId).catch((error: unknown) => {
        // The undocumented create-simple-window IPC may vanish in a future
        // canary; fail with a message instead of a dead keypress.
        speakerRef.current = null;
        getEnv().notifications.addError('ink-presentation', {
          detail: `Could not open the speaker view: ${String(error)}`,
          dismissable: true,
        });
      });
    };

    const unbindKeys = bindKeys(handleAction);

    return () => {
      cancelled = true;
      unbindKeys();
      speakerSubscription.dispose();
      manager.destroy();
    };
  }, [note, deckKey, refreshedBody]);

  // No explicit fullscreen exit on close: unmounting the fullscreen element
  // makes the browser exit automatically, and rebuilds keep it active.

  if (!note) return null;
  return (
    <div ref={containerRef} className="ink-presentation-overlay">
      <div ref={hostRef} className="ink-presentation-host" />
      {notesVisible && <NotesOverlay notes={currentNotes} />}
    </div>
  );
}
