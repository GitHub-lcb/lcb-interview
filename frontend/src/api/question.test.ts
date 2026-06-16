import { describe, expect, it } from 'vitest'
import { normalizePageResult } from './question'

describe('question api helpers', () => {
  it('keeps backend content page shape stable', () => {
    const page = normalizePageResult({
      content: [{ id: 1, title: 'A' }],
      page: 1,
      size: 20,
      total: 1,
      totalPages: 1,
    })

    expect(page.content).toEqual([{ id: 1, title: 'A' }])
    expect(page.total).toBe(1)
    expect(page.totalPages).toBe(1)
  })

  it('normalizes records page shape from compatible APIs', () => {
    const page = normalizePageResult({
      records: [{ id: 2, title: 'B' }],
      current: 2,
      size: 10,
      total: 21,
      pages: 3,
    })

    expect(page).toEqual({
      content: [{ id: 2, title: 'B' }],
      page: 2,
      size: 10,
      total: 21,
      totalPages: 3,
    })
  })

  it('falls back to an empty page for malformed responses', () => {
    expect(normalizePageResult()).toEqual({
      content: [],
      page: 0,
      size: 0,
      total: 0,
      totalPages: 0,
    })
  })
})
