import { describe, expect, it } from 'vitest'
import { mapKeyToAction } from '../src/reveal/key-controller'

const noModifier = { hasModifier: false }
const withModifier = { hasModifier: true }

describe('mapKeyToAction', () => {
  it('maps arrow keys and space to next/prev', () => {
    expect(mapKeyToAction('ArrowRight', noModifier)).toBe('next')
    expect(mapKeyToAction('ArrowDown', noModifier)).toBe('next')
    expect(mapKeyToAction(' ', noModifier)).toBe('next')
    expect(mapKeyToAction('PageDown', noModifier)).toBe('next')
    expect(mapKeyToAction('ArrowLeft', noModifier)).toBe('prev')
    expect(mapKeyToAction('ArrowUp', noModifier)).toBe('prev')
    expect(mapKeyToAction('PageUp', noModifier)).toBe('prev')
  })

  it('maps n/p to next/prev', () => {
    expect(mapKeyToAction('n', noModifier)).toBe('next')
    expect(mapKeyToAction('p', noModifier)).toBe('prev')
  })

  it('maps vim-style hjkl to next/prev', () => {
    expect(mapKeyToAction('j', noModifier)).toBe('next')
    expect(mapKeyToAction('l', noModifier)).toBe('next')
    expect(mapKeyToAction('h', noModifier)).toBe('prev')
    expect(mapKeyToAction('k', noModifier)).toBe('prev')
  })

  it('maps Home/End to first/last', () => {
    expect(mapKeyToAction('Home', noModifier)).toBe('first')
    expect(mapKeyToAction('End', noModifier)).toBe('last')
  })

  it('maps the remaining single-purpose keys', () => {
    expect(mapKeyToAction('o', noModifier)).toBe('toggle-overview')
    expect(mapKeyToAction('f', noModifier)).toBe('toggle-fullscreen')
    expect(mapKeyToAction('s', noModifier)).toBe('toggle-notes')
    expect(mapKeyToAction('.', noModifier)).toBe('toggle-pause')
    expect(mapKeyToAction('b', noModifier)).toBe('toggle-pause')
    expect(mapKeyToAction('v', noModifier)).toBe('speaker-view')
    expect(mapKeyToAction('Escape', noModifier)).toBe('escape')
  })

  it('returns null for unmapped keys', () => {
    expect(mapKeyToAction('x', noModifier)).toBeNull()
    expect(mapKeyToAction('Tab', noModifier)).toBeNull()
  })

  it('lets any owned key pass through when a modifier is held', () => {
    expect(mapKeyToAction('ArrowRight', withModifier)).toBeNull()
    expect(mapKeyToAction('j', withModifier)).toBeNull()
    expect(mapKeyToAction('Escape', withModifier)).toBeNull()
  })
})
