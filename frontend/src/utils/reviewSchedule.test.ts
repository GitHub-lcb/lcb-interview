import { describe, expect, it } from 'vitest'
import type { Question } from '../types'
import { createDefaultProgress, rememberQuestions } from './studyProgress'
import { buildScheduledReviewQueue, summarizeReviewSchedule } from './reviewSchedule'

const today = '2026-06-17T09:00:00'

function question(id: number, categoryName = 'Java 并发'): Question {
  return {
    id,
    title: `Question ${id}`,
    content: 'content',
    difficulty: 'MEDIUM',
    categoryName,
    categoryId: 1,
    tags: ['Java'],
    viewCount: 100,
    createTime: '2026-06-15T00:00:00',
  }
}

describe('reviewSchedule', () => {
  it('marks weak questions without review time as due today', () => {
    let progress = createDefaultProgress('2026-06-17T00:00:00')
    progress = rememberQuestions(progress, [question(1)])
    progress = {
      ...progress,
      questionStates: {
        1: { status: 'weak', addedToPlan: false, reviewCount: 0 },
      },
    }

    const queue = buildScheduledReviewQueue(progress, today)

    expect(queue[0]).toMatchObject({
      id: 1,
      dueStatus: 'due-today',
      daysUntilDue: 0,
    })
    expect(queue[0].scheduleReason).toContain('薄弱题')
  })

  it('uses 1, 3, and 7 day intervals for learning questions', () => {
    let progress = createDefaultProgress()
    progress = rememberQuestions(progress, [question(1), question(2), question(3)])
    progress = {
      ...progress,
      questionStates: {
        1: { status: 'learning', addedToPlan: true, reviewCount: 1, lastReviewedAt: '2026-06-16T09:00:00' },
        2: { status: 'learning', addedToPlan: true, reviewCount: 2, lastReviewedAt: '2026-06-14T09:00:00' },
        3: { status: 'learning', addedToPlan: true, reviewCount: 3, lastReviewedAt: '2026-06-10T09:00:00' },
      },
    }

    const queue = buildScheduledReviewQueue(progress, today)

    expect(queue.map(item => item.id)).toEqual([1, 2, 3])
    expect(queue.every(item => item.dueStatus === 'due-today')).toBe(true)
  })

  it('uses longer intervals for mastered questions', () => {
    let progress = createDefaultProgress()
    progress = rememberQuestions(progress, [question(1), question(2)])
    progress = {
      ...progress,
      questionStates: {
        1: { status: 'mastered', addedToPlan: false, reviewCount: 2, lastReviewedAt: '2026-06-10T09:00:00' },
        2: { status: 'mastered', addedToPlan: false, reviewCount: 3, lastReviewedAt: '2026-06-03T09:00:00' },
      },
    }

    const queue = buildScheduledReviewQueue(progress, today)

    expect(queue.map(item => item.daysUntilDue)).toEqual([0, 0])
    expect(queue.map(item => item.scheduleReason)).toEqual([
      '已掌握题 7 天后巩固，避免长期遗忘。',
      '稳定掌握题 14 天后回看，维持长期记忆。',
    ])
  })

  it('sorts overdue items before due today and upcoming items', () => {
    let progress = createDefaultProgress()
    progress = rememberQuestions(progress, [question(1), question(2), question(3)])
    progress = {
      ...progress,
      questionStates: {
        1: { status: 'learning', addedToPlan: false, reviewCount: 1, lastReviewedAt: '2026-06-15T09:00:00' },
        2: { status: 'weak', addedToPlan: false, reviewCount: 1, lastReviewedAt: '2026-06-16T09:00:00' },
        3: { status: 'learning', addedToPlan: false, reviewCount: 2, lastReviewedAt: '2026-06-16T09:00:00' },
      },
    }

    const queue = buildScheduledReviewQueue(progress, today)

    expect(queue.map(item => item.id)).toEqual([1, 2, 3])
    expect(queue.map(item => item.dueStatus)).toEqual(['overdue', 'due-today', 'upcoming'])
  })

  it('summarizes overdue, due today, upcoming, and next review time', () => {
    let progress = createDefaultProgress()
    progress = rememberQuestions(progress, [question(1), question(2), question(3), question(4)])
    progress = {
      ...progress,
      questionStates: {
        1: { status: 'learning', addedToPlan: false, reviewCount: 1, lastReviewedAt: '2026-06-15T09:00:00' },
        2: { status: 'weak', addedToPlan: false, reviewCount: 1, lastReviewedAt: '2026-06-16T09:00:00' },
        3: { status: 'learning', addedToPlan: false, reviewCount: 2, lastReviewedAt: '2026-06-16T09:00:00' },
        4: { status: 'new', addedToPlan: false, reviewCount: 0 },
      },
    }

    const summary = summarizeReviewSchedule(buildScheduledReviewQueue(progress, today))

    expect(summary).toEqual({
      overdue: 1,
      dueToday: 1,
      upcoming: 1,
      nextReviewAt: '2026-06-19T09:00:00.000Z',
    })
  })
})
