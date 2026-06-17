import { describe, expect, it } from 'vitest'
import type { InterviewAttempt, StudyProgress } from '../types'
import type { PrepRoute } from '../data/freeSuperiority'
import { buildSprintReportMarkdown } from './sprintReport'

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
    targetRole: 'Java 后端',
    sprintDays: 21,
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

function interviewAttempt(questionId: number, score: number): InterviewAttempt {
  return {
    questionId,
    answer: '围绕原理、场景、风险和落地方案说明。',
    createdAt: NOW,
    feedback: {
      score,
      level: score >= 80 ? 'strong' : 'pass',
      criteria: [
        { key: 'coverage', label: '覆盖度', score, summary: '覆盖核心点' },
        { key: 'structure', label: '结构化', score, summary: '结构清晰' },
        { key: 'specificity', label: '细节', score, summary: '细节充分' },
        { key: 'risk', label: '风险意识', score, summary: '能讲风险' },
      ],
      advice: [],
      followUps: [],
    },
  }
}

describe('buildSprintReportMarkdown', () => {
  it('generates a portable markdown report with health, risks and warmups', () => {
    const progress = emptyProgress()
    addQuestion(progress, 1, 'weak', 'Java 并发', '2026-06-13T00:00:00.000Z')
    addQuestion(progress, 2, 'mastered', 'Java 并发')
    addQuestion(progress, 3, 'learning', 'MySQL')
    progress.dailyPlan = [1, 3]
    progress.interviewAttempts[2] = [interviewAttempt(2, 82)]

    const markdown = buildSprintReportMarkdown(routes, progress, NOW)

    expect(markdown).toContain('# Java 后端 面试冲刺报告')
    expect(markdown).toContain('生成时间：2026-06-17')
    expect(markdown).toContain('## 备考健康度')
    expect(markdown).toContain('最大风险：')
    expect(markdown).toContain('## 四维诊断')
    expect(markdown).toContain('## 可主动表达')
    expect(markdown).toContain('Java 并发 可以主动表达')
    expect(markdown).toContain('## 必须规避')
    expect(markdown).toContain('复习逾期会拖累临场稳定性')
    expect(markdown).toContain('## 开口热身题')
    expect(markdown).toContain('Java 并发 题目 1')
    expect(markdown).toContain('## 下一步行动')
  })

  it('keeps empty reports actionable instead of exporting a blank file', () => {
    const markdown = buildSprintReportMarkdown(routes, emptyProgress(), NOW)

    expect(markdown).toContain('# Java 后端 面试冲刺报告')
    expect(markdown).toContain('先建立轨迹')
    expect(markdown).toContain('还没有学习轨迹')
    expect(markdown).toContain('进入题库')
    expect(markdown).not.toContain('undefined')
  })
})

