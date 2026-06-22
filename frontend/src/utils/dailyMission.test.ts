import { beforeEach, describe, expect, it } from 'vitest'
import type { InterviewFeedback, QuestionSnapshot, StudyProgress } from '../types'
import { prepRoutes } from '../data/freeSuperiority'
import { createDefaultProgress } from './studyProgress'
import { buildDailyMissionMarkdown, buildDailyMissionPlan } from './dailyMission'
import { PRACTICE_ANSWER_DRAFT_STORAGE_KEY } from './practiceAnswerDraftStore'

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
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('builds startup missions for empty progress', () => {
    const plan = buildDailyMissionPlan(prepRoutes, createDefaultProgress(), '2026-06-17T09:00:00')

    expect(plan.missions.map(mission => mission.kind)).toContain('plan')
    expect(plan.missions.map(mission => mission.kind)).toContain('interview')
    expect(plan.summary).toContain('先建立')
  })

  it('prioritizes unfinished answer drafts before starting new daily missions', () => {
    window.localStorage.setItem(PRACTICE_ANSWER_DRAFT_STORAGE_KEY, JSON.stringify([
      { questionId: 8, draft: 'Redis 缓存草稿', updatedAt: '2026-06-17T08:45:00.000Z' },
      { questionId: 4, draft: 'Spring 事务草稿', updatedAt: '2026-06-17T08:30:00.000Z' },
    ]))
    const progress: StudyProgress = {
      ...createDefaultProgress(),
      questionSnapshots: {
        1: snapshot(1, 'Java 并发'),
        4: snapshot(4, 'Spring'),
        8: snapshot(8, 'Redis'),
      },
      questionStates: {
        1: { status: 'learning', addedToPlan: true, reviewCount: 1, lastReviewedAt: '2026-06-15T09:00:00' },
      },
    }

    const plan = buildDailyMissionPlan(prepRoutes, progress, '2026-06-17T09:00:00')

    expect(plan.missions[0]).toMatchObject({
      id: 'draft-recovery',
      kind: 'draft',
      title: '恢复未提交回答',
      to: '/practice?queue=8,4&from=resume-draft',
      metric: '2 份草稿',
    })
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
      to: '/practice?queue=1&from=review-due',
    })
  })

  it('explains active recall when repeated encounters create the review mission', () => {
    const progress: StudyProgress = {
      ...createDefaultProgress(),
      questionSnapshots: { 7: snapshot(7, 'Java 并发') },
      questionStates: {
        7: {
          status: 'new',
          addedToPlan: false,
          reviewCount: 0,
          encounterCount: 2,
          lastEncounteredAt: '2026-06-16T20:00:00.000Z',
        },
      },
    }

    const mission = buildDailyMissionPlan(prepRoutes, progress, '2026-06-17T09:00:00')
      .missions
      .find(item => item.kind === 'review')

    expect(mission).toMatchObject({
      title: '完成多次遇见题主动回忆',
      description: expect.stringContaining('多次遇见'),
      reason: expect.stringContaining('主动回忆'),
      to: '/practice?queue=7&from=review-due',
      metric: '1 道主动回忆',
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

    expect(mission?.to).toBe('/practice?queue=1,2&from=ability-gap')
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

  it('routes interview recovery missions to the weakest recent practice question', () => {
    const progress: StudyProgress = {
      ...createDefaultProgress(),
      questionSnapshots: {
        1: snapshot(1, 'Redis'),
        2: snapshot(2, 'Spring'),
      },
      interviewAttempts: {
        1: [
          { questionId: 1, answer: 'a', feedback: feedback(82), createdAt: '2026-06-17T12:00:00' },
        ],
        2: [
          { questionId: 2, answer: 'b', feedback: feedback(58), createdAt: '2026-06-17T11:00:00' },
        ],
      },
    }

    const mission = buildDailyMissionPlan(prepRoutes, progress, '2026-06-17T13:00:00')
      .missions
      .find(item => item.kind === 'interview')

    expect(mission).toMatchObject({
      id: 'interview-retrospective',
      title: '补强面试表达短板',
      to: '/practice?queue=2&from=interview-retrospective',
      reason: expect.stringContaining('Question 2'),
    })
  })

  it('adds a real interview pressure mission from personal pressure queue', () => {
    const progress: StudyProgress = {
      ...createDefaultProgress(),
      questionSnapshots: { 9: snapshot(9, 'Redis') },
      questionStates: {
        9: { status: 'mastered', addedToPlan: false, reviewCount: 2 },
      },
      interviewAttempts: {
        9: [
          { questionId: 9, answer: '只说缓存淘汰。', feedback: feedback(58), createdAt: '2026-06-17T12:00:00' },
        ],
      },
    }

    const mission = buildDailyMissionPlan(prepRoutes, progress, '2026-06-17T13:00:00')
      .missions
      .find(item => item.kind === 'experience')

    expect(mission).toMatchObject({
      id: 'experience-pressure',
      title: '完成真实面试押题',
      reason: '来自真实面试场景',
      to: '/practice?queue=9&from=experience-playbook',
      metric: '1 道',
    })
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

  it('routes only unfinished daily plan questions into the plan mission', () => {
    const progress: StudyProgress = {
      ...createDefaultProgress(),
      dailyPlan: [1, 2],
      questionStates: {
        1: { status: 'mastered', addedToPlan: true, reviewCount: 3 },
        2: { status: 'learning', addedToPlan: true, reviewCount: 1 },
      },
    }

    const mission = buildDailyMissionPlan(prepRoutes, progress, '2026-06-17T09:00:00')
      .missions
      .find(item => item.kind === 'plan')

    expect(mission).toMatchObject({
      id: 'plan-continue',
      to: '/practice?queue=2&from=daily-plan',
      metric: expect.stringContaining('1'),
    })
  })

  it('routes completed daily plans to the study closeout instead of more practice', () => {
    const progress: StudyProgress = {
      ...createDefaultProgress(),
      dailyPlan: [1],
      questionStates: {
        1: { status: 'mastered', addedToPlan: true, reviewCount: 3, lastReviewedAt: '2026-06-17T08:00:00' },
      },
    }

    const mission = buildDailyMissionPlan(prepRoutes, progress, '2026-06-17T09:00:00')
      .missions
      .find(item => item.kind === 'plan')

    expect(mission).toMatchObject({
      id: 'plan-complete',
      to: '/study',
      metric: expect.stringContaining('1'),
    })
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
    expect(markdown).toContain('入口：/practice?queue=1&from=review-due')
    expect(markdown).not.toContain('undefined')
  })

  it('keeps empty daily mission export actionable', () => {
    const markdown = buildDailyMissionMarkdown(prepRoutes, createDefaultProgress(), '2026-06-17T09:00:00')

    expect(markdown).toContain('今日冲刺任务')
    expect(markdown).toMatch(/生成今日计划|完成首次模拟面试/)
    expect(markdown).not.toContain('undefined')
  })
})
