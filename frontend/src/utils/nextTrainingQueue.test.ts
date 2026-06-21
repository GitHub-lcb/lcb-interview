import { describe, expect, it } from 'vitest'
import type { InterviewAttempt, StudyProgress, StudyQuestionStatus } from '../types'
import {
  buildNextTrainingQueue,
  buildNextTrainingQueueMarkdown,
} from './nextTrainingQueue'
import { createDefaultProgress } from './studyProgress'

const NOW = '2026-06-18T09:00:00.000Z'

function progressWithSnapshots(): StudyProgress {
  return {
    ...createDefaultProgress(NOW),
    targetRole: 'Java 后端',
    dailyPlan: [1, 2, 4],
    questionSnapshots: {
      1: snapshot(1, 'HashMap 为什么线程不安全', 'Java 集合'),
      2: snapshot(2, 'Redis 缓存穿透怎么处理', 'Redis'),
      3: snapshot(3, 'MySQL 索引失效场景', 'MySQL'),
      4: snapshot(4, 'Spring 事务传播机制', 'Spring'),
      5: snapshot(5, 'JVM GC Roots 有哪些', 'JVM'),
      6: snapshot(6, 'Kafka 如何保证顺序消费', 'Kafka'),
    },
    questionStates: {
      1: state('weak', true, NOW, 2),
      2: state('learning', true, '2026-06-15T09:00:00.000Z', 1),
      3: state('weak', false, '2026-06-17T09:00:00.000Z', 1),
      4: state('learning', true, NOW, 2),
      5: state('mastered', false, '2026-06-01T09:00:00.000Z', 4),
      6: state('new', false, undefined, 0),
    },
    interviewAttempts: {},
  }
}

function snapshot(id: number, title: string, categoryName: string) {
  return {
    id,
    title,
    difficulty: 'MEDIUM',
    categoryName,
    tags: [categoryName],
    viewCount: 100 + id,
  }
}

function state(
  status: StudyQuestionStatus,
  addedToPlan: boolean,
  lastReviewedAt: string | undefined,
  reviewCount: number,
) {
  return {
    status,
    addedToPlan,
    lastReviewedAt,
    reviewCount,
  }
}

function interviewAttempt(
  questionId: number,
  score: number,
  createdAt = NOW,
  lowCriterionScore = score,
): InterviewAttempt {
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
        { key: 'specificity', label: '场景细节', score: lowCriterionScore, summary: '缺少项目细节' },
        { key: 'risk', label: '边界风险', score, summary: '风险情况' },
      ],
      advice: [],
      followUps: [],
    },
  }
}

