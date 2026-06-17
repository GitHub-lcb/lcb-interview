import { describe, expect, it } from 'vitest'
import { buildDailyPracticePath } from './practiceRoute'

describe('buildDailyPracticePath', () => {
  it('falls back to practice page when the daily plan is empty', () => {
    expect(buildDailyPracticePath([])).toBe('/practice')
  })

  it('keeps unique positive ids in daily plan order', () => {
    expect(buildDailyPracticePath([3, 1, 3, 2])).toBe('/practice?queue=3,1,2')
  })

  it('filters invalid question ids before building query string', () => {
    expect(buildDailyPracticePath([0, 1, Number.NaN, -2, Number.POSITIVE_INFINITY, 5]))
      .toBe('/practice?queue=1,5')
  })

  it('truncates the queue to the configured limit', () => {
    expect(buildDailyPracticePath([1, 2, 3, 4, 5], 3)).toBe('/practice?queue=1,2,3')
  })
})
