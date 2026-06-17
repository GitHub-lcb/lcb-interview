import { describe, expect, it } from 'vitest'
import type { InterviewMistakeLedger, InterviewMistakeLedgerItem } from '../types'
import { buildInterviewRecoveryPlan } from './interviewRecoveryPlan'

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

describe('buildInterviewRecoveryPlan', () => {
  it('guides users to create the first interview record when the ledger is empty', () => {
    const plan = buildInterviewRecoveryPlan(ledger({
      level: 'empty',
      totalProblems: 0,
      items: [],
      primaryAction: {
        label: '开始模拟面试',
        description: '建立第一条记录。',
        to: '/practice',
      },
    }))

    expect(plan.mode).toBe('empty')
    expect(plan.steps).toHaveLength(1)
    expect(plan.primaryAction.to).toBe('/practice')
  })

  it('turns the top criterion mistake into a three-step repair plan', () => {
    const plan = buildInterviewRecoveryPlan(ledger())

    expect(plan.mode).toBe('repair')
    expect(plan.steps).toHaveLength(3)
    expect(plan.steps[0].to).toBe('/practice?queue=1,2')
    expect(plan.steps[0].questionIds).toEqual([1, 2])
    expect(plan.totalMinutes).toBe(37)
  })

  it('uses opening-practice wording for weak questions that have not been spoken', () => {
    const weakItem = mistakeItem({
      id: 'weak-unspoken',
      type: 'weak-unspoken',
      criterionKey: undefined,
      label: '薄弱题待开口',
      affectedQuestionIds: [3],
      to: '/practice?queue=3',
    })

    const plan = buildInterviewRecoveryPlan(ledger({
      items: [weakItem],
      primaryAction: {
        label: weakItem.actionLabel,
        description: weakItem.summary,
        to: weakItem.to,
      },
    }))

    expect(plan.steps[0].title).toContain('开口')
    expect(plan.primaryAction.to).toBe('/practice?queue=3')
  })

  it('creates an advanced pressure plan when the ledger is stable', () => {
    const advancedItem = mistakeItem({
      id: 'advanced-pressure',
      type: 'advanced',
      criterionKey: undefined,
      label: '进入高压追问',
      averageScore: 84,
      affectedQuestionIds: [1],
      to: '/practice?queue=1',
      actionLabel: '继续加压',
    })

    const plan = buildInterviewRecoveryPlan(ledger({
      level: 'stable',
      totalProblems: 0,
      items: [advancedItem],
      primaryAction: {
        label: advancedItem.actionLabel,
        description: advancedItem.summary,
        to: advancedItem.to,
      },
    }))

    expect(plan.mode).toBe('advanced')
    expect(plan.title).toContain('加压')
    expect(plan.steps[0].title).toBe('连续追问加压')
    expect(plan.totalMinutes).toBe(42)
  })

  it('keeps the primary action aligned with the first recovery step', () => {
    const plan = buildInterviewRecoveryPlan(ledger())

    expect(plan.primaryAction.label).toBe(plan.steps[0].actionLabel)
    expect(plan.primaryAction.to).toBe(plan.steps[0].to)
  })
})
