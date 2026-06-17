import { describe, expect, it } from 'vitest'
import type { InterviewAttempt, InterviewCriterionKey, InterviewFeedback, PracticeQueueItem, StudyProgress } from '../types'
import {
  buildPracticeSessionRepairDraft,
  buildPracticeSessionReport,
  buildPracticeSessionReportMarkdown,
} from './practiceSessionReport'

const NOW = '2026-06-17T08:00:00.000Z'

function question(id: number, overrides: Partial<PracticeQueueItem> = {}): PracticeQueueItem {
  return {
    id,
    title: `Java 面试题 ${id}`,
    difficulty: 'MEDIUM',
    categoryName: 'Java 基础',
    tags: ['Java'],
    viewCount: 100 + id,
    status: 'learning',
    source: 'plan',
    ...overrides,
  }
}

function progress(overrides: Partial<StudyProgress> = {}): StudyProgress {
  return {
    targetRole: 'Java 后端',
    sprintDays: 21,
    questionStates: {},
    questionSnapshots: {},
    interviewAttempts: {},
    dailyPlan: [],
    updatedAt: NOW,
    ...overrides,
  }
}

function attempt(
  questionId: number,
  score: number,
  criterionScores: Partial<Record<InterviewCriterionKey, number>> = {},
  createdAt = NOW,
): InterviewAttempt {
  return {
    questionId,
    answer: '先给结论，再说明机制、场景、风险和落地方案。',
    feedback: feedback(score, criterionScores),
    createdAt,
  }
}

function feedback(
  score: number,
  criterionScores: Partial<Record<InterviewCriterionKey, number>> = {},
): InterviewFeedback {
  return {
    score,
    level: score >= 80 ? 'strong' : score >= 60 ? 'pass' : 'needs-work',
    criteria: [
      { key: 'coverage', label: '覆盖度', score: criterionScores.coverage ?? score, summary: '覆盖核心概念' },
      { key: 'structure', label: '结构化', score: criterionScores.structure ?? score, summary: '结构表达一般' },
      { key: 'specificity', label: '场景细节', score: criterionScores.specificity ?? score, summary: '场景细节不足' },
      { key: 'risk', label: '风险意识', score: criterionScores.risk ?? score, summary: '风险意识一般' },
    ],
    advice: [],
    followUps: [],
  }
}

