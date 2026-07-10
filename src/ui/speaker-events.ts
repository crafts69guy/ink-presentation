import { Emitter, type Disposable } from 'event-kit'
import type { SpeakerEnterDetail, SpeakerMessage } from '../core/speaker-protocol'

/**
 * In-window fan-out for the speaker protocol, mirroring presentation-events:
 * the plugin entry (index.ts) registers the broadcast-facing commands once
 * and forwards their validated payloads here; the always-mounted views
 * (PresentationView as presenter, SpeakerView as speaker) subscribe.
 */
class SpeakerEvents {
  private emitter = new Emitter()

  /** This window was opened as a speaker window (runCommands boot). */
  onEnter(callback: (detail: SpeakerEnterDetail) => void): Disposable {
    return this.emitter.on('enter', callback)
  }

  /** A validated protocol message arrived via broadcast-command. */
  onMessage(callback: (message: SpeakerMessage) => void): Disposable {
    return this.emitter.on('message', callback)
  }

  emitEnter(detail: SpeakerEnterDetail): void {
    this.emitter.emit('enter', detail)
  }

  emitMessage(message: SpeakerMessage): void {
    this.emitter.emit('message', message)
  }
}

export const speakerEvents = new SpeakerEvents()
