import { describe, expect, it } from 'vitest'
import type { InterviewFeedback, StudyProgress } from '../types'
import { createDefaultProgress } from './studyProgress'
import { buildStudyCommandMarkdown, buildStudyStrategy } from './studyStrategy'

const allowedRoutes = ['/banks', '/study', '/practice', '/routes', '/experiences', '/search']

function attempt(score: number): InterviewFeedback {
  return {
    score,
    level: score >= 80 ? 'strong' : score >= 60 ? 'pass' : 'needs-work',
    criteria: [],
    advice: [],
    followUps: [],
    source: 'LOCAL_RULE_BASED',
  }
}

describe('buildStudyStrategy', () => {
  it('gives new users a low readiness score and start action', () => {
    const strategy = buildStudyStrategy(createDefaultProgress())

    expect(strategy.readinessScore).toBeLessThan(35)
    expect(strategy.primaryRisk.key).toBe('start-tracking')
    expect(strategy.actions[0].to).toBe('/banks')
  })

  it('prioritizes weak review when weak questions exceed mastered questions', () => {
    const progress: StudyProgress = {
      ...createDefaultProgress(),
      questionStates: {
        1: { status: 'weak', addedToPlan: true, reviewCount: 2 },
        2: { status: 'weak', addedToPlan: false, reviewCount: 1 },
        3: { status: 'weak', addedToPlan: false, reviewCount: 1 },
        4: { status: 'mastered', addedToPlan: false, reviewCount: 3 },
      },
      dailyPlan: [1],
    }

    const strategy = buildStudyStrategy(progress)

    expect(strategy.primaryRisk.key).toBe('weak-review')
    expect(strategy.actions[0].to).toBe('/study')
  })

  it('raises readiness when plan, mastered questions, and interview attempts exist', () => {
    const emptyScore = buildStudyStrategy(createDefaultProgress()).readinessScore
    const progress: StudyProgress = {
      ...createDefaultProgress(),
      questionStates: {
        1: { status: 'mastered', addedToPlan: false, reviewCount: 3 },
        2: { status: 'mastered', addedToPlan: false, reviewCount: 2 },
        3: { status: 'mastered', addedToPlan: false, reviewCount: 2 },
        4: { status: 'learning', addedToPlan: true, reviewCount: 1 },
      },
      dailyPlan: [4],
      interviewAttempts: {
        1: [{ questionId: 1, answer: '结构化回答', feedback: attempt(86), createdAt: '2026-06-17T00:00:00.000Z' }],
        2: [{ questionId: 2, answer: '覆盖项目经验', feedback: attempt(78), createdAt: '2026-06-17T00:10:00.000Z' }],
      },
    }

    const strategy = buildStudyStrategy(progress)

    expect(strategy.readinessScore).toBeGreaterThan(emptyScore)
    expect(strategy.readinessScore).toBeGreaterThanOrEqual(65)
  })

  it('generates actions that point to existing app routes', () => {
    const strategy = buildStudyStrategy(createDefaultProgress())

    expect(strategy.actions.length).toBeGreaterThanOrEqual(3)
    expect(strategy.actions.every(action => allowedRoutes.some(route => action.to.startsWith(route)))).toBe(true)
  })

  it('exports study command center as portable markdown', () => {
    const progress: StudyProgress = {
      ...createDefaultProgress(),
      targetRole: 'Java 后端',
      sprintDays: 21,
      questionStates: {
        1: { status: 'mastered', addedToPlan: false, reviewCount: 3 },
        2: { status: 'learning', addedToPlan: true, reviewCount: 1 },
        3: { status: 'weak', addedToPlan: true, reviewCount: 2 },
      },
      questionSnapshots: {
        1: { id: 1, title: 'JVM 调优题', difficulty: 'MEDIUM', categoryName: 'JVM', tags: ['JVM'], viewCount: 120 },
        2: { id: 2, title: 'MySQL 索引题', difficulty: 'MEDIUM', categoryName: 'MySQL', tags: ['MySQL'], viewCount: 99 },
        3: { id: 3, title: 'Java 并发题', difficulty: 'HARD', categoryName: 'Java 并发', tags: ['并发'], viewCount: 88 },
      },
      dailyPlan: [2, 3],
      interviewAttempts: {
        1: [{ questionId: 1, answer: '结构化回答', feedback: attempt(86), createdAt: '2026-06-18T00:00:00.000Z' }],
      },
    }

    const markdown = buildStudyCommandMarkdown(progress, '2026-06-18T00:00:00.000Z')

    expect(markdown).toContain('# Java 后端 备考指挥中心')
    expect(markdown).toContain('生成时间：2026-06-18')
    expect(markdown).toContain('## 指挥概览')
    expect(markdown).toContain('## 就绪因子')
    expect(markdown).toContain('## 下一轮训练队列')
    expect(markdown).toContain('状态：下一轮训练队列')
    expect(markdown).toContain('主行动：开始下一轮训练')
    expect(markdown).toContain('Java 并发题')
    expect(markdown).toContain('来源：面试错因')
    expect(markdown).toContain('## 下一步行动')
    expect(markdown).toContain('路径：')
    expect(markdown).not.toContain('undefined')
  })

  it('keeps empty command export actionable', () => {
    const markdown = buildStudyCommandMarkdown(
      createDefaultProgress('2026-06-18T00:00:00.000Z'),
      '2026-06-18T00:00:00.000Z',
    )

    expect(markdown).toContain('还没有形成备考轨迹')
    expect(markdown).toContain('## 下一轮训练队列')
    expect(markdown).toContain('暂无下一轮训练题')
    expect(markdown).toContain('进入题库')
    expect(markdown).not.toContain('undefined')
  })
})
