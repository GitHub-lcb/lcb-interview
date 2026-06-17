import { describe, expect, it } from 'vitest'
import type { InterviewCriterionKey, InterviewFeedback, StudyProgress } from '../types'
import { createDefaultProgress } from './studyProgress'
import { buildInterviewReviewSummary } from './interviewReview'

function criterion(key: InterviewCriterionKey, score: number) {
  const labels: Record<InterviewCriterionKey, string> = {
    coverage: '覆盖度',
    structure: '结构化',
    specificity: '具体性',
    risk: '风险意识',
  }
  return { key, label: labels[key], score, summary: `${labels[key]} ${score}` }
}

function feedback(score: number, overrides: Partial<InterviewFeedback> = {}): InterviewFeedback {
  return {
    score,
    level: score >= 80 ? 'strong' : score >= 60 ? 'pass' : 'needs-work',
    criteria: [
      criterion('coverage', score),
      criterion('structure', Math.max(0, score - 10)),
      criterion('specificity', Math.max(0, score - 20)),
      criterion('risk', Math.max(0, score - 30)),
    ],
    advice: [],
    followUps: [],
    ...overrides,
  }
}

function attempt(questionId: number, score: number, createdAt: string) {
  return { questionId, answer: `answer ${score}`, feedback: feedback(score), createdAt }
}

describe('interviewReview', () => {
  it('returns an empty retrospective when there are no interview attempts', () => {
    const summary = buildInterviewReviewSummary(createDefaultProgress())

    expect(summary.trend).toBe('empty')
    expect(summary.totalAttempts).toBe(0)
    expect(summary.recommendation).toContain('先完成')
  })

  it('aggregates attempts across questions and attaches recent question snapshots', () => {
    const progress: StudyProgress = {
      ...createDefaultProgress(),
      questionSnapshots: {
        1: {
          id: 1,
          title: 'HashMap 为什么线程不安全？',
          difficulty: 'MEDIUM',
          categoryName: 'Java 集合',
          tags: [],
          viewCount: 10,
        },
        2: {
          id: 2,
          title: 'Redis 缓存击穿怎么处理？',
          difficulty: 'HARD',
          categoryName: 'Redis',
          tags: [],
          viewCount: 12,
        },
      },
      interviewAttempts: {
        1: [attempt(1, 80, '2026-06-17T10:00:00')],
        2: [
          attempt(2, 60, '2026-06-17T11:00:00'),
          attempt(2, 90, '2026-06-17T12:00:00'),
        ],
      },
    }

    const summary = buildInterviewReviewSummary(progress)

    expect(summary.totalAttempts).toBe(3)
    expect(summary.answeredQuestions).toBe(2)
    expect(summary.averageScore).toBe(77)
    expect(summary.bestScore).toBe(90)
    expect(summary.latestScore).toBe(90)
    expect(summary.recentAttempts[0].question?.title).toBe('Redis 缓存击穿怎么处理？')
  })

  it('detects improving and declining score trends', () => {
    const improving = buildInterviewReviewSummary({
      ...createDefaultProgress(),
      interviewAttempts: {
        1: [
          attempt(1, 88, '2026-06-17T12:00:00'),
          attempt(1, 82, '2026-06-17T11:00:00'),
          attempt(1, 80, '2026-06-17T10:00:00'),
          attempt(1, 60, '2026-06-17T09:00:00'),
        ],
      },
    })
    const declining = buildInterviewReviewSummary({
      ...createDefaultProgress(),
      interviewAttempts: {
        1: [
          attempt(1, 55, '2026-06-17T12:00:00'),
          attempt(1, 58, '2026-06-17T11:00:00'),
          attempt(1, 62, '2026-06-17T10:00:00'),
          attempt(1, 82, '2026-06-17T09:00:00'),
        ],
      },
    })

    expect(improving.trend).toBe('improving')
    expect(declining.trend).toBe('declining')
  })

  it('finds the weakest criterion by average score', () => {
    const summary = buildInterviewReviewSummary({
      ...createDefaultProgress(),
      interviewAttempts: {
        1: [
          {
            ...attempt(1, 70, '2026-06-17T12:00:00'),
            feedback: feedback(70, {
              criteria: [
                criterion('coverage', 80),
                criterion('structure', 78),
                criterion('specificity', 42),
                criterion('risk', 70),
              ],
            }),
          },
        ],
      },
    })

    expect(summary.weakestCriterion?.key).toBe('specificity')
    expect(summary.recommendation).toContain('具体性')
  })

  it('uses fallback titles for recent attempts without remembered snapshots', () => {
    const summary = buildInterviewReviewSummary({
      ...createDefaultProgress(),
      interviewAttempts: {
        99: [attempt(99, 66, '2026-06-17T12:00:00')],
      },
    })

    expect(summary.recentAttempts[0].question?.title).toBe('题目 #99')
  })
})
