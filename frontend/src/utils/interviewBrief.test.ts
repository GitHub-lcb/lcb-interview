import { describe, expect, it } from 'vitest'
import type { InterviewAttempt, StudyProgress } from '../types'
import type { PrepRoute } from '../data/freeSuperiority'
import { buildInterviewBrief, buildInterviewBriefMarkdown } from './interviewBrief'

const NOW = '2026-06-17T00:00:00.000Z'

const routes: PrepRoute[] = [
  {
    id: 'java-backend',
    title: 'Java 后端冲刺路线',
    role: 'Java 后端',
    duration: '21 天',
    summary: 'Java 后端高频路线。',
    stages: ['并发', '数据库'],
    categories: ['Java 并发', 'MySQL'],
    actions: [],
  },
]

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

function addQuestion(
  progress: StudyProgress,
  id: number,
  status: 'new' | 'learning' | 'mastered' | 'weak',
  categoryName: string,
  lastReviewedAt = NOW,
) {
  progress.questionStates[id] = {
    status,
    addedToPlan: true,
    lastReviewedAt,
    reviewCount: status === 'new' ? 0 : 1,
  }
  progress.questionSnapshots[id] = {
    id,
    title: `${categoryName} 题目 ${id}`,
    difficulty: 'MEDIUM',
    categoryName,
    tags: [categoryName],
    viewCount: 100 + id,
  }
}

function interviewAttempt(questionId: number, score: number, createdAt: string): InterviewAttempt {
  return {
    questionId,
    answer: '从背景、方案、权衡和风险展开说明。',
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

describe('buildInterviewBrief', () => {
  it('guides empty progress users to start from question banks', () => {
    const brief = buildInterviewBrief(routes, emptyProgress(), NOW)

    expect(brief.level).toBe('empty')
    expect(brief.primaryAction.to).toBe('/banks')
    expect(brief.risks[0].title).toContain('还没有')
  })

  it('sorts strengths by mastered category count', () => {
    const progress = emptyProgress()
    addQuestion(progress, 1, 'mastered', 'Java 并发')
    addQuestion(progress, 2, 'mastered', 'Java 并发')
    addQuestion(progress, 3, 'mastered', 'MySQL')

    const brief = buildInterviewBrief(routes, progress, NOW)

    expect(brief.strengths[0].title).toContain('Java 并发')
    expect(brief.strengths[0].metric).toBe('2 掌握')
  })

  it('prioritizes overdue weak questions as interview risk', () => {
    const progress = emptyProgress()
    addQuestion(progress, 1, 'weak', 'Java 并发', '2026-06-13T00:00:00.000Z')
    addQuestion(progress, 2, 'mastered', 'MySQL')
    progress.dailyPlan = [1, 2]

    const brief = buildInterviewBrief(routes, progress, NOW)

    expect(brief.level).toBe('risk')
    expect(brief.risks[0].title).toContain('复习逾期')
    expect(brief.primaryAction.to).toBe('/study')
  })

  it('builds a deduped warmup queue from review and route progress', () => {
    const progress = emptyProgress()
    addQuestion(progress, 1, 'weak', 'Java 并发', '2026-06-13T00:00:00.000Z')
    addQuestion(progress, 2, 'learning', 'Java 并发')
    addQuestion(progress, 3, 'new', 'MySQL')
    progress.dailyPlan = [1, 2]

    const brief = buildInterviewBrief(routes, progress, NOW)
    const ids = brief.warmups.map(item => item.questionId)

    expect(ids[0]).toBe(1)
    expect(new Set(ids).size).toBe(ids.length)
    expect(brief.primaryAction.to).toContain('/study')
  })

  it('adds a risk when mock interview scores are declining', () => {
    const progress = emptyProgress()
    addQuestion(progress, 1, 'mastered', 'Java 并发')
    progress.dailyPlan = [1]
    progress.interviewAttempts[1] = [
      interviewAttempt(1, 58, '2026-06-17T00:00:00.000Z'),
      interviewAttempt(1, 62, '2026-06-16T00:00:00.000Z'),
      interviewAttempt(1, 60, '2026-06-15T00:00:00.000Z'),
      interviewAttempt(1, 86, '2026-06-14T00:00:00.000Z'),
      interviewAttempt(1, 84, '2026-06-13T00:00:00.000Z'),
      interviewAttempt(1, 82, '2026-06-12T00:00:00.000Z'),
    ]

    const brief = buildInterviewBrief(routes, progress, NOW)

    expect(brief.risks.some(item => item.description.includes('回落'))).toBe(true)
    expect(brief.primaryAction.to).toBe('/practice')
  })

  it('exports risky interview brief as portable markdown', () => {
    const progress = emptyProgress()
    addQuestion(progress, 1, 'weak', 'Java 并发', '2026-06-13T00:00:00.000Z')
    addQuestion(progress, 2, 'mastered', 'MySQL')
    progress.dailyPlan = [1, 2]

    const markdown = buildInterviewBriefMarkdown(routes, progress, NOW)

    expect(markdown).toContain('# Java 后端工程师 面试前冲刺简报')
    expect(markdown).toContain('生成时间：2026-06-17')
    expect(markdown).toContain('## 简报概览')
    expect(markdown).toContain('面试前先控风险')
    expect(markdown).toContain('## 可主动表达')
    expect(markdown).toContain('## 必须规避')
    expect(markdown).toContain('## 开口热身')
    expect(markdown).toContain('复习逾期会拖累临场稳定性')
    expect(markdown).toContain('入口：/study')
    expect(markdown).not.toContain('undefined')
  })

  it('keeps empty interview brief export actionable', () => {
    const markdown = buildInterviewBriefMarkdown(routes, emptyProgress(), NOW)

    expect(markdown).toContain('面试简报待生成')
    expect(markdown).toContain('还没有学习轨迹')
    expect(markdown).toContain('进入题库')
    expect(markdown).not.toContain('undefined')
  })
})
