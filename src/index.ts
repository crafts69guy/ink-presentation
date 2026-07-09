import type { Environment, IInkdropPlugin } from '@inkdropapp/types'
import { CompositeDisposable } from 'event-kit'
import { configSchema } from './config'
import { setEnv } from './env'
import { PresentationView } from './ui/PresentationView'
import { presentationEvents } from './ui/presentation-events'

const COMPONENT_NAME = 'PresentationView'

interface EditingNoteSlice {
  editingNote?: {
    title?: string
    body?: string
  } | null
}

class InkPresentationPlugin implements IInkdropPlugin {
  readonly config = configSchema
  private subscriptions: CompositeDisposable | null = null

  activate(app: Environment): void {
    setEnv(app)
    app.components.registerClass(PresentationView, COMPONENT_NAME)
    app.layouts.addComponentToLayout('modal', COMPONENT_NAME)
    this.subscriptions = new CompositeDisposable(
      app.commands.add(document.body, {
        'ink-presentation:toggle': () => this.toggle(app)
      })
    )
  }

  deactivate(app: Environment): void {
    presentationEvents.emitForceClose()
    this.subscriptions?.dispose()
    this.subscriptions = null
    app.layouts.removeComponentFromLayout('modal', COMPONENT_NAME)
    app.components.deleteClass(PresentationView, COMPONENT_NAME)
    setEnv(null)
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
      body
    })
  }
}

export default new InkPresentationPlugin()
