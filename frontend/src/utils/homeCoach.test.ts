import { describe, expect, it } from 'vitest'
import type { InterviewAttempt, Question } from '../types'
import { buildHomeCoach } from './homeCoach'
import { createDefaultProgress, rememberQuestions, recordInterviewAttempt } from './studyProgress'

const questions: Question[] = Array.from({ length: 10 }, (_, index) => ({
  id: index + 1,
  title: `Question ${index + 1}`,
  content: 'answer',
  difficulty: index % 2 === 0 ? 'MEDIUM' : 'HARD',
  categoryName: index < 5 ? 'Java 并发' : 'Redis',
  categoryId: index < 5 ? 1 : 2,
  tags: ['Java'],
  viewCount: 100 - index,
  createTime: '2026-07-20T00:00:00.000Z',
}))

function attempt(questionId: number, score: number): InterviewAttempt {
  return {
    questionId,
    answer: 'structured answer',
    feedback: {
      score,
      level: score >= 80 ? 'strong' : score >= 70 ? 'pass' : 'needs-work',
      criteria: [],
      advice: [],
      followUps: [],
      source: 'LOCAL_RULE_BASED',
    },
    createdAt: `2026-07-20T10:${String(questionId).padStart(2, '0')}:00.000Z`,
  }
}

describe('buildHomeCoach', () => {
  it('starts an empty learner with a ten-question role diagnostic', () => {
    const model = buildHomeCoach(createDefaultProgress(), questions)

    expect(model.phase).toBe('diagnostic')
    expect(model.launchpad.recommendedQuestionIds).toHaveLength(10)
    expect(model.launchpad.primaryAction.to).toBe('/practice?queue=1,2,3,4,5,6,7,8,9,10&from=first-run')
    expect(model.readinessScore).toBe(0)
    expect(model.assessedCount).toBe(0)
  })

  it('turns scored weak questions into a compact repair diagnosis', () => {
    let progress = rememberQuestions(createDefaultProgress(), questions)
    progress = recordInterviewAttempt(progress, attempt(1, 55))
    progress = recordInterviewAttempt(progress, attempt(2, 65))
    progress = recordInterviewAttempt(progress, attempt(6, 82))

    const model = buildHomeCoach(progress, questions)

    expect(model.phase).toBe('repair')
    expect(model.assessedCount).toBe(3)
    expect(model.averageScore).toBe(67)
    expect(model.weakAreas[0]).toMatchObject({
      categoryName: 'Java 并发',
      questionCount: 2,
      averageScore: 60,
    })
    expect(model.recommendations[0].status).toBe('weak')
  })
})
