/// <reference types="vite/client" />

import { describe, expect, it } from 'vitest'

describe('raw html buttons', () => {
  it('declare an explicit type so they never submit forms by accident', () => {
    const sources = import.meta.glob('./**/*.tsx', {
      eager: true,
      import: 'default',
      query: '?raw',
    }) as Record<string, string>
    const missingType = Object.entries(sources).flatMap(([file, source]) => {
      if (file.endsWith('.test.tsx')) {
        return []
      }
      const matches = source.matchAll(/<button\b(?![^>]*\btype=)[^>]*>/g)
      return Array.from(matches, match => {
        const before = source.slice(0, match.index)
        const line = before.split(/\r?\n/).length
        return `${file.replace(/^\.\//, '')}:${line}`
      })
    })

    expect(missingType).toEqual([])
  })
})
