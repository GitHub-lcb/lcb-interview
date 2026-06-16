import { describe, expect, it } from 'vitest'
import type { InterviewFeedback, Question } from '../types'
import {
  appendDailyPlanQuestions,
  buildDailyPlan,
  buildFocusedPracticeQueue,
  buildPracticeQueue,
  buildReviewQueue,
  buildScopedPracticeQueue,
  createDefaultProgress,
  getQuestionState,
  parseStudyProgress,
  rememberQuestions,
  recordInterviewAttempt,
  replaceDailyPlan,
  resolvePlanQuestions,
  summarizeQuestionSetProgress,
  summarizeProgress,
  toggleQuestionInPlan,
  updateStudySettings,
  updateQuestionStatus,
  weakAreasFromQuestions,
} from './studyProgress'

const baseQuestion = (id: number, categoryName: string): Question => ({
  id,
  title: `Question ${id}`,
  content: 'content',
  difficulty: 'MEDIUM',
  categoryName,
  categoryId: categoryName === 'Java 并发' ? 1 : 2,
  tags: ['Java'],
  viewCount: 100 + id,
  createTime: '2026-06-15T00:00:00',
})

const feedback = (score: number): InterviewFeedback => ({
  score,
  level: score >= 80 ? 'strong' : score >= 60 ? 'pass' : 'needs-work',
  criteria: [],
  advice: [],
  followUps: [],
})

