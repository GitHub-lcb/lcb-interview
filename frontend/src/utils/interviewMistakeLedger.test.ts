import { describe, expect, it } from 'vitest'
import type { InterviewAttempt, InterviewCriterionKey, StudyProgress } from '../types'
import { buildInterviewMistakeLedger } from './interviewMistakeLedger'

const NOW = '2026-06-17T00:00:00.000Z'

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

function addQuestion(progress: StudyProgress, id: number, title: string, status: 'learning' | 'mastered' | 'weak' = 'learning') {
  progress.questionStates[id] = {
    status,
    addedToPlan: true,
    lastReviewedAt: NOW,
    reviewCount: 1,
  }
  progress.questionSnapshots[id] = {
    id,
    title,
    difficulty: 'MEDIUM',
    categoryName: 'Java 集合',
    tags: ['HashMap'],
    viewCount: 100 + id,
  }
}

function attempt(questionId: number, scores: Partial<Record<InterviewCriterionKey, number>>, createdAt = NOW): InterviewAttempt {
  const defaults: Record<InterviewCriterionKey, number> = {
    coverage: 82,
    structure: 82,
    specificity: 82,
    risk: 82,
  }
  const merged = { ...defaults, ...scores }
  return {
    questionId,
    answer: '模拟回答',
    createdAt,
    feedback: {
      score: Math.round(Object.values(merged).reduce((sum, value) => sum + value, 0) / 4),
      level: 'pass',
      criteria: [
        { key: 'coverage', label: '知识覆盖', score: merged.coverage, summary: '覆盖情况' },
        { key: 'structure', label: '表达结构', score: merged.structure, summary: '结构情况' },
        { key: 'specificity', label: '场景细节', score: merged.specificity, summary: '场景情况' },
        { key: 'risk', label: '边界风险', score: merged.risk, summary: '风险情况' },
      ],
      advice: [],
      followUps: [],
    },
  }
}

describe('buildInterviewMistakeLedger', () => {
  it('guides users to create the first interview record when empty', () => {
    const ledger = buildInterviewMistakeLedger(emptyProgress())

    expect(ledger.level).toBe('empty')
    expect(ledger.primaryAction.to).toBe('/practice')
    expect(ledger.items).toHaveLength(0)
  })

  it('aggregates repeated low-score criteria and builds a practice queue', () => {
    const progress = emptyProgress()
    addQuestion(progress, 1, 'HashMap 为什么线程不安全？')
    addQuestion(progress, 2, 'ConcurrentHashMap 如何保证线程安全？')
    progress.interviewAttempts[1] = [attempt(1, { specificity: 35, risk: 45 }, '2026-06-17T00:00:00.000Z')]
    progress.interviewAttempts[2] = [attempt(2, { specificity: 42 }, '2026-06-16T00:00:00.000Z')]

    const ledger = buildInterviewMistakeLedger(progress)

    expect(ledger.level).toBe('risk')
    expect(ledger.items[0].criterionKey).toBe('specificity')
    expect(ledger.items[0].affectedQuestionIds).toEqual([1, 2])
    expect(ledger.items[0].to).toBe('/practice?queue=1,2&from=interview-retrospective')
  })

  it('adds weak questions that have not been practiced aloud', () => {
    const progress = emptyProgress()
    addQuestion(progress, 3, 'HashMap 扩容过程是什么？', 'weak')

    const ledger = buildInterviewMistakeLedger(progress)

    expect(ledger.items[0].type).toBe('weak-unspoken')
    expect(ledger.items[0].affectedQuestionIds).toEqual([3])
    expect(ledger.primaryAction.to).toBe('/practice?queue=3&from=interview-retrospective')
  })

  it('creates advanced pressure entry when attempts have no obvious mistakes', () => {
    const progress = emptyProgress()
    addQuestion(progress, 1, 'HashMap 为什么线程不安全？', 'mastered')
    progress.interviewAttempts[1] = [attempt(1, {}, NOW)]

    const ledger = buildInterviewMistakeLedger(progress)

    expect(ledger.level).toBe('stable')
    expect(ledger.items[0].type).toBe('advanced')
    expect(ledger.items[0].to).toBe('/practice?queue=1&from=interview-retrospective')
  })

  it('deduplicates repeated question ids in practice queues', () => {
    const progress = emptyProgress()
    addQuestion(progress, 1, 'HashMap 为什么线程不安全？')
    progress.interviewAttempts[1] = [
      attempt(1, { risk: 40 }, '2026-06-17T00:00:00.000Z'),
      attempt(1, { risk: 45 }, '2026-06-16T00:00:00.000Z'),
    ]

    const ledger = buildInterviewMistakeLedger(progress)

    expect(ledger.items[0].affectedQuestionIds).toEqual([1])
    expect(ledger.items[0].to).toBe('/practice?queue=1&from=interview-retrospective')
  })
})
