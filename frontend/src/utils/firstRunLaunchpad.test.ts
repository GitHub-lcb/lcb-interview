import { describe, expect, it } from 'vitest'
import type { InterviewAttempt, Question, StudyProgress } from '../types'
import {
  createDefaultProgress,
  rememberQuestions,
  toggleQuestionInPlan,
  updateQuestionStatus,
} from './studyProgress'
import { buildFirstRunLaunchpad } from './firstRunLaunchpad'
import type { PracticeAnswerDraft } from './practiceAnswerDraftStore'

const question = (id: number, categoryName: string): Question => ({
  id,
  title: `Question ${id}`,
  content: 'answer',
  difficulty: id % 2 === 0 ? 'MEDIUM' : 'HARD',
  categoryName,
  categoryId: id,
  tags: [categoryName],
  viewCount: 100 + id,
  createTime: '2026-06-20T00:00:00.000Z',
})

const questions = [
  question(1, 'Java 并发'),
  question(2, 'Redis'),
  question(3, 'MySQL'),
  question(4, 'JVM'),
  question(5, 'Spring'),
  question(6, '系统设计'),
]

const attempt = (questionId: number, score: number, createdAt: string): InterviewAttempt => ({
  questionId,
  answer: `Question ${questionId} answer`,
  feedback: {
    score,
    level: score >= 80 ? 'strong' : 'pass',
    criteria: [
      { key: 'coverage', label: '覆盖度', score, summary: '覆盖核心结论' },
      { key: 'structure', label: '结构化', score, summary: '表达结构清晰' },
      { key: 'specificity', label: '具体性', score, summary: '包含项目化证据' },
      { key: 'risk', label: '风险意识', score, summary: '能说明边界' },
    ],
    advice: [],
    followUps: [],
    source: 'LOCAL_RULE_BASED',
  },
  createdAt,
})

