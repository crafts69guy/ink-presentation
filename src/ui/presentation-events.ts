import { Emitter, type Disposable } from 'event-kit'

export interface PresentationNote {
  title: string
  body: string
}

/**
 * Decouples the command handler (plugin entry) from the always-mounted
 * PresentationView living in Inkdrop's `modal` layout region.
 */
class PresentationEvents {
  private emitter = new Emitter()

  onToggle(callback: (note: PresentationNote) => void): Disposable {
    return this.emitter.on('toggle', callback)
  }

  onForceClose(callback: () => void): Disposable {
    return this.emitter.on('force-close', callback)
  }

  emitToggle(note: PresentationNote): void {
    this.emitter.emit('toggle', note)
  }

  emitForceClose(): void {
    this.emitter.emit('force-close')
  }
}

export const presentationEvents = new PresentationEvents()
