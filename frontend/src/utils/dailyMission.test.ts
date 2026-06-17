import { describe, expect, it } from 'vitest'
import type { InterviewFeedback, QuestionSnapshot, StudyProgress } from '../types'
import { prepRoutes } from '../data/freeSuperiority'
import { createDefaultProgress } from './studyProgress'
import { buildDailyMissionMarkdown, buildDailyMissionPlan } from './dailyMission'

const snapshot = (id: number, categoryName: string, tags: string[] = []): QuestionSnapshot => ({
  id,
  title: `Question ${id}`,
  difficulty: 'MEDIUM',
  categoryName,
  tags,
  viewCount: 10,
})

const feedback = (score: number): InterviewFeedback => ({
  score,
  level: score >= 80 ? 'strong' : score >= 60 ? 'pass' : 'needs-work',
  criteria: [
    { key: 'coverage', label: '覆盖度', score, summary: '覆盖度' },
    { key: 'structure', label: '结构化', score: score - 10, summary: '结构化' },
    { key: 'specificity', label: '具体性', score: score - 20, summary: '具体性' },
    { key: 'risk', label: '风险意识', score: score - 30, summary: '风险意识' },
  ],
  advice: [],
  followUps: [],
})

describe('dailyMission', () => {
  it('builds startup missions for empty progress', () => {
    const plan = buildDailyMissionPlan(prepRoutes, createDefaultProgress(), '2026-06-17T09:00:00')

    expect(plan.missions.map(mission => mission.kind)).toContain('plan')
    expect(plan.missions.map(mission => mission.kind)).toContain('interview')
    expect(plan.summary).toContain('先建立')
  })

  it('puts overdue review mission first', () => {
    const progress: StudyProgress = {
      ...createDefaultProgress(),
      questionSnapshots: { 1: snapshot(1, 'Java 并发') },
      questionStates: {
        1: { status: 'learning', addedToPlan: true, reviewCount: 1, lastReviewedAt: '2026-06-15T09:00:00' },
      },
    }

    const plan = buildDailyMissionPlan(prepRoutes, progress, '2026-06-17T09:00:00')

    expect(plan.missions[0]).toMatchObject({
      kind: 'review',
      to: '/study',
    })
  })

  it('creates an ability mission with a focused practice queue', () => {
    const progress: StudyProgress = {
      ...createDefaultProgress(),
      questionSnapshots: {
        1: snapshot(1, 'Java 并发'),
        2: snapshot(2, 'JVM'),
      },
      questionStates: {
        1: { status: 'weak', addedToPlan: true, reviewCount: 2 },
        2: { status: 'learning', addedToPlan: true, reviewCount: 1 },
      },
    }

    const mission = buildDailyMissionPlan(prepRoutes, progress, '2026-06-17T09:00:00')
      .missions
      .find(item => item.kind === 'ability')

    expect(mission?.to).toBe('/practice?queue=1,2')
    expect(mission?.reason).toContain('岗位能力')
  })

  it('raises interview priority when recent scores are declining', () => {
    const progress: StudyProgress = {
      ...createDefaultProgress(),
      interviewAttempts: {
        1: [
          { questionId: 1, answer: 'a', feedback: feedback(55), createdAt: '2026-06-17T12:00:00' },
          { questionId: 1, answer: 'b', feedback: feedback(58), createdAt: '2026-06-17T11:00:00' },
          { questionId: 1, answer: 'c', feedback: feedback(62), createdAt: '2026-06-17T10:00:00' },
          { questionId: 1, answer: 'd', feedback: feedback(88), createdAt: '2026-06-17T09:00:00' },
        ],
      },
    }

    const mission = buildDailyMissionPlan(prepRoutes, progress, '2026-06-17T13:00:00')
      .missions
      .find(item => item.kind === 'interview')

    expect(mission?.priority).toBeGreaterThan(80)
    expect(mission?.description).toContain('回落')
  })

  it('deduplicates repeated action targets by keeping the highest priority mission', () => {
    const progress = {
      ...createDefaultProgress(),
      dailyPlan: [1],
    }

    const plan = buildDailyMissionPlan(prepRoutes, progress, '2026-06-17T09:00:00')
    const targets = plan.missions.map(mission => mission.to)

    expect(targets.length).toBe(new Set(targets).size)
  })

  it('exports daily missions as portable markdown', () => {
    const progress: StudyProgress = {
      ...createDefaultProgress(),
      targetRole: 'Java 后端',
      dailyPlan: [1],
      questionSnapshots: { 1: snapshot(1, 'Java 并发') },
      questionStates: {
        1: { status: 'learning', addedToPlan: true, reviewCount: 1, lastReviewedAt: '2026-06-15T09:00:00' },
      },
    }

    const markdown = buildDailyMissionMarkdown(prepRoutes, progress, '2026-06-17T09:00:00')

    expect(markdown).toContain('# Java 后端 今日冲刺任务')
    expect(markdown).toContain('生成时间：2026-06-17')
    expect(markdown).toContain('## 任务概览')
    expect(markdown).toContain('## 任务清单')
    expect(markdown).toContain('入口：/study')
    expect(markdown).not.toContain('undefined')
  })

  it('keeps empty daily mission export actionable', () => {
    const markdown = buildDailyMissionMarkdown(prepRoutes, createDefaultProgress(), '2026-06-17T09:00:00')

    expect(markdown).toContain('今日冲刺任务')
    expect(markdown).toMatch(/生成今日计划|完成首次模拟面试/)
    expect(markdown).not.toContain('undefined')
  })
})