describe('buildFirstRunLaunchpad', () => {
  it('prioritizes unsubmitted practice drafts before normal continuation', () => {
    let progress = createDefaultProgress('2026-06-20T00:00:00.000Z')
    progress = rememberQuestions(progress, questions, '2026-06-20T00:01:00.000Z')
    progress = toggleQuestionInPlan(progress, 4, true, '2026-06-20T00:02:00.000Z')
    const answerDrafts: PracticeAnswerDraft[] = [
      { questionId: 2, draft: 'Redis 草稿', updatedAt: '2026-06-20T09:30:00.000Z' },
      { questionId: 5, draft: 'Spring 草稿', updatedAt: '2026-06-20T09:20:00.000Z' },
    ]

    const model = buildFirstRunLaunchpad(progress, questions, { answerDrafts })

    expect(model.mode).toBe('resume-draft')
    expect(model.title).toBe('继续未提交回答')
    expect(model.primaryAction.label).toBe('恢复 2 份回答草稿')
    expect(model.primaryAction.to).toBe('/practice?queue=2,5&from=resume-draft')
    expect(model.recommendedQuestionIds).toEqual([2, 5])
    expect(model.metrics).toContainEqual({ label: '未提交', value: '2' })
    expect(model.previewItems).toEqual([
      { id: 2, title: 'Question 2', meta: 'Redis · MEDIUM' },
      { id: 5, title: 'Question 5', meta: 'Spring · HARD' },
    ])
  })

  it('drops invalid answer draft ids before resuming first-run drafts', () => {
    const progress = rememberQuestions(
      createDefaultProgress('2026-06-20T00:00:00.000Z'),
      questions,
      '2026-06-20T00:01:00.000Z',
    )
    const answerDrafts: PracticeAnswerDraft[] = [
      { questionId: 2.5, draft: 'invalid decimal draft', updatedAt: '2026-06-20T09:50:00.000Z' },
      { questionId: Number.NaN, draft: 'invalid NaN draft', updatedAt: '2026-06-20T09:45:00.000Z' },
      { questionId: Number.POSITIVE_INFINITY, draft: 'invalid infinity draft', updatedAt: '2026-06-20T09:40:00.000Z' },
      { questionId: 2, draft: 'valid Redis draft', updatedAt: '2026-06-20T09:30:00.000Z' },
      { questionId: 2, draft: 'older duplicate Redis draft', updatedAt: '2026-06-20T09:10:00.000Z' },
    ]

    const model = buildFirstRunLaunchpad(progress, questions, { answerDrafts })

    expect(model.mode).toBe('resume-draft')
    expect(model.primaryAction.to).toBe('/practice?queue=2&from=resume-draft')
    expect(model.recommendedQuestionIds).toEqual([2])
    expect(model.metrics[0].value).toBe('1')
    expect(model.previewItems).toEqual([
      { id: 2, title: 'Question 2', meta: 'Redis · MEDIUM' },
    ])
  })

  it('builds a first-practice queue for empty progress', () => {
    const model = buildFirstRunLaunchpad(createDefaultProgress('2026-06-20T00:00:00.000Z'), questions)

    expect(model.mode).toBe('first-run')
    expect(model.title).toBe('3 分钟开始首轮训练')
    expect(model.primaryAction.label).toBe('生成 5 题首练队列')
    expect(model.primaryAction.to).toBe('/practice?queue=1,2,3,4,5&from=first-run')
    expect(model.recommendedQuestionIds).toEqual([1, 2, 3, 4, 5])
    expect(model.metrics).toContainEqual({ label: '首练题', value: '5' })
    expect(model.previewItems).toEqual([
      { id: 1, title: 'Question 1', meta: 'Java 并发 · HARD' },
      { id: 2, title: 'Question 2', meta: 'Redis · MEDIUM' },
      { id: 3, title: 'Question 3', meta: 'MySQL · HARD' },
    ])
  })

  it('keeps the first action honest while hot questions are loading', () => {
    const model = buildFirstRunLaunchpad(
      createDefaultProgress('2026-06-20T00:00:00.000Z'),
      [],
      { loading: true },
    )

    expect(model.mode).toBe('loading')
    expect(model.title).toBe('正在准备首练题')
    expect(model.primaryAction.label).toBe('正在准备首练题')
    expect(model.primaryAction.to).toBe('/routes')
    expect(model.recommendedQuestionIds).toEqual([])
    expect(model.previewItems).toEqual([])
  })

  it('builds a first-practice queue from cached question snapshots when hot questions are unavailable', () => {
    const progress = rememberQuestions(
      createDefaultProgress('2026-06-20T00:00:00.000Z'),
      questions,
      '2026-06-20T00:01:00.000Z',
    )

    const model = buildFirstRunLaunchpad(progress, [])

    expect(model.mode).toBe('first-run')
    expect(model.primaryAction.label).toBe('生成 5 题首练队列')
    expect(model.primaryAction.to).toBe('/practice?queue=1,2,3,4,5&from=first-run')
    expect(model.recommendedQuestionIds).toEqual([1, 2, 3, 4, 5])
    expect(model.previewItems).toEqual([
      { id: 1, title: 'Question 1', meta: 'Java 并发 · HARD' },
      { id: 2, title: 'Question 2', meta: 'Redis · MEDIUM' },
      { id: 3, title: 'Question 3', meta: 'MySQL · HARD' },
    ])
  })

  it('excludes already scored mastered questions from a new first-run queue', () => {
    let progress: StudyProgress = createDefaultProgress('2026-06-20T00:00:00.000Z')
    progress = rememberQuestions(progress, questions.slice(0, 5), '2026-06-20T00:01:00.000Z')
    progress = {
      ...progress,
      questionStates: {
        1: { status: 'mastered', addedToPlan: false, reviewCount: 1, lastReviewedAt: '2026-06-20T09:20:00.000Z' },
        2: { status: 'mastered', addedToPlan: false, reviewCount: 1, lastReviewedAt: '2026-06-20T09:25:00.000Z' },
      },
      interviewAttempts: {
        1: [attempt(1, 92, '2026-06-20T09:20:00.000Z')],
        2: [attempt(2, 88, '2026-06-20T09:25:00.000Z')],
      },
    }

    const model = buildFirstRunLaunchpad(progress, questions.slice(0, 5))

    expect(model.mode).toBe('first-run')
    expect(model.primaryAction.label).toBe('生成 3 题首练队列')
    expect(model.primaryAction.to).toBe('/practice?queue=3,4,5&from=first-run')
    expect(model.recommendedQuestionIds).toEqual([3, 4, 5])
    expect(model.metrics).toContainEqual({ label: '首练题', value: '3' })
  })

  it('falls back to route selection when no first-run questions are available', () => {
    const model = buildFirstRunLaunchpad(createDefaultProgress('2026-06-20T00:00:00.000Z'), [])

    expect(model.mode).toBe('empty')
    expect(model.title).toBe('先选择一条备考路线')
    expect(model.primaryAction.label).toBe('按岗位选路线')
    expect(model.primaryAction.to).toBe('/routes')
    expect(model.recommendedQuestionIds).toEqual([])
  })

  it('continues an existing daily plan before suggesting new questions', () => {
    let progress = createDefaultProgress('2026-06-20T00:00:00.000Z')
    progress = rememberQuestions(progress, questions, '2026-06-20T00:01:00.000Z')
    progress = toggleQuestionInPlan(progress, 3, true, '2026-06-20T00:02:00.000Z')
    progress = toggleQuestionInPlan(progress, 4, true, '2026-06-20T00:03:00.000Z')

    const model = buildFirstRunLaunchpad(progress, questions)

    expect(model.mode).toBe('continue-plan')
    expect(model.title).toBe('继续今日训练')
    expect(model.primaryAction.label).toBe('继续 2 题队列')
    expect(model.primaryAction.to).toBe('/practice?queue=3,4&from=daily-plan')
    expect(model.recommendedQuestionIds).toEqual([3, 4])
    expect(model.previewItems).toEqual([
      { id: 3, title: 'Question 3', meta: 'MySQL · HARD' },
      { id: 4, title: 'Question 4', meta: 'JVM · MEDIUM' },
    ])
  })

  it('drops invalid daily plan ids before continuing the first-run queue', () => {
    const progress: StudyProgress = {
      ...createDefaultProgress('2026-06-20T00:00:00.000Z'),
      dailyPlan: [10, 0, -1, 2.5, 10, Number.NaN, Number.POSITIVE_INFINITY],
      questionSnapshots: {
        10: {
          id: 10,
          title: 'Question 10',
          difficulty: 'MEDIUM',
          categoryName: 'Java',
          tags: ['Java'],
          viewCount: 110,
        },
      },
      questionStates: {
        10: { status: 'learning', addedToPlan: true, reviewCount: 1 },
      },
    }

    const model = buildFirstRunLaunchpad(progress, [])

    expect(model.mode).toBe('continue-plan')
    expect(model.primaryAction.to).toBe('/practice?queue=10&from=daily-plan')
    expect(model.recommendedQuestionIds).toEqual([10])
    expect(model.previewItems).toEqual([
      { id: 10, title: 'Question 10', meta: 'Java · MEDIUM' },
    ])
  })

  it('continues learning review items when no daily plan exists', () => {
    let progress: StudyProgress = createDefaultProgress('2026-06-20T00:00:00.000Z')
    progress = rememberQuestions(progress, questions, '2026-06-20T00:01:00.000Z')
    progress = updateQuestionStatus(progress, 2, 'learning', '2026-06-20T00:02:00.000Z')

    const model = buildFirstRunLaunchpad(progress, questions)

    expect(model.mode).toBe('continue-plan')
    expect(model.title).toBe('继续今日训练')
    expect(model.primaryAction.label).toBe('继续 1 题队列')
    expect(model.primaryAction.to).toBe('/practice?queue=2&from=daily-plan')
    expect(model.recommendedQuestionIds).toEqual([2])
    expect(model.previewItems).toEqual([
      { id: 2, title: 'Question 2', meta: 'Redis · MEDIUM' },
    ])
  })

  it('turns a completed first-run plan into a lowest-score rehearsal queue', () => {
    let progress: StudyProgress = createDefaultProgress('2026-06-20T00:00:00.000Z')
    progress = rememberQuestions(progress, questions, '2026-06-20T00:01:00.000Z')
    progress = {
      ...progress,
      dailyPlan: [2, 5],
      questionStates: {
        2: { status: 'mastered', addedToPlan: true, reviewCount: 2, lastReviewedAt: '2026-06-20T09:30:00.000Z' },
        5: { status: 'mastered', addedToPlan: true, reviewCount: 2, lastReviewedAt: '2026-06-20T09:36:00.000Z' },
      },
      interviewAttempts: {
        2: [attempt(2, 82, '2026-06-20T09:30:00.000Z')],
        5: [attempt(5, 91, '2026-06-20T09:36:00.000Z')],
      },
    }

    const model = buildFirstRunLaunchpad(progress, questions)

    expect(model.mode).toBe('complete')
    expect(model.title).toBe('今日首练闭环已完成')
    expect(model.summary).toContain('先按低分优先复述')
    expect(model.primaryAction.label).toBe('优先复述 2 道过线题')
    expect(model.primaryAction.to).toBe('/practice?queue=2,5&from=first-run-rehearsal')
    expect(model.primaryAction.kind).toBe('practice')
    expect(model.secondaryActions).toContainEqual({
      label: '查看今日战报',
      description: '沉淀首练高分素材和复述证据',
      to: '/study',
      kind: 'study',
    })
    expect(model.metrics).toContainEqual({ label: '已掌握', value: '2' })
    expect(model.recommendedQuestionIds).toEqual([2, 5])
    expect(model.previewItems).toEqual([
      { id: 2, title: 'Question 2', meta: 'Redis · MEDIUM' },
      { id: 5, title: 'Question 5', meta: 'Spring · HARD' },
    ])
  })

  it('keeps manually mastered plan questions in training until they have a scored attempt', () => {
    let progress: StudyProgress = createDefaultProgress('2026-06-20T00:00:00.000Z')
    progress = rememberQuestions(progress, questions, '2026-06-20T00:01:00.000Z')
    progress = {
      ...progress,
      dailyPlan: [2, 5],
      questionStates: {
        2: { status: 'mastered', addedToPlan: true, reviewCount: 2, lastReviewedAt: '2026-06-20T09:30:00.000Z' },
        5: { status: 'mastered', addedToPlan: true, reviewCount: 1, lastReviewedAt: '2026-06-20T09:36:00.000Z' },
      },
      interviewAttempts: {
        2: [attempt(2, 91, '2026-06-20T09:30:00.000Z')],
      },
    }

    const model = buildFirstRunLaunchpad(progress, questions)

    expect(model.mode).toBe('continue-plan')
    expect(model.primaryAction.to).toBe('/practice?queue=5&from=daily-plan')
    expect(model.recommendedQuestionIds).toEqual([5])
  })

  it('prioritizes weak questions as a repair queue', () => {
    let progress: StudyProgress = createDefaultProgress('2026-06-20T00:00:00.000Z')
    progress = rememberQuestions(progress, questions, '2026-06-20T00:01:00.000Z')
    progress = updateQuestionStatus(progress, 2, 'weak', '2026-06-20T00:02:00.000Z')
    progress = updateQuestionStatus(progress, 5, 'learning', '2026-06-20T00:03:00.000Z')

    const model = buildFirstRunLaunchpad(progress, questions)

    expect(model.mode).toBe('repair')
    expect(model.title).toBe('先修复最影响面试的薄弱题')
    expect(model.primaryAction.label).toBe('修复 2 道风险题')
    expect(model.primaryAction.to).toBe('/practice?queue=2,5&from=first-run-repair')
    expect(model.recommendedQuestionIds).toEqual([2, 5])
  })

  it('keeps homepage weak repair scoped as a first-run repair session', () => {
    let progress: StudyProgress = createDefaultProgress('2026-06-20T00:00:00.000Z')
    progress = rememberQuestions(progress, questions, '2026-06-20T00:01:00.000Z')
    progress = updateQuestionStatus(progress, 2, 'weak', '2026-06-20T00:02:00.000Z')

    const model = buildFirstRunLaunchpad(progress, questions)

    expect(model.mode).toBe('repair')
    expect(model.primaryAction.to).toBe('/practice?queue=2&from=first-run-repair')
  })
})
