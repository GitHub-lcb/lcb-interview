import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useIsMobile, useMediaQuery } from './useMediaQuery'

interface MediaQueryListener {
  matches: boolean
  media: string
  listeners: Set<(event: { matches: boolean }) => void>
  addEventListener: (type: string, listener: (event: { matches: boolean }) => void) => void
  removeEventListener: (type: string, listener: (event: { matches: boolean }) => void) => void
}

const mqlRegistry: MediaQueryListener[] = []

function installMatchMediaMock() {
  mqlRegistry.length = 0
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string): MediaQueryListener => {
      const listener: MediaQueryListener = {
        matches: false,
        media: query,
        listeners: new Set(),
        addEventListener(type, cb) {
          if (type === 'change') {
            listener.listeners.add(cb)
          }
        },
        removeEventListener(type, cb) {
          if (type === 'change') {
            listener.listeners.delete(cb)
          }
        },
      }
      mqlRegistry.push(listener)
      return listener
    }),
  })
}

function emitChange(listener: MediaQueryListener, matches: boolean) {
  listener.matches = matches
  listener.listeners.forEach(cb => cb({ matches }))
}

describe('useMediaQuery', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the initial match result after mount', () => {
    installMatchMediaMock()
    const { result } = renderHook(() => useMediaQuery('(max-width: 640px)'))
    expect(result.current).toBe(false)
  })

  it('updates when the media query state changes', () => {
    installMatchMediaMock()
    const { result } = renderHook(() => useMediaQuery('(max-width: 640px)'))
    const mql = mqlRegistry[0]
    expect(mql).toBeDefined()

    act(() => emitChange(mql, true))
    expect(result.current).toBe(true)

    act(() => emitChange(mql, false))
    expect(result.current).toBe(false)
  })

  it('re-subscribes when the query changes', () => {
    installMatchMediaMock()
    const { result, rerender } = renderHook(
      ({ query }) => useMediaQuery(query),
      { initialProps: { query: '(max-width: 640px)' } },
    )
    expect(mqlRegistry).toHaveLength(1)

    rerender({ query: '(max-width: 900px)' })
    expect(mqlRegistry).toHaveLength(2)
    expect(mqlRegistry[1].media).toBe('(max-width: 900px)')
    expect(result.current).toBe(false)
  })

  it('removes the listener on unmount', () => {
    installMatchMediaMock()
    const { unmount } = renderHook(() => useMediaQuery('(max-width: 640px)'))
    const mql = mqlRegistry[0]
    expect(mql.listeners.size).toBe(1)

    unmount()
    expect(mql.listeners.size).toBe(0)
  })

  it('falls back to the initial value without window.matchMedia', () => {
    Object.defineProperty(window, 'matchMedia', { writable: true, value: undefined })
    const { result } = renderHook(() => useMediaQuery('(max-width: 640px)', true))
    expect(result.current).toBe(true)
  })
})

describe('useIsMobile', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('queries the 640px breakpoint', () => {
    installMatchMediaMock()
    renderHook(() => useIsMobile())
    expect(mqlRegistry[0].media).toBe('(max-width: 640px)')
  })
})
