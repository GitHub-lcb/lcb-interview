import { describe, expect, it } from 'vitest'
import type { InterviewAttempt, InterviewCriterionKey, StudyProgress } from '../types'
import { buildInterviewEmergencyKit } from './interviewEmergencyKit'

const NOW = '2026-06-17T09:00:00.000Z'

function emptyProgress(): StudyProgress {
  return {
    targetRole: 'Java 后端',
    sprintDays: 21,
    questionStates: {},
    questionSnapshots: {},
    interviewAttempts: {},
    dailyPlan: [],
    updatedAt: NOW,
  }
}

function addQuestion(
  progress: StudyProgress,
  id: number,
  status: 'learning' | 'mastered' | 'weak' = 'learning',
  lastReviewedAt = NOW,
) {
  progress.questionStates[id] = {
    status,
    addedToPlan: true,
    lastReviewedAt,
    reviewCount: status === 'mastered' ? 3 : 1,
  }
  progress.questionSnapshots[id] = {
    id,
    title: `Java 并发题 ${id}`,
    difficulty: 'MEDIUM',
    categoryName: 'Java 并发',
    tags: ['Java 并发'],
    viewCount: 100 + id,
  }
}

function attempt(
  questionId: number,
  scores: Partial<Record<InterviewCriterionKey, number>> = {},
  createdAt = NOW,
): InterviewAttempt {
  const merged: Record<InterviewCriterionKey, number> = {
    coverage: 86,
    structure: 86,
    specificity: 86,
    risk: 86,
    ...scores,
  }

  return {
    questionId,
    answer: '围绕原理、场景、风险和落地讲清楚。',
    createdAt,
    feedback: {
      score: Math.round(Object.values(merged).reduce((sum, value) => sum + value, 0) / 4),
      level: 'pass',
      criteria: [
        { key: 'coverage', label: '覆盖度', score: merged.coverage, summary: '覆盖情况' },
        { key: 'structure', label: '结构化', score: merged.structure, summary: '结构情况' },
        { key: 'specificity', label: '场景细节', score: merged.specificity, summary: '场景情况' },
        { key: 'risk', label: '风险意识', score: merged.risk, summary: '风险情况' },
      ],
      advice: [],
      followUps: [],
    },
  }
}

describe('buildInterviewEmergencyKit', () => {
  it('guides empty progress to create the first interview sample', () => {
    const kit = buildInterviewEmergencyKit(emptyProgress(), NOW)

    expect(kit.level).toBe('empty')
    expect(kit.title).toContain('先建立')
    expect(kit.primaryAction.to).toBe('/practice')
    expect(kit.items[0]).toMatchObject({ kind: 'sample', durationMinutes: 12 })
  })

  it('prioritizes overdue review debt before other actions', () => {
    const progress = emptyProgress()
    addQuestion(progress, 1, 'weak', '2026-06-13T00:00:00.000Z')
    addQuestion(progress, 2, 'learning', NOW)
    progress.dailyPlan = [1, 2]
    progress.interviewAttempts[2] = [attempt(2, { specificity: 40 })]

    const kit = buildInterviewEmergencyKit(progress, NOW)

    expect(kit.level).toBe('critical')
    expect(kit.items[0].kind).toBe('review')
    expect(kit.items[0].questionIds).toEqual([1])
    expect(kit.items[0].to).toBe('/practice?queue=1')
    expect(kit.reviewDebtCount).toBe(1)
  })

  it('adds the top mistake recovery step when interview criteria are low', () => {
    const progress = emptyProgress()
    addQuestion(progress, 3, 'mastered', NOW)
    progress.interviewAttempts[3] = [attempt(3, { risk: 35 })]

    const kit = buildInterviewEmergencyKit(progress, NOW)

    expect(kit.items.some(item => item.kind === 'mistake')).toBe(true)
    expect(kit.primaryAction.to).toBe('/practice?queue=3')
    expect(kit.mistakeCount).toBeGreaterThan(0)
  })

  it('keeps the emergency plan inside a 30 minute and 5 action budget', () => {
    const progress = emptyProgress()
    for (let id = 1; id <= 8; id += 1) {
      addQuestion(progress, id, 'weak', '2026-06-10T00:00:00.000Z')
    }
    progress.dailyPlan = [1, 2, 3, 4, 5, 6, 7, 8]
    progress.interviewAttempts[8] = [attempt(8, { coverage: 30, structure: 45, specificity: 40 })]

    const kit = buildInterviewEmergencyKit(progress, NOW)

    expect(kit.totalMinutes).toBeLessThanOrEqual(30)
    expect(kit.items.length).toBeLessThanOrEqual(5)
  })

  it('reports ready when today is closed and no urgent risk exists', () => {
    const progress = emptyProgress()
    addQuestion(progress, 9, 'mastered', NOW)
    progress.dailyPlan = [9]
    progress.interviewAttempts[9] = [attempt(9)]

    const kit = buildInterviewEmergencyKit(progress, NOW)

    expect(kit.level).toBe('ready')
    expect(kit.title).toContain('可以轻量热身')
    expect(kit.primaryAction.to).toBe('/practice?queue=9')
  })
})