describe('studyProgress', () => {
  it('resets corrupted localStorage payloads to default progress', () => {
    const progress = parseStudyProgress('{broken json')

    expect(progress.targetRole).toBe('Java 后端')
    expect(progress.sprintDays).toBe(21)
    expect(progress.dailyPlan).toEqual([])
    expect(progress.questionSnapshots).toEqual({})
    expect(progress.interviewAttempts).toEqual({})
  })

  it('parses old progress payloads without interview attempt data', () => {
    const progress = parseStudyProgress(JSON.stringify({
      targetRole: 'Java 后端',
      sprintDays: 14,
      questionStates: {},
      questionSnapshots: {},
      dailyPlan: [],
      updatedAt: '2026-06-15T00:00:00',
    }))

    expect(progress.interviewAttempts).toEqual({})
  })

  it('updates question status and review metadata immutably', () => {
    const progress = createDefaultProgress()
    const next = updateQuestionStatus(progress, 10, 'weak', '2026-06-15T10:00:00')

    expect(progress.questionStates[10]).toBeUndefined()
    expect(next.questionStates[10]).toEqual({
      status: 'weak',
      addedToPlan: false,
      lastReviewedAt: '2026-06-15T10:00:00',
      reviewCount: 1,
    })
  })

  it('toggles daily plan membership without duplicates', () => {
    const progress = createDefaultProgress()
    const added = toggleQuestionInPlan(progress, 10, true, '2026-06-15T10:00:00')
    const addedAgain = toggleQuestionInPlan(added, 10, true, '2026-06-15T10:01:00')
    const removed = toggleQuestionInPlan(addedAgain, 10, false, '2026-06-15T10:02:00')

    expect(addedAgain.dailyPlan).toEqual([10])
    expect(addedAgain.questionStates[10].addedToPlan).toBe(true)
    expect(removed.dailyPlan).toEqual([])
    expect(removed.questionStates[10].addedToPlan).toBe(false)
  })

  it('replaces the daily plan and keeps study states in sync', () => {
    let progress = createDefaultProgress()
    progress = toggleQuestionInPlan(progress, 10, true, '2026-06-15T10:00:00')
    progress = updateQuestionStatus(progress, 11, 'weak', '2026-06-15T10:01:00')

    const next = replaceDailyPlan(progress, [11, 12, 12], '2026-06-15T10:02:00')

    expect(next.dailyPlan).toEqual([11, 12])
    expect(next.questionStates[10].addedToPlan).toBe(false)
    expect(next.questionStates[11]).toMatchObject({ status: 'weak', addedToPlan: true })
    expect(next.questionStates[12]).toMatchObject({ status: 'learning', addedToPlan: true })
    expect(next.updatedAt).toBe('2026-06-15T10:02:00')
  })

  it('does not downgrade mastered questions when replacing the daily plan', () => {
    let progress = createDefaultProgress()
    progress = updateQuestionStatus(progress, 20, 'mastered', '2026-06-15T10:00:00')

    const next = replaceDailyPlan(progress, [20], '2026-06-15T10:01:00')

    expect(next.questionStates[20]).toMatchObject({
      status: 'mastered',
      addedToPlan: true,
    })
  })

  it('appends page questions to the daily plan with a shared coverage summary', () => {
    let progress = createDefaultProgress()
    progress = updateQuestionStatus(progress, 10, 'weak', '2026-06-15T10:00:00')
    progress = toggleQuestionInPlan(progress, 11, true, '2026-06-15T10:01:00')

    const summary = summarizeQuestionSetProgress(progress, [10, 11, 12, 12])
    const next = appendDailyPlanQuestions(progress, [10, 12, 12], '2026-06-15T10:02:00')
    const nextSummary = summarizeQuestionSetProgress(next, [10, 11, 12])

    expect(summary).toEqual({
      total: 3,
      tracked: 2,
      planned: 1,
      hasQuestions: true,
      allPlanned: false,
    })
    expect(next.dailyPlan).toEqual([11, 10, 12])
    expect(nextSummary).toEqual({
      total: 3,
      tracked: 3,
      planned: 3,
      hasQuestions: true,
      allPlanned: true,
    })
  })

  it('builds a daily plan with weak questions first', () => {
    let progress = createDefaultProgress()
    progress = updateQuestionStatus(progress, 1, 'mastered', '2026-06-15T10:00:00')
    progress = updateQuestionStatus(progress, 2, 'weak', '2026-06-15T10:00:00')
    progress = updateQuestionStatus(progress, 3, 'learning', '2026-06-15T10:00:00')

    const plan = buildDailyPlan(progress, [
      baseQuestion(1, 'Java 并发'),
      baseQuestion(2, 'Java 并发'),
      baseQuestion(3, 'JVM'),
      baseQuestion(4, 'MySQL'),
    ], 3)

    expect(plan).toEqual([2, 3, 4])
  })

  it('summarizes mastery and weak areas from tracked questions', () => {
    let progress = createDefaultProgress()
    progress = updateQuestionStatus(progress, 1, 'weak', '2026-06-15T10:00:00')
    progress = updateQuestionStatus(progress, 2, 'learning', '2026-06-15T10:00:00')
    progress = updateQuestionStatus(progress, 3, 'mastered', '2026-06-15T10:00:00')

    const questions = [
      baseQuestion(1, 'Java 并发'),
      baseQuestion(2, 'Java 并发'),
      baseQuestion(3, 'JVM'),
    ]

    expect(getQuestionState(progress, 99).status).toBe('new')
    expect(summarizeProgress(progress).masteryRate).toBe(33)
    expect(weakAreasFromQuestions(progress, questions)[0].categoryName).toBe('Java 并发')
  })

  it('remembers question snapshots without mutating study states', () => {
    const progress = createDefaultProgress('2026-06-15T00:00:00')
    const next = rememberQuestions(progress, [baseQuestion(7, 'Redis')], '2026-06-15T11:00:00')

    expect(next.questionStates).toEqual({})
    expect(next.questionSnapshots[7]).toMatchObject({
      id: 7,
      title: 'Question 7',
      categoryName: 'Redis',
      difficulty: 'MEDIUM',
      tags: ['Java'],
      viewCount: 107,
    })
    expect(next.updatedAt).toBe('2026-06-15T11:00:00')
  })

  it('resolves today plan titles from remembered snapshots when candidates are absent', () => {
    let progress = createDefaultProgress()
    progress = rememberQuestions(progress, [baseQuestion(7, 'Redis')], '2026-06-15T11:00:00')
    progress = toggleQuestionInPlan(progress, 7, true, '2026-06-15T11:01:00')

    const resolved = resolvePlanQuestions(progress, [], 5)

    expect(resolved).toHaveLength(1)
    expect(resolved[0].title).toBe('Question 7')
    expect(resolved[0].categoryName).toBe('Redis')
  })

  it('builds a review queue with weak questions before learning questions', () => {
    let progress = createDefaultProgress()
    progress = rememberQuestions(progress, [
      baseQuestion(1, 'Java 并发'),
      baseQuestion(2, 'Java 并发'),
      baseQuestion(3, 'JVM'),
    ])
    progress = updateQuestionStatus(progress, 1, 'learning', '2026-06-15T09:00:00')
    progress = updateQuestionStatus(progress, 2, 'weak', '2026-06-15T10:00:00')
    progress = updateQuestionStatus(progress, 3, 'weak', '2026-06-15T08:00:00')

    const queue = buildReviewQueue(progress, 3)

    expect(queue.map(item => item.id)).toEqual([3, 2, 1])
    expect(queue[0].reason).toBe('薄弱优先')
  })

  it('updates study settings with trimmed role and clamped sprint days', () => {
    const progress = createDefaultProgress('2026-06-15T00:00:00')
    const next = updateStudySettings(progress, {
      targetRole: '  AI 大模型  ',
      sprintDays: 120,
    }, '2026-06-15T12:00:00')
    const blankRole = updateStudySettings(next, {
      targetRole: '   ',
      sprintDays: 3,
    }, '2026-06-15T13:00:00')

    expect(next.targetRole).toBe('AI 大模型')
    expect(next.sprintDays).toBe(60)
    expect(next.updatedAt).toBe('2026-06-15T12:00:00')
    expect(blankRole.targetRole).toBe('AI 大模型')
    expect(blankRole.sprintDays).toBe(7)
  })

  it('builds a practice queue from review items, plan items, and fresh candidates', () => {
    let progress = createDefaultProgress()
    const candidates = [
      baseQuestion(1, 'Java 并发'),
      baseQuestion(2, 'Java 并发'),
      baseQuestion(3, 'JVM'),
      baseQuestion(4, 'MySQL'),
    ]
    progress = rememberQuestions(progress, candidates)
    progress = updateQuestionStatus(progress, 1, 'learning', '2026-06-15T09:00:00')
    progress = updateQuestionStatus(progress, 2, 'weak', '2026-06-15T10:00:00')
    progress = toggleQuestionInPlan(progress, 3, true, '2026-06-15T11:00:00')

    const queue = buildPracticeQueue(progress, candidates, 4)

    expect(queue.map(item => item.id)).toEqual([2, 1, 3, 4])
    expect(queue.map(item => item.source)).toEqual(['review', 'review', 'plan', 'new'])
  })

  it('builds fresh practice items from remembered snapshots when candidates are absent', () => {
    let progress = createDefaultProgress()
    progress = rememberQuestions(progress, [
      baseQuestion(10, 'Redis'),
      baseQuestion(11, 'MySQL'),
    ])

    const queue = buildPracticeQueue(progress, [], 2)

    expect(queue.map(item => item.id)).toEqual([10, 11])
    expect(queue.map(item => item.source)).toEqual(['new', 'new'])
  })

  it('prioritizes scoped page questions for direct practice', () => {
    let progress = createDefaultProgress()
    const candidates = [
      baseQuestion(50, 'Redis'),
      baseQuestion(51, 'MySQL'),
      baseQuestion(52, 'JVM'),
      baseQuestion(53, 'Spring'),
    ]
    progress = rememberQuestions(progress, candidates)
    progress = toggleQuestionInPlan(progress, 52, true, '2026-06-15T11:00:00')
    progress = updateQuestionStatus(progress, 53, 'weak', '2026-06-15T12:00:00')

    const queue = buildScopedPracticeQueue(progress, candidates, [51, 52, 51], null, 4)

    expect(queue.map(item => item.id)).toEqual([51, 52, 53, 50])
    expect(queue.map(item => item.source)).toEqual(['page', 'page', 'review', 'new'])
  })

  it('keeps a focused question first inside a scoped practice queue', () => {
    let progress = createDefaultProgress()
    const candidates = [
      baseQuestion(60, 'Redis'),
      baseQuestion(61, 'MySQL'),
      baseQuestion(62, 'JVM'),
    ]
    progress = rememberQuestions(progress, candidates)

    const queue = buildScopedPracticeQueue(progress, candidates, [60, 61, 62], 62, 3)

    expect(queue.map(item => item.id)).toEqual([62, 60, 61])
    expect(queue[0].source).toBe('page')
  })

  it('moves a focused practice question to the front of the queue', () => {
    let progress = createDefaultProgress()
    const candidates = [
      baseQuestion(30, 'Redis'),
      baseQuestion(31, 'MySQL'),
      baseQuestion(32, 'JVM'),
    ]
    progress = rememberQuestions(progress, candidates)

    const queue = buildFocusedPracticeQueue(progress, candidates, 32, 3)

    expect(queue.map(item => item.id)).toEqual([32, 30, 31])
  })

  it('keeps a mastered focused question available for direct practice', () => {
    let progress = createDefaultProgress()
    progress = rememberQuestions(progress, [baseQuestion(40, 'Redis')])
    progress = updateQuestionStatus(progress, 40, 'mastered', '2026-06-15T10:00:00')

    const queue = buildFocusedPracticeQueue(progress, [], 40, 2)

    expect(queue).toHaveLength(1)
    expect(queue[0]).toMatchObject({
      id: 40,
      status: 'mastered',
      source: 'new',
    })
  })

  it('records interview attempts newest first and keeps five per question', () => {
    let progress = createDefaultProgress('2026-06-15T00:00:00')
    for (let index = 1; index <= 6; index += 1) {
      progress = recordInterviewAttempt(progress, {
        questionId: 10,
        answer: `answer ${index}`,
        feedback: feedback(50 + index),
        createdAt: `2026-06-15T10:0${index}:00`,
      })
    }

    expect(progress.interviewAttempts[10]).toHaveLength(5)
    expect(progress.interviewAttempts[10].map(item => item.answer)).toEqual([
      'answer 6',
      'answer 5',
      'answer 4',
      'answer 3',
      'answer 2',
    ])
    expect(progress.updatedAt).toBe('2026-06-15T10:06:00')
  })
})
