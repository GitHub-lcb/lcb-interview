import { describe, expect, it } from 'vitest'
import type { InterviewAttempt, StudyProgress, StudyQuestionStatus } from '../types'
import { createDefaultProgress } from './studyProgress'
import { buildDailyPlanCompletion, buildDailyPlanCompletionMarkdown } from './dailyPlanCompletion'

const NOW = '2026-06-17T09:00:00.000Z'

function progressWithPlan(questionIds: number[]): StudyProgress {
  return {
    ...createDefaultProgress(NOW),
    dailyPlan: questionIds,
  }
}

function markQuestion(
  progress: StudyProgress,
  id: number,
  status: StudyQuestionStatus,
  lastReviewedAt = NOW,
  reviewCount = 1,
): StudyProgress {
  return {
    ...progress,
    questionStates: {
      ...progress.questionStates,
      [id]: {
        status,
        addedToPlan: progress.dailyPlan.includes(id),
        lastReviewedAt,
        reviewCount,
      },
    },
  }
}

function interviewAttempt(questionId: number, createdAt = NOW): InterviewAttempt {
  return {
    questionId,
    answer: '模拟回答',
    createdAt,
    feedback: {
      score: 82,
      level: 'strong',
      criteria: [
        { key: 'coverage', label: '知识覆盖', score: 82, summary: '覆盖情况' },
        { key: 'structure', label: '表达结构', score: 82, summary: '结构情况' },
        { key: 'specificity', label: '场景细节', score: 82, summary: '场景情况' },
        { key: 'risk', label: '边界风险', score: 82, summary: '风险情况' },
      ],
      advice: [],
      followUps: [],
    },
  }
}

describe('buildDailyPlanCompletion', () => {
  it('guides users to generate a plan when today plan is empty', () => {
    const completion = buildDailyPlanCompletion(createDefaultProgress(NOW), NOW)

    expect(completion.level).toBe('empty')
    expect(completion.title).toBe('今日计划待验收')
    expect(completion.completionRate).toBe(0)
    expect(completion.primaryAction.label).toBe('生成今日计划')
  })

  it('prioritizes review debts inside today plan', () => {
    let progress = progressWithPlan([1, 2])
    progress = markQuestion(progress, 1, 'learning', '2026-06-15T09:00:00.000Z', 1)
    progress = markQuestion(progress, 2, 'mastered', NOW, 3)

    const completion = buildDailyPlanCompletion(progress, NOW)

    expect(completion.level).toBe('risk')
    expect(completion.reviewDebtCount).toBe(1)
    expect(completion.primaryAction.label).toBe('先清复习债')
    expect(completion.todos[0].title).toBe('1 道计划题已到期或逾期')
  })

  it('surfaces weak planned questions before continuing normal training', () => {
    let progress = progressWithPlan([1, 2])
    progress = markQuestion(progress, 1, 'weak', NOW, 1)
    progress = markQuestion(progress, 2, 'mastered', NOW, 3)

    const completion = buildDailyPlanCompletion(progress, NOW)

    expect(completion.level).toBe('risk')
    expect(completion.weakCount).toBe(1)
    expect(completion.primaryAction.label).toBe('修复薄弱题')
    expect(completion.todos[0].tone).toBe('warning')
  })

  it('tracks active progress when some planned questions are not mastered yet', () => {
    let progress = progressWithPlan([1, 2])
    progress = markQuestion(progress, 1, 'mastered', NOW, 3)
    progress = markQuestion(progress, 2, 'learning', NOW, 3)

    const completion = buildDailyPlanCompletion(progress, NOW)

    expect(completion.level).toBe('active')
    expect(completion.completionRate).toBe(50)
    expect(completion.remainingCount).toBe(1)
    expect(completion.primaryAction.label).toBe('继续今日队列')
  })

  it('asks for one mock interview after all planned questions are mastered', () => {
    let progress = progressWithPlan([1, 2])
    progress = markQuestion(progress, 1, 'mastered', NOW, 3)
    progress = markQuestion(progress, 2, 'mastered', NOW, 3)

    const completion = buildDailyPlanCompletion(progress, NOW)

    expect(completion.level).toBe('ready')
    expect(completion.completionRate).toBe(100)
    expect(completion.primaryAction.label).toBe('补一次模拟面试')
  })

  it('marks the day as excellent when plan is mastered and interview sample exists today', () => {
    let progress = progressWithPlan([1, 2])
    progress = markQuestion(progress, 1, 'mastered', NOW, 3)
    progress = markQuestion(progress, 2, 'mastered', NOW, 3)
    progress = {
      ...progress,
      interviewAttempts: {
        1: [interviewAttempt(1)],
        2: [interviewAttempt(2, '2026-06-16T09:00:00.000Z')],
      },
    }

    const completion = buildDailyPlanCompletion(progress, NOW)

    expect(completion.level).toBe('excellent')
    expect(completion.interviewTodayCount).toBe(1)
    expect(completion.primaryAction.label).toBe('查看冲刺报告')
  })

  it('exports risky daily completion as portable markdown', () => {
    let progress = progressWithPlan([1, 2])
    progress = {
      ...progress,
      targetRole: 'Java 后端',
    }
    progress = markQuestion(progress, 1, 'learning', '2026-06-15T09:00:00.000Z', 1)
    progress = markQuestion(progress, 2, 'weak', NOW, 1)

    const markdown = buildDailyPlanCompletionMarkdown(progress, NOW)

    expect(markdown).toContain('# Java 后端 今日闭环验收')
    expect(markdown).toContain('生成时间：2026-06-17')
    expect(markdown).toContain('## 验收概览')
    expect(markdown).toContain('今日闭环还有风险')
    expect(markdown).toContain('## 指标')
    expect(markdown).toContain('## 待办验收')
    expect(markdown).toContain('## 主行动')
    expect(markdown).toContain('入口：/practice?queue=1')
    expect(markdown).not.toContain('undefined')
  })

  it('keeps empty daily completion export actionable', () => {
    const markdown = buildDailyPlanCompletionMarkdown(createDefaultProgress(NOW), NOW)

    expect(markdown).toContain('今日计划待验收')
    expect(markdown).toContain('今日计划还没生成')
    expect(markdown).not.toContain('undefined')
  })
})
