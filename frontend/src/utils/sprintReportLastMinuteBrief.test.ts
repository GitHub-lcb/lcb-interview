import { describe, expect, it } from 'vitest'
import type { InterviewAttempt, StudyProgress } from '../types'
import type { PrepRoute } from '../data/freeSuperiority'
import { buildSprintReportMarkdown } from './sprintReport'
import { createDefaultProgress } from './studyProgress'

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

function progress(): StudyProgress {
  return createDefaultProgress(NOW)
}

function addQuestion(target: StudyProgress, id: number, status: 'learning' | 'mastered' | 'weak') {
  target.questionStates[id] = {
    status,
    addedToPlan: true,
    lastReviewedAt: status === 'weak' ? '2026-06-13T00:00:00.000Z' : NOW,
    reviewCount: status === 'mastered' ? 4 : 1,
  }
  target.questionSnapshots[id] = {
    id,
    title: `Java 并发题 ${id}`,
    difficulty: 'MEDIUM',
    categoryName: 'Java 并发',
    tags: ['Java'],
    viewCount: 100 + id,
  }
}

function attempt(questionId: number, score = 62): InterviewAttempt {
  return {
    questionId,
    answer: '回答有结论，但风险边界不足。',
    createdAt: NOW,
    feedback: {
      score,
      level: score >= 80 ? 'strong' : 'pass',
      criteria: [
        { key: 'coverage', label: '覆盖度', score, summary: '覆盖一般' },
        { key: 'structure', label: '结构化', score, summary: '结构一般' },
        { key: 'specificity', label: '场景细节', score, summary: '场景一般' },
        { key: 'risk', label: '风险意识', score: Math.min(score, 48), summary: '风险不足' },
      ],
      advice: [],
      followUps: [],
    },
  }
}

describe('buildSprintReportMarkdown last-minute brief', () => {
  it('exports the last-minute interview brief for risky progress', () => {
    const target = progress()
    addQuestion(target, 1, 'weak')
    addQuestion(target, 2, 'mastered')
    target.dailyPlan = [1, 2]
    target.interviewAttempts[1] = [attempt(1)]

    const markdown = buildSprintReportMarkdown(routes, target, NOW)

    expect(markdown).toContain('## 最后 24 小时面试简报')
    expect(markdown).toContain('最后 24 小时先压临场风险')
    expect(markdown).toContain('进场信心：')
    expect(markdown).toContain('先复盘高风险题')
    expect(markdown).toContain('不要再让风险意识失分')
  })

  it('exports a first-sample action for empty progress', () => {
    const markdown = buildSprintReportMarkdown(routes, progress(), NOW)

    expect(markdown).toContain('## 最后 24 小时面试简报')
    expect(markdown).toContain('先生成第一份进场简报')
    expect(markdown).toContain('先做一题模拟')
    expect(markdown).toContain('/practice')
  })
})
