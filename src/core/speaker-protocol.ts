import { SPLIT_MODES, THEMES, TRANSITIONS } from '../config'
import type { EffectiveDeckOptions } from './deck-config'

/**
 * Cross-window speaker-view protocol.
 *
 * Transport (see `src/speaker/bridge.ts`): Inkdrop's `broadcast-command` IPC
 * relays a command dispatch to every window, so messages arrive as
 * `CommandEvent.detail` in ALL windows — including the sender and any
 * unrelated ones. Every message therefore carries a `sessionId` (one
 * presentation ↔ speaker pairing) and `from` (per-window origin id) so
 * receivers can drop their own echoes and foreign sessions.
 *
 * Roles: the presenter window is the source of truth for slide position
 * (`init`/`position`, guarded by a monotonic `seq`); the speaker window only
 * sends requests (`nav`) and lifecycle signals (`hello`/`bye`). This
 * one-directional state flow makes echo loops impossible.
 *
 * Everything here is pure and defensive: `detail` arrives from another
 * window as `unknown`, and any window could dispatch the command with junk.
 */

export const SPEAKER_MESSAGE_COMMAND = 'ink-presentation:speaker-message'
export const SPEAKER_ENTER_COMMAND = 'ink-presentation:speaker-enter'

export interface SpeakerPosition {
  h: number
  v: number
}

export const SPEAKER_NAV_ACTIONS = ['next', 'prev', 'first', 'last'] as const
export type SpeakerNavAction = (typeof SPEAKER_NAV_ACTIONS)[number]

interface BaseMessage {
  sessionId: string
  from: string
}

export type SpeakerMessage =
  /** Speaker window booted and asks the presenter for the deck. */
  | ({ kind: 'hello' } & BaseMessage)
  /** Full deck state; also re-sent on every presenter-side rebuild. */
  | ({
      kind: 'init'
      seq: number
      title: string
      markdown: string
      options: EffectiveDeckOptions
      position: SpeakerPosition
    } & BaseMessage)
  /** Presenter's slide changed. */
  | ({ kind: 'position'; seq: number; position: SpeakerPosition } & BaseMessage)
  /** Speaker asks the presenter to navigate. */
  | ({ kind: 'nav'; action: SpeakerNavAction } & BaseMessage)
  /** Presentation closed; the speaker window should close itself. */
  | ({ kind: 'end' } & BaseMessage)
  /** Speaker window is going away. */
  | ({ kind: 'bye' } & BaseMessage)

/** Per-window origin id; also used (with a fresh call) as the session id. */
export function createOriginId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Drops stale or replayed presenter state. One gate per session covers both
 * `init` and `position` — the presenter draws them from a single counter.
 */
export class SeqGate {
  private last = -Infinity

  accept(seq: number): boolean {
    if (!Number.isFinite(seq) || seq <= this.last) return false
    this.last = seq
    return true
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parsePosition(value: unknown): SpeakerPosition | null {
  if (!isRecord(value) || !isFiniteNumber(value.h) || !isFiniteNumber(value.v)) return null
  return { h: value.h, v: value.v }
}

function oneOf<T extends string>(allowed: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
}

/**
 * Coerce a foreign window's options payload into a safe EffectiveDeckOptions.
 * Field-level fallbacks rather than rejection: a version-skewed presenter
 * (plugin updated in one window but not yet reloaded in another) should
 * degrade to defaults, not kill the speaker view.
 */
export function sanitizeDeckOptions(value: unknown): EffectiveDeckOptions {
  const record = isRecord(value) ? value : {}
  return {
    theme: oneOf(THEMES, record.theme) ? record.theme : 'inkdrop',
    transition: oneOf(TRANSITIONS, record.transition) ? record.transition : 'slide',
    separator: oneOf(SPLIT_MODES, record.separator) ? record.separator : 'auto',
    showSlideNumber: record.showSlideNumber === true,
    showProgressBar: record.showProgressBar === true,
    verticalSlides: record.verticalSlides === true,
    autoFullscreen: false, // never meaningful in a speaker window
    // Passed through so speaker mini decks match the presenter; hardening
    // happens at injection time (reveal-manager), same as the presenter.
    customCss: typeof record.customCss === 'string' ? record.customCss : ''
  }
}

/** Boot payload the presenter passes through `create-simple-window`'s
 * `runCommands` to the speaker window's `speaker-enter` command. */
export interface SpeakerEnterDetail {
  sessionId: string
  /** The presenter window's origin id. */
  from: string
}

export function parseSpeakerEnter(value: unknown): SpeakerEnterDetail | null {
  if (!isRecord(value) || !isNonEmptyString(value.sessionId) || !isNonEmptyString(value.from)) {
    return null
  }
  return { sessionId: value.sessionId, from: value.from }
}

/** Validate an unknown `CommandEvent.detail` into a message, else null. */
export function parseSpeakerMessage(value: unknown): SpeakerMessage | null {
  if (!isRecord(value)) return null
  const { kind, sessionId, from } = value
  if (!isNonEmptyString(sessionId) || !isNonEmptyString(from)) return null
  const base = { sessionId, from }

  switch (kind) {
    case 'hello':
    case 'end':
    case 'bye':
      return { kind, ...base }
    case 'init': {
      const position = parsePosition(value.position)
      if (!isFiniteNumber(value.seq) || typeof value.markdown !== 'string' || position === null) {
        return null
      }
      return {
        kind,
        ...base,
        seq: value.seq,
        title: typeof value.title === 'string' ? value.title : '',
        markdown: value.markdown,
        options: sanitizeDeckOptions(value.options),
        position
      }
    }
    case 'position': {
      const position = parsePosition(value.position)
      if (!isFiniteNumber(value.seq) || position === null) return null
      return { kind, ...base, seq: value.seq, position }
    }
    case 'nav':
      if (!oneOf(SPEAKER_NAV_ACTIONS, value.action)) return null
      return { kind, ...base, action: value.action }
    default:
      return null
  }
}
