import { describe, expect, it } from 'vitest'
import type { InterviewMistakeLedger, InterviewMistakeLedgerItem } from '../types'
import { buildInterviewRecoveryPlan } from './interviewRecoveryPlan'
import { buildInterviewRecoveryMarkdown } from './interviewRecoveryReport'

const NOW = '2026-06-17T00:00:00.000Z'

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

function riskLedger(): InterviewMistakeLedger {
  const item = mistakeItem()
  return {
    level: 'risk',
    title: '面试错因本',
    summary: '已定位 1 类高频表达问题。',
    totalProblems: 2,
    items: [item],
    primaryAction: {
      label: item.actionLabel,
      description: item.summary,
      to: item.to,
    },
  }
}

function emptyLedger(): InterviewMistakeLedger {
  return {
    level: 'empty',
    title: '面试错因本待建立',
    summary: '先完成一次免费模拟面试。',
    totalProblems: 0,
    items: [],
    primaryAction: {
      label: '开始模拟面试',
      description: '建立第一条记录。',
      to: '/practice',
    },
  }
}

describe('buildInterviewRecoveryMarkdown', () => {
  it('exports a focused repair plan with mistakes and recovery steps', () => {
    const ledger = riskLedger()
    const plan = buildInterviewRecoveryPlan(ledger)

    const markdown = buildInterviewRecoveryMarkdown(ledger, plan, 'Java 后端', NOW)

    expect(markdown).toContain('# Java 后端 面试错因修复计划')
    expect(markdown).toContain('生成日期：2026-06-17')
    expect(markdown).toContain('计划总耗时：37 分钟')
    expect(markdown).toContain('## 错因概览')
    expect(markdown).toContain('场景细节反复失分')
    expect(markdown).toContain('## 修复步骤')
    expect(markdown).toContain('1. 场景细节反复失分回炉训练')
    expect(markdown).toContain('/practice?queue=1,2')
    expect(markdown).not.toContain('undefined')
  })

  it('keeps empty recovery exports actionable', () => {
    const ledger = emptyLedger()
    const plan = buildInterviewRecoveryPlan(ledger)

    const markdown = buildInterviewRecoveryMarkdown(ledger, plan, 'Java 后端', NOW)

    expect(markdown).toContain('先建立面试样本')
    expect(markdown).toContain('完成一次模拟面试')
    expect(markdown).toContain('/practice')
    expect(markdown).not.toContain('undefined')
  })
})
