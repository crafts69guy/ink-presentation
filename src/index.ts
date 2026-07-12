import type { Environment, IInkdropPlugin } from '@inkdropapp/types'
import { CompositeDisposable, type Disposable } from 'event-kit'
import { configSchema } from './config'
import {
  parseSpeakerEnter,
  parseSpeakerMessage,
  SPEAKER_ENTER_COMMAND,
  SPEAKER_MESSAGE_COMMAND
} from './core/speaker-protocol'
import { setEnv } from './env'
import { SAMPLE_DECK_BODY, SAMPLE_DECK_TITLE } from './sample-deck'
import { PresentationView } from './ui/PresentationView'
import { presentationEvents } from './ui/presentation-events'
import { speakerEvents } from './ui/speaker-events'
import { SpeakerView } from './ui/SpeakerView'

const COMPONENT_NAME = 'PresentationView'
const SPEAKER_COMPONENT_NAME = 'InkPresentationSpeakerView'

interface EditingNoteSlice {
  editingNote?: {
    _id?: string
    title?: string
    body?: string
  } | null
}

class InkPresentationPlugin implements IInkdropPlugin {
  readonly config = configSchema
  private subscriptions: CompositeDisposable | null = null
  private sampleCommandSubscription: Disposable | null = null

  activate(app: Environment): void {
    setEnv(app)
    app.components.registerClass(PresentationView, COMPONENT_NAME)
    app.layouts.addComponentToLayout('modal', COMPONENT_NAME)
    app.components.registerClass(SpeakerView, SPEAKER_COMPONENT_NAME)
    app.layouts.addComponentToLayout('modal', SPEAKER_COMPONENT_NAME)
    this.subscriptions = new CompositeDisposable(
      app.commands.add(document.body, {
        'ink-presentation:toggle': () => this.toggle(app),
        // Speaker-view plumbing. Both are dispatched programmatically —
        // speaker-enter via the new window's runCommands boot, and
        // speaker-message via the app's broadcast-command relay (arrives in
        // every window; payloads are validated and origin-filtered).
        [SPEAKER_ENTER_COMMAND]: {
          hiddenInCommandPalette: true,
          didDispatch: event => {
            const detail = parseSpeakerEnter(event.detail)
            if (detail) speakerEvents.emitEnter(detail)
          }
        },
        [SPEAKER_MESSAGE_COMMAND]: {
          hiddenInCommandPalette: true,
          didDispatch: event => {
            const message = parseSpeakerMessage(event.detail)
            if (message) speakerEvents.emitMessage(message)
          }
        }
      }),
      app.config.observe('ink-presentation.showSampleCommand', (enabled: boolean) => {
        this.sampleCommandSubscription?.dispose()
        this.sampleCommandSubscription = enabled
          ? app.commands.add(document.body, {
              'ink-presentation:present-sample': () => this.presentSample()
            })
          : null
      })
    )
  }

  deactivate(app: Environment): void {
    presentationEvents.emitForceClose()
    this.sampleCommandSubscription?.dispose()
    this.sampleCommandSubscription = null
    this.subscriptions?.dispose()
    this.subscriptions = null
    app.layouts.removeComponentFromLayout('modal', SPEAKER_COMPONENT_NAME)
    app.components.deleteClass(SpeakerView, SPEAKER_COMPONENT_NAME)
    app.layouts.removeComponentFromLayout('modal', COMPONENT_NAME)
    app.components.deleteClass(PresentationView, COMPONENT_NAME)
    setEnv(null)
  }

  private presentSample(): void {
    presentationEvents.emitToggle({
      title: SAMPLE_DECK_TITLE,
      body: SAMPLE_DECK_BODY
    })
  }

  private toggle(app: Environment): void {
    const { editingNote } = app.store.getState() as EditingNoteSlice
    const body = editingNote?.body
    if (typeof body !== 'string' || body.trim().length === 0) {
      app.notifications.addError('ink-presentation', {
        detail: 'Open a note with content to start a presentation.',
        dismissable: true
      })
      return
    }
    presentationEvents.emitToggle({
      title: editingNote?.title ?? 'Untitled',
      body,
      id: editingNote?._id
    })
  }
}

export default new InkPresentationPlugin()
