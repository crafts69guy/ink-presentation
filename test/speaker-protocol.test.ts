import { describe, expect, it } from 'vitest'
import {
  createOriginId,
  parseSpeakerEnter,
  parseSpeakerMessage,
  sanitizeDeckOptions,
  SeqGate
} from '../src/core/speaker-protocol'

const base = { sessionId: 's1', from: 'w1' }

describe('parseSpeakerMessage', () => {
  it('parses lifecycle messages', () => {
    for (const kind of ['hello', 'end', 'bye'] as const) {
      expect(parseSpeakerMessage({ kind, ...base })).toEqual({ kind, ...base })
    }
  })

  it('parses a nav message and rejects unknown actions', () => {
    expect(parseSpeakerMessage({ kind: 'nav', action: 'next', ...base })).toEqual({
      kind: 'nav',
      action: 'next',
      ...base
    })
    expect(parseSpeakerMessage({ kind: 'nav', action: 'jump', ...base })).toBeNull()
    expect(parseSpeakerMessage({ kind: 'nav', ...base })).toBeNull()
  })

  it('parses a position message', () => {
    const message = parseSpeakerMessage({
      kind: 'position',
      seq: 3,
      position: { h: 2, v: 1 },
      ...base
    })
    expect(message).toEqual({ kind: 'position', seq: 3, position: { h: 2, v: 1 }, ...base })
  })

  it('parses an init message and sanitizes options', () => {
    const message = parseSpeakerMessage({
      kind: 'init',
      seq: 1,
      title: 'Deck',
      markdown: '# Hi',
      options: { theme: 'night', transition: 'nope', autoFullscreen: true },
      position: { h: 0, v: 0 },
      ...base
    })
    expect(message).toMatchObject({
      kind: 'init',
      title: 'Deck',
      markdown: '# Hi',
      options: { theme: 'night', transition: 'slide', autoFullscreen: false }
    })
  })

  it('rejects malformed payloads', () => {
    expect(parseSpeakerMessage(null)).toBeNull()
    expect(parseSpeakerMessage('hello')).toBeNull()
    expect(parseSpeakerMessage({ kind: 'hello', sessionId: '', from: 'w' })).toBeNull()
    expect(parseSpeakerMessage({ kind: 'hello', sessionId: 's' })).toBeNull()
    expect(parseSpeakerMessage({ kind: 'unknown', ...base })).toBeNull()
    expect(
      parseSpeakerMessage({ kind: 'position', seq: Number.NaN, position: { h: 0, v: 0 }, ...base })
    ).toBeNull()
    expect(
      parseSpeakerMessage({ kind: 'position', seq: 1, position: { h: 'x', v: 0 }, ...base })
    ).toBeNull()
    expect(
      parseSpeakerMessage({ kind: 'init', seq: 1, markdown: 42, position: { h: 0, v: 0 }, ...base })
    ).toBeNull()
  })
})

describe('sanitizeDeckOptions', () => {
  it('falls back per field and never enables autoFullscreen', () => {
    expect(sanitizeDeckOptions(undefined)).toEqual({
      theme: 'inkdrop',
      transition: 'slide',
      separator: 'auto',
      showSlideNumber: false,
      showProgressBar: false,
      verticalSlides: false,
      autoFullscreen: false,
      customCss: ''
    })
    expect(
      sanitizeDeckOptions({ theme: 'white', showSlideNumber: true, autoFullscreen: true })
    ).toMatchObject({
      theme: 'white',
      showSlideNumber: true,
      autoFullscreen: false
    })
  })

  it('passes customCss through as a string only', () => {
    expect(sanitizeDeckOptions({ customCss: '.reveal h1 { color: red }' })).toMatchObject({
      customCss: '.reveal h1 { color: red }'
    })
    expect(sanitizeDeckOptions({ customCss: 42 })).toMatchObject({ customCss: '' })
  })
})

describe('SeqGate', () => {
  it('accepts strictly increasing sequences only', () => {
    const gate = new SeqGate()
    expect(gate.accept(1)).toBe(true)
    expect(gate.accept(1)).toBe(false)
    expect(gate.accept(0)).toBe(false)
    expect(gate.accept(2)).toBe(true)
    expect(gate.accept(Number.NaN)).toBe(false)
    expect(gate.accept(Number.POSITIVE_INFINITY)).toBe(false)
  })
})

describe('parseSpeakerEnter', () => {
  it('accepts the boot payload and rejects junk', () => {
    expect(parseSpeakerEnter({ sessionId: 's1', from: 'w1' })).toEqual({
      sessionId: 's1',
      from: 'w1'
    })
    expect(parseSpeakerEnter({ sessionId: 's1' })).toBeNull()
    expect(parseSpeakerEnter({ sessionId: '', from: 'w1' })).toBeNull()
    expect(parseSpeakerEnter(undefined)).toBeNull()
  })
})

describe('createOriginId', () => {
  it('produces distinct non-empty ids', () => {
    const a = createOriginId()
    const b = createOriginId()
    expect(a).not.toBe('')
    expect(a).not.toBe(b)
  })
})
