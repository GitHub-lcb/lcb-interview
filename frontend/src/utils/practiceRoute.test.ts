import { describe, expect, it } from 'vitest'
import { createDefaultProgress } from './studyProgress'
import {
  appendPracticeHandoffSource,
  buildContinuePracticePath,
  buildDailyPracticePath,
  extractPracticeHandoffSource,
  preservePracticeHandoffSourceInText,
} from './practiceRoute'

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

  it('drops fractional question ids before building query string', () => {
    expect(buildDailyPracticePath([2.5, 2, 3.1, 2, 4]))
      .toBe('/practice?queue=2,4')
  })

  it('truncates the queue to the configured limit', () => {
    expect(buildDailyPracticePath([1, 2, 3, 4, 5], 3)).toBe('/practice?queue=1,2,3')
  })

  it('keeps an explicit practice source with the daily queue', () => {
    expect(buildDailyPracticePath([3, 1, 3, 2], 12, 'daily-plan'))
      .toBe('/practice?queue=3,1,2&from=daily-plan')
  })
})

describe('buildContinuePracticePath', () => {
  it('continues unfinished daily plan questions before falling back to generic practice', () => {
    const progress = {
      ...createDefaultProgress('2026-06-21T00:00:00.000Z'),
      dailyPlan: [1, 2, 3],
      questionStates: {
        1: { status: 'mastered' as const, addedToPlan: true, reviewCount: 2 },
        2: { status: 'learning' as const, addedToPlan: true, reviewCount: 1 },
        3: { status: 'new' as const, addedToPlan: true, reviewCount: 0 },
      },
    }

    expect(buildContinuePracticePath(progress)).toBe('/practice?queue=2,3&from=daily-plan')
  })

  it('falls back to generic practice when the daily plan has no unfinished questions', () => {
    const progress = {
      ...createDefaultProgress('2026-06-21T00:00:00.000Z'),
      dailyPlan: [1],
      questionStates: {
        1: { status: 'mastered' as const, addedToPlan: true, reviewCount: 2 },
      },
    }

    expect(buildContinuePracticePath(progress)).toBe('/practice')
  })
})

describe('appendPracticeHandoffSource', () => {
  it('adds a handoff source to practice routes', () => {
    expect(appendPracticeHandoffSource('/practice?queue=2', 'filtered-list'))
      .toBe('/practice?queue=2&from=filtered-list')
  })

  it('replaces an existing handoff source by default', () => {
    expect(appendPracticeHandoffSource('/practice?queue=2&from=review-due', 'filtered-list'))
      .toBe('/practice?queue=2&from=filtered-list')
  })

  it('can preserve an existing handoff source when requested', () => {
    expect(appendPracticeHandoffSource('/practice?queue=2&from=review-due', 'filtered-list', { replace: false }))
      .toBe('/practice?queue=2&from=review-due')
  })

  it('keeps the hash fragment after adding the handoff source', () => {
    expect(appendPracticeHandoffSource('/practice?queue=2#next', 'filtered-list'))
      .toBe('/practice?queue=2&from=filtered-list#next')
  })

  it('does not change non-practice routes', () => {
    expect(appendPracticeHandoffSource('/question/2', 'filtered-list')).toBe('/question/2')
  })
})

describe('extractPracticeHandoffSource', () => {
  it('extracts a decoded source from a practice queue path', () => {
    expect(extractPracticeHandoffSource('/practice?queue=2&from=daily%20plan')).toBe('daily plan')
  })

  it('returns undefined when the queue path has no source', () => {
    expect(extractPracticeHandoffSource('/practice?queue=2')).toBeUndefined()
  })
})

describe('preservePracticeHandoffSourceInText', () => {
  it('adds the session handoff source to exported practice queue links without replacing existing sources', () => {
    const markdown = [
      '- 继续训练：/practice?queue=2',
      '- 单题补弱：/practice?question=2',
      '- 已有来源：/practice?queue=3&from=review-due',
      '- 已有单题来源：/practice?question=4&from=review-due',
      '- 查看题目：/question/2',
    ].join('\n')

    expect(preservePracticeHandoffSourceInText(markdown, '/practice?queue=1,2&from=filtered-list'))
      .toBe([
        '- 继续训练：/practice?queue=2&from=filtered-list',
        '- 单题补弱：/practice?question=2&from=filtered-list',
        '- 已有来源：/practice?queue=3&from=review-due',
        '- 已有单题来源：/practice?question=4&from=review-due',
        '- 查看题目：/question/2',
      ].join('\n'))
  })

  it('preserves source for practice links when queue or question is not the first query parameter', () => {
    const markdown = [
      '- retry queue: /practice?mode=retry&queue=2',
      '- retry question: /practice?mode=retry&question=3#answer',
      '- existing source: /practice?mode=retry&question=4&from=review-due',
    ].join('\n')

    expect(preservePracticeHandoffSourceInText(markdown, '/practice?queue=1,2&from=filtered-list'))
      .toBe([
        '- retry queue: /practice?mode=retry&queue=2&from=filtered-list',
        '- retry question: /practice?mode=retry&question=3&from=filtered-list#answer',
        '- existing source: /practice?mode=retry&question=4&from=review-due',
      ].join('\n'))
  })
})
