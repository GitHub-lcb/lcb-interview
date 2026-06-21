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

function interviewAttempt(questionId: number, createdAt = NOW, score = 82): InterviewAttempt {
  return {
    questionId,
    answer: '模拟回答',
    createdAt,
    feedback: {
      score,
      level: score >= 80 ? 'strong' : score >= 70 ? 'pass' : 'needs-work',
      criteria: [
        { key: 'coverage', label: '知识覆盖', score, summary: '覆盖情况' },
        { key: 'structure', label: '表达结构', score, summary: '结构情况' },
        { key: 'specificity', label: '场景细节', score, summary: '场景情况' },
        { key: 'risk', label: '边界风险', score, summary: '风险情况' },
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
    expect(completion.primaryAction.to).toBe('/practice?queue=1&from=review-due')
    expect(completion.todos[0].to).toBe('/practice?queue=1&from=review-due')
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
    expect(completion.primaryAction.to).toBe('/practice?queue=1&from=daily-plan')
    expect(completion.todos[0].to).toBe('/practice?queue=1&from=daily-plan')
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
    expect(completion.primaryAction.to).toBe('/practice?queue=1,2&from=daily-plan')
    expect(completion.todos[0].to).toBe('/practice?queue=1,2&from=daily-plan')
    expect(completion.primaryAction.label).toBe('继续今日队列')
  })

  it('asks for one mock interview after all planned questions are mastered', () => {
    let progress = progressWithPlan([1, 2])
    progress = markQuestion(progress, 1, 'mastered', NOW, 3)
    progress = markQuestion(progress, 2, 'mastered', NOW, 3)

    const completion = buildDailyPlanCompletion(progress, NOW)

    expect(completion.level).toBe('ready')
    expect(completion.completionRate).toBe(100)
    expect(completion.primaryAction.to).toBe('/practice?queue=1,2&from=daily-plan')
    expect(completion.todos[0].to).toBe('/practice?queue=1,2&from=daily-plan')
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

  it('explains today score impacts for planned questions only', () => {
    let progress = progressWithPlan([1, 2])
    progress = markQuestion(progress, 1, 'weak', NOW, 2)
    progress = markQuestion(progress, 2, 'mastered', NOW, 4)
    progress = {
      ...progress,
      questionSnapshots: {
        1: {
          id: 1,
          title: 'HashMap 为什么线程不安全',
          difficulty: '中等',
          categoryName: 'Java 集合',
          tags: ['Java'],
          viewCount: 120,
        },
        2: {
          id: 2,
          title: 'Redis 缓存穿透怎么处理',
          difficulty: '中等',
          categoryName: 'Redis',
          tags: ['缓存'],
          viewCount: 96,
        },
      },
      interviewAttempts: {
        1: [
          interviewAttempt(1, '2026-06-16T08:00:00.000Z', 86),
          interviewAttempt(1, '2026-06-17T08:00:00.000Z', 55),
        ],
        2: [interviewAttempt(2, '2026-06-17T08:30:00.000Z', 86)],
        3: [interviewAttempt(3, '2026-06-17T08:45:00.000Z', 88)],
      },
    }

    const completion = buildDailyPlanCompletion(progress, NOW)

    expect(completion.statusImpacts.map(impact => impact.questionId)).toEqual([2, 1])
    expect(completion.statusImpacts[0]).toMatchObject({
      title: 'Redis 缓存穿透怎么处理',
      score: 86,
      status: 'mastered',
      message: '已同步为已掌握，计入今日完成。',
      actionLabel: '沉淀题目',
      to: '/question/2',
    })
    expect(completion.statusImpacts[1]).toMatchObject({
      title: 'HashMap 为什么线程不安全',
      score: 55,
      status: 'weak',
      message: '已自动标记薄弱，并留在今日计划继续补强。',
      actionLabel: '重答补强',
      to: '/practice?queue=1&from=daily-plan',
    })
  })

  it('keeps only the latest score impact for the same planned question today', () => {
    let progress = progressWithPlan([1])
    progress = markQuestion(progress, 1, 'mastered', NOW, 4)
    progress = {
      ...progress,
      interviewAttempts: {
        1: [
          interviewAttempt(1, '2026-06-17T07:30:00.000Z', 55),
          interviewAttempt(1, '2026-06-17T08:30:00.000Z', 86),
        ],
      },
    }

    const completion = buildDailyPlanCompletion(progress, NOW)

    expect(completion.statusImpacts).toHaveLength(1)
    expect(completion.statusImpacts[0]).toMatchObject({
      questionId: 1,
      score: 86,
      status: 'mastered',
      actionLabel: '沉淀题目',
      to: '/question/1',
    })
  })

  it('exports score impacts in daily completion markdown', () => {
    let progress = progressWithPlan([1])
    progress = {
      ...progress,
      targetRole: 'Java 后端',
      questionSnapshots: {
        1: {
          id: 1,
          title: 'HashMap 为什么线程不安全',
          difficulty: '中等',
          categoryName: 'Java 集合',
          tags: ['Java'],
          viewCount: 120,
        },
      },
      interviewAttempts: {
        1: [interviewAttempt(1, '2026-06-17T08:30:00.000Z', 86)],
      },
    }

    const markdown = buildDailyPlanCompletionMarkdown(progress, NOW)

    expect(markdown).toContain('## 评分影响')
    expect(markdown).toContain('HashMap 为什么线程不安全：86 分，已同步为已掌握，计入今日完成。')
    expect(markdown).toContain('行动：沉淀题目，入口：/question/1')
    expect(markdown).not.toContain('undefined')
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
    expect(markdown).toContain('## 评分影响')
    expect(markdown).toContain('今日还没有计划内模拟面试评分')
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
