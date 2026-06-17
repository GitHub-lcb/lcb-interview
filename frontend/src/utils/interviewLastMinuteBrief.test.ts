import { describe, expect, it } from 'vitest'
import type { InterviewAttempt, InterviewCriterionKey, StudyProgress, StudyQuestionStatus } from '../types'
import { createDefaultProgress } from './studyProgress'
import { buildInterviewLastMinuteBrief } from './interviewLastMinuteBrief'

const NOW = '2026-06-17T09:00:00.000Z'

function progress(): StudyProgress {
  return createDefaultProgress(NOW)
}

function addQuestion(
  target: StudyProgress,
  id: number,
  status: StudyQuestionStatus,
  lastReviewedAt = NOW,
) {
  target.questionStates[id] = {
    status,
    addedToPlan: true,
    lastReviewedAt,
    reviewCount: status === 'mastered' ? 4 : 1,
  }
  target.questionSnapshots[id] = {
    id,
    title: `Java 并发题 ${id}`,
    difficulty: 'MEDIUM',
    categoryName: 'Java 并发',
    tags: ['Java', '并发'],
    viewCount: 100 + id,
  }
}

function attempt(
  questionId: number,
  scores: Partial<Record<InterviewCriterionKey, number>> = {},
  createdAt = NOW,
): InterviewAttempt {
  const merged: Record<InterviewCriterionKey, number> = {
    coverage: 86,
    structure: 86,
    specificity: 86,
    risk: 86,
    ...scores,
  }

  return {
    questionId,
    answer: '先讲结论，再讲原理、场景、边界和项目落地。',
    createdAt,
    feedback: {
      score: Math.round(Object.values(merged).reduce((sum, score) => sum + score, 0) / 4),
      level: 'pass',
      criteria: [
        { key: 'coverage', label: '覆盖度', score: merged.coverage, summary: '覆盖情况' },
        { key: 'structure', label: '结构化', score: merged.structure, summary: '结构情况' },
        { key: 'specificity', label: '场景细节', score: merged.specificity, summary: '场景情况' },
        { key: 'risk', label: '风险意识', score: merged.risk, summary: '风险情况' },
      ],
      advice: [],
      followUps: [],
    },
  }
}

describe('buildInterviewLastMinuteBrief', () => {
  it('guides empty progress to create the first interview sample', () => {
    const brief = buildInterviewLastMinuteBrief(progress(), NOW)

    expect(brief.level).toBe('empty')
    expect(brief.confidenceScore).toBe(0)
    expect(brief.primaryAction.to).toBe('/practice')
    expect(brief.items[0]).toMatchObject({ kind: 'sample', actionLabel: '先做一题模拟' })
  })

  it('puts overdue review debt first in the last-minute brief', () => {
    const target = progress()
    addQuestion(target, 1, 'weak', '2026-06-13T09:00:00.000Z')
    addQuestion(target, 2, 'mastered', NOW)
    target.dailyPlan = [1, 2]
    target.interviewAttempts[2] = [attempt(2)]

    const brief = buildInterviewLastMinuteBrief(target, NOW)

    expect(brief.level).toBe('risk')
    expect(brief.items[0]).toMatchObject({ kind: 'must-review', questionIds: [1] })
    expect(brief.items[0].to).toBe('/practice?queue=1')
    expect(brief.metrics.some(metric => metric.label === '复习债' && metric.value === '1 道')).toBe(true)
  })

  it('turns the weakest interview criterion into a concrete avoid rule', () => {
    const target = progress()
    addQuestion(target, 3, 'mastered', NOW)
    target.interviewAttempts[3] = [attempt(3, { risk: 35 })]

    const brief = buildInterviewLastMinuteBrief(target, NOW)
    const avoid = brief.items.find(item => item.kind === 'avoid')

    expect(avoid?.title).toContain('风险意识')
    expect(avoid?.detail).toContain('主动补')
    expect(brief.metrics.some(metric => metric.label === '错因数' && metric.value !== '0 个')).toBe(true)
  })

  it('reports ready when there are strong samples and no urgent risks', () => {
    const target = progress()
    addQuestion(target, 4, 'mastered', NOW)
    addQuestion(target, 5, 'mastered', NOW)
    target.dailyPlan = [4, 5]
    target.interviewAttempts[4] = [attempt(4)]
    target.interviewAttempts[5] = [attempt(5, { structure: 90, specificity: 88 })]

    const brief = buildInterviewLastMinuteBrief(target, NOW)

    expect(brief.level).toBe('ready')
    expect(brief.confidenceScore).toBeGreaterThanOrEqual(80)
    expect(brief.items.some(item => item.kind === 'talk-track')).toBe(true)
    expect(brief.items.some(item => item.kind === 'closing')).toBe(true)
  })
})
