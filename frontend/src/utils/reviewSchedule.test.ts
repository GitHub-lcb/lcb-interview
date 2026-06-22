import { describe, expect, it } from 'vitest'
import type { Question } from '../types'
import { createDefaultProgress, rememberQuestions } from './studyProgress'
import { buildReviewScheduleMarkdown, buildScheduledReviewQueue, summarizeReviewSchedule } from './reviewSchedule'

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

  it('schedules repeatedly encountered new questions for active recall', () => {
    let progress = createDefaultProgress('2026-06-17T00:00:00')
    progress = rememberQuestions(progress, [question(5), question(6)])
    progress = {
      ...progress,
      questionStates: {
        5: {
          status: 'new',
          addedToPlan: false,
          reviewCount: 0,
          encounterCount: 2,
          lastEncounteredAt: '2026-06-16T20:00:00',
        },
        6: {
          status: 'new',
          addedToPlan: false,
          reviewCount: 0,
          encounterCount: 1,
          lastEncounteredAt: '2026-06-16T21:00:00',
        },
      },
    }

    const queue = buildScheduledReviewQueue(progress, today)

    expect(queue.map(item => item.id)).toEqual([5])
    expect(queue[0]).toMatchObject({
      id: 5,
      status: 'new',
      reviewCount: 0,
      dueStatus: 'due-today',
      daysUntilDue: 0,
    })
    expect(queue[0].scheduleReason).toBe('多次遇见但还没完成复习，先安排一次主动回忆。')
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
      activeRecall: 0,
      nextReviewAt: '2026-06-19T09:00:00.000Z',
    })
  })

  it('summarizes repeatedly encountered new questions as active recall', () => {
    let progress = createDefaultProgress()
    progress = rememberQuestions(progress, [question(5), question(6)])
    progress = {
      ...progress,
      questionStates: {
        5: {
          status: 'new',
          addedToPlan: false,
          reviewCount: 0,
          encounterCount: 2,
          lastEncounteredAt: '2026-06-16T20:00:00',
        },
        6: { status: 'weak', addedToPlan: false, reviewCount: 1, lastReviewedAt: '2026-06-16T09:00:00' },
      },
    }

    const summary = summarizeReviewSchedule(buildScheduledReviewQueue(progress, today))

    expect(summary.activeRecall).toBe(1)
    expect(summary.dueToday).toBe(2)
  })

  it('exports review schedule markdown with due status, reasons, and links', () => {
    let progress = createDefaultProgress()
    progress = rememberQuestions(progress, [question(1), question(2), question(3)])
    progress = {
      ...progress,
      questionStates: {
        1: { status: 'learning', addedToPlan: true, reviewCount: 1, lastReviewedAt: '2026-06-15T09:00:00' },
        2: { status: 'weak', addedToPlan: true, reviewCount: 2, lastReviewedAt: '2026-06-16T09:00:00' },
        3: { status: 'learning', addedToPlan: false, reviewCount: 2, lastReviewedAt: '2026-06-16T09:00:00' },
      },
    }

    const markdown = buildReviewScheduleMarkdown(progress, today)

    expect(markdown).toContain('# Java 后端 智能复习队列')
    expect(markdown).toContain('生成时间：2026-06-17')
    expect(markdown).toContain('## 排期概览')
    expect(markdown).toContain('- 已逾期：1 道')
    expect(markdown).toContain('- 今日到期：1 道')
    expect(markdown).toContain('- 即将到期：1 道')
    expect(markdown).toContain('## 复习队列')
    expect(markdown).toContain('1. Question 1')
    expect(markdown).toContain('状态：已逾期')
    expect(markdown).toContain('原因：学习中题 1 天后复习，先建立第一轮记忆。')
    expect(markdown).toContain('入口：/question/1')
    expect(markdown).not.toContain('undefined')
  })

  it('exports active recall review items with recall status and practice links', () => {
    let progress = createDefaultProgress('2026-06-17T00:00:00')
    progress = rememberQuestions(progress, [question(5)])
    progress = {
      ...progress,
      questionStates: {
        5: {
          status: 'new',
          addedToPlan: false,
          reviewCount: 0,
          encounterCount: 2,
          lastEncounteredAt: '2026-06-16T20:00:00',
        },
      },
    }

    const markdown = buildReviewScheduleMarkdown(progress, today)

    expect(markdown).toContain('1. Question 5')
    expect(markdown).toContain('状态：主动回忆')
    expect(markdown).toContain('- 主动回忆：1 道')
    expect(markdown).toContain('排期：今日到期')
    expect(markdown).toContain('遇见次数：2 次')
    expect(markdown).toContain('原因：多次遇见但还没完成复习，先安排一次主动回忆。')
    expect(markdown).toContain('训练入口：/practice?queue=5&from=review-due')
    expect(markdown).toContain('题目入口：/question/5')
    expect(markdown).not.toContain('复习次数：0 次')
    expect(markdown).not.toContain('undefined')
  })

  it('exports actionable markdown when review queue is empty', () => {
    const markdown = buildReviewScheduleMarkdown(createDefaultProgress(), today)

    expect(markdown).toContain('# Java 后端 智能复习队列')
    expect(markdown).toContain('## 复习队列')
    expect(markdown).toContain('暂无到期复习题')
    expect(markdown).toContain('先把薄弱题标记为“薄弱”或加入今日计划')
    expect(markdown).toContain('入口：/banks')
    expect(markdown).not.toContain('undefined')
  })
})
