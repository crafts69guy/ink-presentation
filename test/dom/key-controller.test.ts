import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindKeys, type KeyAction } from '../../src/reveal/key-controller'

function pressKey(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  window.dispatchEvent(event)
  return event
}

describe('bindKeys', () => {
  let unbind: (() => void) | null = null

  afterEach(() => {
    unbind?.()
    unbind = null
  })

  it('translates owned keys into actions and consumes the event', () => {
    const actions: KeyAction[] = []
    unbind = bindKeys(action => actions.push(action))

    const event = pressKey('ArrowRight')

    expect(actions).toEqual(['next'])
    expect(event.defaultPrevented).toBe(true)
  })

  it('captures before bubble-phase listeners (Inkdrop keymaps never fire)', () => {
    const order: string[] = []
    const bubbleListener = () => order.push('bubble')
    window.addEventListener('keydown', bubbleListener)
    unbind = bindKeys(() => order.push('action'))

    pressKey('Escape')
    window.removeEventListener('keydown', bubbleListener)

    expect(order).toEqual(['action'])
  })

  it('lets unowned and modifier keys propagate', () => {
    const onAction = vi.fn()
    unbind = bindKeys(onAction)

    const unowned = pressKey('x')
    const withModifier = pressKey('n', { metaKey: true })

    expect(onAction).not.toHaveBeenCalled()
    expect(unowned.defaultPrevented).toBe(false)
    expect(withModifier.defaultPrevented).toBe(false)
  })

  it('stops handling after unbind', () => {
    const onAction = vi.fn()
    const cleanup = bindKeys(onAction)
    cleanup()

    pressKey('ArrowRight')

    expect(onAction).not.toHaveBeenCalled()
  })
})