describe('buildNextTrainingQueue', () => {
  it('prioritizes today score impacts and keeps each question once', () => {
    const progress = progressWithSnapshots()
    progress.interviewAttempts[1] = [interviewAttempt(1, 55)]

    const queue = buildNextTrainingQueue(progress, NOW)

    expect(queue.title).toBe('下一轮训练队列')
    expect(queue.items[0]).toMatchObject({
      questionId: 1,
      title: 'HashMap 为什么线程不安全',
      source: 'score-impact',
      sourceLabel: '评分影响',
      actionLabel: '重答补强',
      to: '/practice?queue=1&from=next-training',
    })
    expect(queue.items.filter(item => item.questionId === 1)).toHaveLength(1)
    expect(queue.primaryAction).toMatchObject({
      label: '开始下一轮训练',
      to: expect.stringContaining('/practice?queue=1'),
    })
  })

  it('merges review debt, interview mistakes, weak questions, learning questions and plan items', () => {
    const progress = progressWithSnapshots()
    progress.interviewAttempts[3] = [
      interviewAttempt(3, 78, '2026-06-17T08:00:00.000Z', 42),
    ]

    const queue = buildNextTrainingQueue(progress, NOW, 8)
    const sources = queue.items.map(item => item.source)

    expect(queue.totalCount).toBe(queue.items.length)
    expect(sources).toContain('review-debt')
    expect(sources).toContain('mistake')
    expect(sources).toContain('learning')
    expect(queue.items.some(item => item.questionId === 2 && item.source === 'review-debt')).toBe(true)
    expect(queue.items.some(item => item.questionId === 3 && item.source === 'mistake')).toBe(true)
    expect(queue.metrics.map(metric => metric.key)).toEqual(['total', 'urgent', 'weak', 'interview'])
    expect(queue.urgentCount).toBeGreaterThan(0)
    expect(queue.weakCount).toBeGreaterThan(0)
    expect(queue.interviewRepairCount).toBeGreaterThan(0)
    expect(queue.primaryAction.to).toMatch(/^\/practice\?queue=[0-9,]+&from=next-training$/)
  })

  it('labels repeatedly encountered new questions as active recall training', () => {
    const progress: StudyProgress = {
      ...createDefaultProgress(NOW),
      questionSnapshots: {
        7: snapshot(7, 'ThreadLocal 内存泄漏怎么处理', 'Java 并发'),
      },
      questionStates: {
        7: {
          status: 'new',
          addedToPlan: false,
          reviewCount: 0,
          encounterCount: 2,
          lastEncounteredAt: '2026-06-17T20:00:00.000Z',
        },
      },
    }

    const queue = buildNextTrainingQueue(progress, NOW)

    expect(queue.items[0]).toMatchObject({
      questionId: 7,
      source: 'review-debt',
      sourceLabel: '主动回忆',
      actionLabel: '做一次主动回忆',
      reason: '多次遇见但还没完成复习，先安排一次主动回忆。',
      to: '/practice?queue=7&from=review-due',
    })
    expect(queue.primaryAction.to).toBe('/practice?queue=7&from=review-due')
  })

  it('keeps generic next-training context for weak and learning repair queues', () => {
    const progress: StudyProgress = {
      ...createDefaultProgress(NOW),
      questionSnapshots: {
        11: snapshot(11, 'Redis 热 key 怎么处理', 'Redis'),
        12: snapshot(12, 'Spring 循环依赖怎么解决', 'Spring'),
      },
      questionStates: {
        11: state('weak', false, NOW, 1),
        12: state('learning', false, NOW, 2),
      },
    }

    const queue = buildNextTrainingQueue(progress, NOW)

    expect(queue.items.map(item => item.to)).toEqual([
      '/practice?queue=11&from=next-training',
      '/practice?queue=12&from=next-training',
    ])
    expect(queue.primaryAction.to).toBe('/practice?queue=11,12&from=next-training')
  })

  it('falls back to a mock interview entry when no queue evidence exists', () => {
    const queue = buildNextTrainingQueue(createDefaultProgress(NOW), NOW)

    expect(queue.items).toEqual([])
    expect(queue.totalCount).toBe(0)
    expect(queue.title).toBe('下一轮队列待生成')
    expect(queue.primaryAction).toMatchObject({
      label: '先做一次模拟面试',
      to: '/practice',
    })
  })

  it('drops invalid daily plan ids before building plan queue items', () => {
    const progress = {
      ...createDefaultProgress(NOW),
      dailyPlan: [10, 0, -1, 2.5, 10, Number.NaN, Number.POSITIVE_INFINITY],
    }

    const queue = buildNextTrainingQueue(progress, NOW)
    const markdown = buildNextTrainingQueueMarkdown(progress, NOW)

    expect(queue.items.map(item => item.questionId)).toEqual([10])
    expect(queue.items[0]).toMatchObject({
      questionId: 10,
      source: 'plan',
      to: '/practice?queue=10&from=daily-plan',
    })
    expect(queue.primaryAction.to).toBe('/practice?queue=10&from=daily-plan')
    expect(markdown).toContain('题目 #10')
    expect(markdown).not.toContain('题目 #2.5')
    expect(markdown).not.toContain('题目 #NaN')
  })

  it('routes mastered score impacts to answer material sediment instead of practice', () => {
    const progress = {
      ...createDefaultProgress(NOW),
      targetRole: 'Java 后端',
      dailyPlan: [5],
      questionSnapshots: {
        5: snapshot(5, 'JVM GC Roots 有哪些', 'JVM'),
      },
      questionStates: {
        5: state('mastered', true, NOW, 4),
      },
      interviewAttempts: {
        5: [interviewAttempt(5, 88)],
      },
    }

    const queue = buildNextTrainingQueue(progress, NOW)

    expect(queue.items).toHaveLength(1)
    expect(queue.items[0]).toMatchObject({
      questionId: 5,
      source: 'score-impact',
      status: 'mastered',
      actionLabel: '沉淀题目',
      to: '/question/5',
    })
    expect(queue.urgentCount).toBe(0)
    expect(queue.interviewRepairCount).toBe(0)
    expect(queue.primaryAction).toMatchObject({
      label: '沉淀高分题目',
      to: '/question/5',
    })
  })

  it('exports the queue as portable markdown', () => {
    const progress = progressWithSnapshots()
    progress.interviewAttempts[1] = [interviewAttempt(1, 55)]

    const markdown = buildNextTrainingQueueMarkdown(progress, NOW)

    expect(markdown).toContain('# Java 后端 下一轮训练队列')
    expect(markdown).toContain('## 训练题单')
    expect(markdown).toContain('HashMap 为什么线程不安全')
    expect(markdown).toContain('行动：重答补强')
    expect(markdown).toContain('入口：/practice?queue=1')
    expect(markdown).not.toContain('undefined')
  })
})
