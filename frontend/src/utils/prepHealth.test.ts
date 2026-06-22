import { describe, expect, it } from 'vitest'
import type { InterviewAttempt, StudyProgress } from '../types'
import type { PrepRoute } from '../data/freeSuperiority'
import { buildPrepHealthMarkdown, buildPrepHealthReport } from './prepHealth'

const NOW = '2026-06-17T00:00:00.000Z'

function emptyProgress(): StudyProgress {
  return {
    targetRole: 'Java 后端工程师',
    sprintDays: 14,
    questionStates: {},
    questionSnapshots: {},
    interviewAttempts: {},
    dailyPlan: [],
    updatedAt: NOW,
  }
}

const javaRoute: PrepRoute = {
  id: 'java-backend',
  title: 'Java 后端冲刺路线',
  role: 'Java 后端',
  duration: '21 天',
  summary: '按后端高频题推进。',
  stages: ['并发', '数据库'],
  categories: ['Java 并发', 'MySQL'],
  actions: [],
}

function addQuestion(
  progress: StudyProgress,
  id: number,
  status: 'new' | 'learning' | 'mastered' | 'weak',
  categoryName = 'Java 并发',
  lastReviewedAt = '2026-06-16T00:00:00.000Z',
) {
  progress.questionStates[id] = {
    status,
    addedToPlan: true,
    lastReviewedAt,
    reviewCount: status === 'new' ? 0 : 1,
  }
  progress.questionSnapshots[id] = {
    id,
    title: `题目 ${id}`,
    difficulty: 'MEDIUM',
    categoryName,
    tags: [categoryName],
    viewCount: 100 + id,
  }
}

function interviewAttempt(questionId: number, score: number, createdAt: string): InterviewAttempt {
  return {
    questionId,
    answer: '围绕场景、原理、风险和落地方案作答。',
    createdAt,
    feedback: {
      score,
      level: score >= 80 ? 'strong' : 'needs-work',
      criteria: [
        { key: 'coverage', label: '覆盖度', score, summary: '覆盖核心点' },
        { key: 'structure', label: '结构化', score, summary: '结构表达' },
        { key: 'specificity', label: '细节', score, summary: '细节说明' },
        { key: 'risk', label: '风险意识', score, summary: '风险补充' },
      ],
      advice: [],
      followUps: [],
    },
  }
}

describe('buildPrepHealthReport', () => {
  it('guides new users to establish a local learning trail', () => {
    const report = buildPrepHealthReport([javaRoute], emptyProgress(), NOW)

    expect(report.level).toBe('empty')
    expect(report.score).toBeLessThan(50)
    expect(report.primaryAction.to).toBe('/study')
    expect(report.dimensions.map(item => item.key)).toEqual(['review', 'ability', 'interview', 'pace'])
  })

  it('treats overdue weak review as the highest risk', () => {
    const progress = emptyProgress()
    addQuestion(progress, 1, 'weak', 'Java 并发', '2026-06-13T00:00:00.000Z')
    addQuestion(progress, 2, 'mastered', 'MySQL', '2026-06-16T00:00:00.000Z')
    progress.dailyPlan = [1, 2]

    const report = buildPrepHealthReport([javaRoute], progress, NOW)

    expect(report.primaryDimension.key).toBe('review')
    expect(report.primaryAction.to).toBe('/study')
    expect(report.dimensions.find(item => item.key === 'review')?.status).toBe('danger')
  })

  it('surfaces ability coverage when a route has weak and learning questions', () => {
    const progress = emptyProgress()
    addQuestion(progress, 1, 'weak', 'Java 并发', NOW)
    addQuestion(progress, 2, 'learning', 'Java 并发', NOW)
    addQuestion(progress, 3, 'mastered', 'Java 并发', NOW)
    progress.dailyPlan = [1]

    const report = buildPrepHealthReport([javaRoute], progress, NOW)
    const ability = report.dimensions.find(item => item.key === 'ability')

    expect(ability?.score).toBeLessThan(60)
    expect(ability?.detail).toContain('Java 后端冲刺路线')
    expect(report.primaryAction.to).toBe('/practice?queue=1,2&from=ability-gap')
  })

  it('raises interview risk when recent scores are declining', () => {
    const progress = emptyProgress()
    addQuestion(progress, 1, 'mastered', 'Java 并发', NOW)
    progress.dailyPlan = [1]
    progress.interviewAttempts[1] = [
      interviewAttempt(1, 58, '2026-06-17T00:00:00.000Z'),
      interviewAttempt(1, 62, '2026-06-16T00:00:00.000Z'),
      interviewAttempt(1, 60, '2026-06-15T00:00:00.000Z'),
      interviewAttempt(1, 86, '2026-06-14T00:00:00.000Z'),
      interviewAttempt(1, 84, '2026-06-13T00:00:00.000Z'),
      interviewAttempt(1, 82, '2026-06-12T00:00:00.000Z'),
    ]

    const report = buildPrepHealthReport([javaRoute], progress, NOW)
    const interview = report.dimensions.find(item => item.key === 'interview')

    expect(interview?.status).toBe('warning')
    expect(interview?.description).toContain('回落')
    expect(report.primaryAction.to).toBe('/practice')
  })

  it('nudges users back to pace when daily plan is empty but fundamentals are stable', () => {
    const progress = emptyProgress()
    addQuestion(progress, 1, 'mastered', 'Java 并发', NOW)
    addQuestion(progress, 2, 'mastered', 'MySQL', NOW)

    const report = buildPrepHealthReport([javaRoute], progress, NOW)

    expect(report.primaryDimension.key).toBe('pace')
    expect(report.primaryAction.to).toBe('/study')
  })

  it('exports risky prep health radar as portable markdown', () => {
    const progress = emptyProgress()
    progress.targetRole = 'Java 后端'
    addQuestion(progress, 1, 'weak', 'Java 并发', '2026-06-13T00:00:00.000Z')
    addQuestion(progress, 2, 'mastered', 'MySQL', '2026-06-16T00:00:00.000Z')
    progress.dailyPlan = [1, 2]

    const markdown = buildPrepHealthMarkdown([javaRoute], progress, NOW)

    expect(markdown).toContain('# Java 后端 备考健康雷达')
    expect(markdown).toContain('生成时间：2026-06-17')
    expect(markdown).toContain('## 健康概览')
    expect(markdown).toContain('## 维度诊断')
    expect(markdown).toContain('## 主行动')
    expect(markdown).toContain('入口：/study')
    expect(markdown).not.toContain('undefined')
  })

  it('keeps empty prep health export actionable', () => {
    const markdown = buildPrepHealthMarkdown([javaRoute], emptyProgress(), NOW)

    expect(markdown).toContain('建立学习轨迹')
    expect(markdown).toContain('入口：/study')
    expect(markdown).not.toContain('undefined')
  })
})
