import { describe, expect, it } from 'vitest'
import type { Question, StudyProgress, StudyQuestionStatus } from '../types'
import { createDefaultProgress, rememberQuestions } from './studyProgress'
import { buildPaceFilledDailyPlan } from './studyPacePlan'

const NOW = '2026-06-17T09:00:00.000Z'

function question(id: number, categoryName = 'Java 并发'): Question {
  return {
    id,
    title: `Question ${id}`,
    content: 'content',
    difficulty: 'MEDIUM',
    categoryName,
    categoryId: 1,
    tags: ['Java'],
    viewCount: 100 + id,
    createTime: '2026-06-15T00:00:00',
  }
}

function markQuestion(
  progress: StudyProgress,
  id: number,
  status: StudyQuestionStatus,
  lastReviewedAt = NOW,
): StudyProgress {
  return {
    ...progress,
    questionStates: {
      ...progress.questionStates,
      [id]: {
        status,
        addedToPlan: progress.dailyPlan.includes(id),
        lastReviewedAt,
        reviewCount: status === 'new' ? 0 : 1,
      },
    },
  }
}

describe('buildPaceFilledDailyPlan', () => {
  it('keeps an empty plan unchanged when there are no candidates or review debts', () => {
    const plan = buildPaceFilledDailyPlan(createDefaultProgress(NOW), [], NOW)

    expect(plan).toEqual([])
  })

  it('preserves current plan and fills weak, learning, then new questions to the daily target', () => {
    let progress = createDefaultProgress(NOW)
    progress = {
      ...progress,
      dailyPlan: [10],
    }
    progress = markQuestion(progress, 1, 'mastered', NOW)
    progress = markQuestion(progress, 2, 'weak', NOW)
    progress = markQuestion(progress, 3, 'learning', NOW)

    const plan = buildPaceFilledDailyPlan(progress, [
      question(1),
      question(2),
      question(3),
      question(4),
      question(5),
      question(6),
      question(7),
    ], NOW)

    expect(plan).toEqual([10, 2, 3, 4, 5, 6])
  })

  it('adds overdue and due review debts before fresh candidate questions', () => {
    let progress = createDefaultProgress(NOW)
    progress = rememberQuestions(progress, [question(1), question(2)], NOW)
    progress = {
      ...progress,
      dailyPlan: [10],
      questionStates: {
        1: {
          status: 'weak',
          addedToPlan: false,
          reviewCount: 1,
          lastReviewedAt: '2026-06-10T09:00:00.000Z',
        },
        2: {
          status: 'learning',
          addedToPlan: false,
          reviewCount: 1,
          lastReviewedAt: '2026-06-16T09:00:00.000Z',
        },
      },
    }

    const plan = buildPaceFilledDailyPlan(progress, [
      question(3),
      question(4),
      question(5),
      question(6),
      question(7),
    ], NOW)

    expect(plan).toEqual([10, 1, 2, 3, 4, 5])
  })

  it('truncates an oversized current plan to the daily target without adding more questions', () => {
    const progress = {
      ...createDefaultProgress(NOW),
      dailyPlan: [1, 2, 3, 4, 5, 6, 7, 8],
    }

    const plan = buildPaceFilledDailyPlan(progress, [question(9)], NOW)

    expect(plan).toEqual([1, 2, 3, 4, 5, 6])
  })
})
