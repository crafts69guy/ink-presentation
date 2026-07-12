// jsdom lacks a few layout-adjacent APIs the reveal/ layer touches. Minimal
// no-op stands-in are enough: DOM tests assert structure, never geometry.

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}

if (typeof window.matchMedia === 'undefined') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false
    }) as MediaQueryList
}

if (typeof window.requestIdleCallback === 'undefined') {
  window.requestIdleCallback = (callback: IdleRequestCallback): number =>
    window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 }), 0)
  window.cancelIdleCallback = (handle: number): void => window.clearTimeout(handle)
}
