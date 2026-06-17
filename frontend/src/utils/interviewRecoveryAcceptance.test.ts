import { describe, expect, it } from 'vitest'
import type {
  InterviewAttempt,
  InterviewCriterionKey,
  InterviewMistakeLedger,
  InterviewMistakeLedgerItem,
  StudyProgress,
} from '../types'
import { buildInterviewRecoveryAcceptance } from './interviewRecoveryAcceptance'

const NOW = '2026-06-17T00:00:00.000Z'

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

function attempt(
  questionId: number,
  scores: Partial<Record<InterviewCriterionKey, number>>,
  createdAt = NOW,
): InterviewAttempt {
  const merged: Record<InterviewCriterionKey, number> = {
    coverage: 82,
    structure: 82,
    specificity: 82,
    risk: 82,
    ...scores,
  }

  return {
    questionId,
    answer: '模拟回答',
    createdAt,
    feedback: {
      score: Math.round(Object.values(merged).reduce((sum, value) => sum + value, 0) / 4),
      level: 'pass',
      criteria: [
        { key: 'coverage', label: '知识覆盖', score: merged.coverage, summary: '覆盖情况' },
        { key: 'structure', label: '表达结构', score: merged.structure, summary: '结构情况' },
        { key: 'specificity', label: '场景细节', score: merged.specificity, summary: '场景情况' },
        { key: 'risk', label: '边界风险', score: merged.risk, summary: '风险情况' },
      ],
      advice: [],
      followUps: [],
    },
  }
}

function mistakeItem(overrides: Partial<InterviewMistakeLedgerItem> = {}): InterviewMistakeLedgerItem {
  return {
    id: 'criterion-specificity',
    type: 'criterion',
    criterionKey: 'specificity',
    label: '场景细节反复失分',
    summary: '2 次回答低于 70 分。',
    averageScore: 42,
    attempts: 2,
    affectedQuestionIds: [1, 2],
    latestQuestionTitle: 'HashMap 为什么线程不安全？',
    priority: 58,
    to: '/practice?queue=1,2',
    actionLabel: '回炉训练',
    ...overrides,
  }
}

function ledger(overrides: Partial<InterviewMistakeLedger> = {}): InterviewMistakeLedger {
  const item = mistakeItem()
  return {
    level: 'risk',
    title: '面试错因本',
    summary: '已定位高频表达问题。',
    totalProblems: 2,
    items: [item],
    primaryAction: {
      label: item.actionLabel,
      description: item.summary,
      to: item.to,
    },
    ...overrides,
  }
}

describe('buildInterviewRecoveryAcceptance', () => {
  it('returns empty when no interview sample exists', () => {
    const report = buildInterviewRecoveryAcceptance(emptyProgress(), ledger({
      level: 'empty',
      items: [],
      totalProblems: 0,
      primaryAction: {
        label: '开始模拟面试',
        description: '建立第一条记录。',
        to: '/practice',
      },
    }))

    expect(report.status).toBe('empty')
    expect(report.primaryAction.to).toBe('/practice')
  })

  it('marks criterion recovery as testing when only part of the queue has a fresh passing attempt', () => {
    const progress = emptyProgress()
    progress.interviewAttempts[1] = [attempt(1, { specificity: 76 })]

    const report = buildInterviewRecoveryAcceptance(progress, ledger())

    expect(report.status).toBe('testing')
    expect(report.passedCount).toBe(1)
    expect(report.totalCount).toBe(2)
    expect(report.pendingQuestionIds).toEqual([2])
  })

  it('passes criterion recovery when every affected question latest score is over the threshold', () => {
    const progress = emptyProgress()
    progress.interviewAttempts[1] = [
      attempt(1, { specificity: 45 }, '2026-06-16T00:00:00.000Z'),
      attempt(1, { specificity: 78 }, NOW),
    ]
    progress.interviewAttempts[2] = [attempt(2, { specificity: 72 }, NOW)]

    const report = buildInterviewRecoveryAcceptance(progress, ledger())

    expect(report.status).toBe('passed')
    expect(report.passedQuestionIds).toEqual([1, 2])
  })

  it('fails criterion recovery when the latest attempt is still below the threshold', () => {
    const progress = emptyProgress()
    progress.interviewAttempts[1] = [attempt(1, { specificity: 65 }, NOW)]
    progress.interviewAttempts[2] = [attempt(2, { specificity: 72 }, NOW)]

    const report = buildInterviewRecoveryAcceptance(progress, ledger())

    expect(report.status).toBe('failed')
    expect(report.failedQuestionIds).toEqual([1])
  })

  it('passes weak unspoken recovery after the user practices aloud with a passing score', () => {
    const weakItem = mistakeItem({
      id: 'weak-unspoken',
      type: 'weak-unspoken',
      criterionKey: undefined,
      label: '薄弱题待开口',
      affectedQuestionIds: [3],
      to: '/practice?queue=3',
    })
    const progress = emptyProgress()
    progress.interviewAttempts[3] = [attempt(3, { coverage: 75, structure: 75, specificity: 75, risk: 75 }, NOW)]

    const report = buildInterviewRecoveryAcceptance(progress, ledger({
      items: [weakItem],
      primaryAction: {
        label: weakItem.actionLabel,
        description: weakItem.summary,
        to: weakItem.to,
      },
    }))

    expect(report.status).toBe('passed')
    expect(report.primaryAction.to).toBe('/practice?queue=3')
  })
})