describe('buildPracticeSessionReport', () => {
  it('returns an empty report when the queue has no questions', () => {
    const report = buildPracticeSessionReport([], progress())

    expect(report.level).toBe('empty')
    expect(report.answeredCount).toBe(0)
    expect(report.totalCount).toBe(0)
    expect(report.primaryAction).toMatchObject({ kind: 'start', to: '/practice' })
    expect(report.metrics[0]).toMatchObject({ key: 'answered', value: '0 / 0' })
  })

  it('points to unanswered questions while the session is still in progress', () => {
    const report = buildPracticeSessionReport(
      [question(1), question(2), question(3)],
      progress({
        interviewAttempts: {
          1: [attempt(1, 72)],
        },
      }),
    )

    expect(report.level).toBe('in-progress')
    expect(report.answeredCount).toBe(1)
    expect(report.totalCount).toBe(3)
    expect(report.averageScore).toBe(72)
    expect(report.primaryAction).toMatchObject({ kind: 'continue', to: '/practice?queue=2,3' })
    expect(report.metrics[0]).toMatchObject({ key: 'answered', value: '1 / 3' })
    expect(report.queueProfile).toMatchObject({
      sourceSummary: '今日计划 3 道',
      nextQuestionTitle: 'Java 面试题 2',
      queuePath: '/practice?queue=1,2,3',
    })
    expect(report.queueProfile.unansweredQuestionIds).toEqual([2, 3])
  })

  it('prioritizes low score and weak questions for repair', () => {
    const report = buildPracticeSessionReport(
      [question(1), question(2), question(3, { status: 'weak' })],
      progress({
        questionStates: {
          3: { status: 'weak', addedToPlan: true, reviewCount: 2 },
        },
        interviewAttempts: {
          1: [attempt(1, 62, { structure: 60 })],
          2: [attempt(2, 55, { structure: 45 })],
        },
      }),
    )

    expect(report.level).toBe('risk')
    expect(report.averageScore).toBe(59)
    expect(report.passCount).toBe(0)
    expect(report.weakQuestionIds).toEqual([1, 2, 3])
    expect(report.primaryAction).toMatchObject({ kind: 'repair', to: '/practice?queue=1,2,3' })
    expect(report.metrics.find(metric => metric.key === 'weakest')?.value).toContain('结构化')
    expect(report.repairActions[0]).toMatchObject({
      questionId: 2,
      title: 'Java 面试题 2',
      criterionLabel: '结构化',
      to: '/practice?question=2',
    })
    expect(report.repairActions[0].reason).toContain('55 分')
    expect(report.repairActions[0].action).toContain('结构')
    expect(report.repairActions.some(action => action.questionId === 3)).toBe(true)
  })

  it('marks the session as passed when all answered questions are strong', () => {
    const report = buildPracticeSessionReport(
      [question(1), question(2)],
      progress({
        interviewAttempts: {
          1: [attempt(1, 88)],
          2: [attempt(2, 92)],
        },
      }),
    )

    expect(report.level).toBe('passed')
    expect(report.answeredCount).toBe(2)
    expect(report.averageScore).toBe(90)
    expect(report.passCount).toBe(2)
    expect(report.weakQuestionIds).toEqual([])
    expect(report.primaryAction).toMatchObject({ kind: 'review', to: '/study' })
  })

  it('exports a portable markdown report for the current practice session', () => {
    const markdown = buildPracticeSessionReportMarkdown(
      [question(1), question(2), question(3, { status: 'weak' })],
      progress({
        questionStates: {
          3: { status: 'weak', addedToPlan: true, reviewCount: 2 },
        },
        interviewAttempts: {
          1: [attempt(1, 62, { structure: 60 })],
          2: [attempt(2, 55, { structure: 45 })],
        },
      }),
      NOW,
    )

    expect(markdown).toContain('# Java 后端 本轮模拟面试战报')
    expect(markdown).toContain('生成时间：2026-06-17')
    expect(markdown).toContain('## 本轮摘要')
    expect(markdown).toContain('状态：本轮优先补弱')
    expect(markdown).toContain('低分/薄弱题：1, 2, 3')
    expect(markdown).toContain('## 核心指标')
    expect(markdown).toContain('最弱项：结构化')
    expect(markdown).toContain('## 队列画像')
    expect(markdown).toContain('来源构成：今日计划')
    expect(markdown).toContain('下一题：Java 面试题 3')
    expect(markdown).toContain('队列入口：/practice?queue=1,2,3')
    expect(markdown).toContain('## 补弱动作清单')
    expect(markdown).toContain('Java 面试题 2')
    expect(markdown).toContain('结构化')
    expect(markdown).toContain('/practice?question=2')
    expect(markdown).toContain('重答模板')
    expect(markdown).toContain('补弱题目：Java 面试题 2')
    expect(markdown).toContain('结论：')
    expect(markdown).toContain('原因：')
    expect(markdown).toContain('场景：')
    expect(markdown).toContain('边界：')
    expect(markdown).toContain('## 题目队列')
    expect(markdown).toContain('Java 面试题 2')
    expect(markdown).toContain('最近评分 55 分')
    expect(markdown).toContain('## 下一步行动')
    expect(markdown).toContain('/practice?queue=1,2,3')
  })

  it('keeps empty session markdown actionable', () => {
    const markdown = buildPracticeSessionReportMarkdown([], progress(), NOW)

    expect(markdown).toContain('先选择一组面试题')
    expect(markdown).toContain('当前还没有练习队列')
    expect(markdown).toContain('暂无队列画像')
    expect(markdown).toContain('暂无题目')
    expect(markdown).not.toContain('undefined')
  })
})

describe('buildPracticeSessionRepairDraft', () => {
  it('builds a structured retry draft from the weakest criterion', () => {
    const report = buildPracticeSessionReport(
      [question(1)],
      progress({
        interviewAttempts: {
          1: [attempt(1, 56, { structure: 38 })],
        },
      }),
    )

    const draft = buildPracticeSessionRepairDraft(report.repairActions[0])

    expect(draft).toContain('补弱题目：Java 面试题 1')
    expect(draft).toContain('补弱维度：结构化')
    expect(draft).toContain('本次目标：先按')
    expect(draft).toContain('我的重答：')
    expect(draft).toContain('结论：')
    expect(draft).toContain('原因：')
    expect(draft).toContain('场景：')
    expect(draft).toContain('边界：')
  })

  it('keeps an unscored weak question repair draft actionable', () => {
    const report = buildPracticeSessionReport(
      [question(3, { status: 'weak' })],
      progress({
        questionStates: {
          3: { status: 'weak', addedToPlan: true, reviewCount: 2 },
        },
      }),
    )

    const draft = buildPracticeSessionRepairDraft(report.repairActions[0])

    expect(draft).toContain('补弱题目：Java 面试题 3')
    expect(draft).toContain('补弱维度：未评分')
    expect(draft).toContain('先完成一次模拟评分')
    expect(draft).toContain('我的重答：')
    expect(draft).not.toContain('undefined')
  })
})
